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

export async function buildExportHtml(): Promise<string> {
  const view = useStore.getState().activeView()
  if (!view) throw new Error('编辑器未就绪')
  const doc = view.state.doc
  const host = document.createElement('div')
  host.appendChild(DOMSerializer.fromSchema(schema).serializeFragment(doc.content))

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
