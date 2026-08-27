import { DOMSerializer } from 'prosemirror-model'
import katex from 'katex'
import hljs from 'highlight.js/lib/common'
import mermaid from 'mermaid'
import { schema } from './schema'
import { useStore } from '../store'
import { api } from '../api'
import { exportProseCss } from './exportCss'
import katexCss from './katexEmbedded.css?raw'
import hljsCss from 'highlight.js/styles/github-dark.css?raw'

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// 把图片 src 解析为本地绝对路径；外部 http/data/blob 等返回 null（无需内联）
function resolveAbsoluteImagePath(src: string): string | null {
  const s = String(src ?? '').trim()
  if (!s) return null
  if (/^(data|blob):/i.test(s)) return null
  if (/^https?:\/\//i.test(s)) return null
  if (s.startsWith('smimg:///')) {
    try {
      const raw = decodeURIComponent(s.slice('smimg:///'.length))
      return raw.replace(/\\/g, '/')
    } catch {
      return s.slice('smimg:///'.length)
    }
  }
  if (/^file:/i.test(s)) return null
  const isAbs = /^[A-Za-z]:[\\/]/.test(s) || s.startsWith('/') || s.startsWith('\\\\')
  if (isAbs) return s.replace(/\\/g, '/')
  const tabPath = useStore.getState().activeTab()?.path
  if (!tabPath) return null
  const dir = tabPath.split(/[\\/]/).slice(0, -1).join('/')
  return (dir ? dir + '/' : '') + s.replace(/\\/g, '/')
}

export async function buildExportHtml(): Promise<string> {
  const view = useStore.getState().activeView()
  if (!view) throw new Error('编辑器未就绪')
  const doc = view.state.doc
  const host = document.createElement('div')
  host.appendChild(DOMSerializer.fromSchema(schema).serializeFragment(doc.content))

  // 图片：把本地相对/绝对路径的图片内联为 dataURL，避免导出后因路径失效而丢失
  const imgs = Array.from(host.querySelectorAll<HTMLImageElement>('img'))
  for (const img of imgs) {
    const rawSrc = img.getAttribute('src') || ''
    const abs = resolveAbsoluteImagePath(rawSrc)
    if (!abs) continue
    try {
      const dataUrl = await api.readImageAsDataUrl(abs)
      if (dataUrl) img.setAttribute('src', dataUrl)
    } catch {
      /* 保持原 src，若文件不存在则导出后仍显示破图占位 */
    }
  }

  // 数学公式（行内 + 块级）
  host.querySelectorAll<HTMLElement>('.math-inline').forEach((el) => {
    const src = el.getAttribute('data-content') || ''
    const wrap = document.createElement('span')
    wrap.className = 'math-inline-render'
    wrap.innerHTML = katex.renderToString(src, { displayMode: false, throwOnError: false })
    el.replaceWith(wrap)
  })
  host.querySelectorAll<HTMLElement>('.math-block').forEach((el) => {
    const src = el.getAttribute('data-content') || ''
    const wrap = document.createElement('div')
    wrap.className = 'math-display'
    wrap.innerHTML = katex.renderToString(src, { displayMode: true, throwOnError: false })
    el.replaceWith(wrap)
  })

  // 代码块 / Mermaid 图表
  const pres = Array.from(host.querySelectorAll<HTMLElement>('pre[data-language]'))
  for (const pre of pres) {
    const lang = pre.getAttribute('data-language') || ''
    const codeEl = pre.querySelector('code')
    const text = codeEl?.textContent ?? ''
    if (lang === 'mermaid') {
      try {
        const { svg } = await mermaid.render(
          `export-mmd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          text,
        )
        const wrap = document.createElement('div')
        wrap.className = 'mermaid-export'
        wrap.innerHTML = svg
        pre.replaceWith(wrap)
      } catch (e) {
        const err = document.createElement('pre')
        err.className = 'mermaid-error'
        err.textContent = 'Mermaid 渲染失败：' + String(e)
        pre.replaceWith(err)
      }
    } else if (lang && hljs.getLanguage(lang)) {
      const code = document.createElement('code')
      code.className = `hljs language-${lang}`
      code.innerHTML = hljs.highlight(text, { language: lang }).value
      pre.innerHTML = ''
      pre.appendChild(code)
    } else {
      const code = document.createElement('code')
      code.textContent = text
      pre.innerHTML = ''
      pre.appendChild(code)
    }
  }

  const state = useStore.getState()
  const title = state.activeTab()?.name || 'SuperMarkdown'
  const isDark = state.theme === 'dark'
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(title)}</title>
<style>
${katexCss}
${hljsCss}
${exportProseCss}
body { max-width: 880px; margin: 0 auto; padding: 48px 32px; background: ${isDark ? '#1b1b1f' : '#ffffff'}; color: ${isDark ? '#d6d6da' : '#333333'}; }
@media print { body { padding: 0; max-width: 100%; } }
</style>
</head>
<body data-theme="${isDark ? 'dark' : 'light'}">
<article class="prose">${host.innerHTML}</article>
<script>window.__mdReady = true;<\/script>
</body>
</html>`
}

export async function exportAsHtml() {
  try {
    const html = await buildExportHtml()
    const state = useStore.getState()
    const name = ((state.activeTab()?.name) || 'export').replace(/\.md$/i, '') + '.html'
    const res = await api.exportHtml(html, name)
    if (res.ok) useStore.getState().notify('已导出 HTML' + (res.path ? '：' + res.path : ''))
    else useStore.getState().notify('导出 HTML 失败：' + (res.error || '未知错误'))
  } catch (e) {
    useStore.getState().notify('导出 HTML 失败：' + String(e))
  }
}

export async function exportAsPdf() {
  try {
    const html = await buildExportHtml()
    const state = useStore.getState()
    const name = ((state.activeTab()?.name) || 'export').replace(/\.md$/i, '') + '.pdf'
    const res = await api.exportPdf(html, name)
    if (res.ok) useStore.getState().notify('已导出 PDF' + (res.path ? '：' + res.path : ''))
    else useStore.getState().notify('导出 PDF 失败：' + (res.error || '未知错误'))
  } catch (e) {
    useStore.getState().notify('导出 PDF 失败：' + String(e))
  }
}
