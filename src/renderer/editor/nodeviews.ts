import type { Node } from 'prosemirror-model'
import type { EditorView, NodeView, NodeViewConstructor } from 'prosemirror-view'
import { NodeSelection } from 'prosemirror-state'
import katex from 'katex'
import hljs from 'highlight.js/lib/common'
import mermaid from 'mermaid'
import { useStore } from '../store'

mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'strict', fontFamily: 'inherit' })

let mermaidSeq = 0

const EXTERNAL_SRC_RE = /^(data|https?|blob|file|smimg):/i

function toSmimgUrl(absPath: string): string {
  const norm = absPath.replace(/[\\/]+/g, '/').replace(/^\//, '')
  return 'smimg:///' + norm.split('/').map(encodeURIComponent).join('/')
}

// 把 markdown 中的图片 src 解析为可加载的地址：
// data:/http(s):/blob: 等原样保留；相对路径基于当前文档所在目录换算为 smimg:// 本地协议地址
export function resolveImgSrc(src: unknown): string {
  const s = String(src ?? '')
  if (!s || EXTERNAL_SRC_RE.test(s)) return s
  const isAbs = /^[A-Za-z]:[\\/]/.test(s) || s.startsWith('/') || s.startsWith('\\\\')
  let p = s
  if (!isAbs) {
    const tabPath = useStore.getState().activeTab()?.path
    if (!tabPath) return s
    const dir = tabPath.split(/[\\/]/).slice(0, -1).join('/')
    p = (dir ? dir + '/' : '') + s.replace(/\\/g, '/')
  }
  return toSmimgUrl(p)
}

class CodeBlockView implements NodeView {
  dom: HTMLDivElement
  node: Node
  view: EditorView
  getPos: () => number | undefined
  private body: HTMLDivElement

  constructor(node: Node, view: EditorView, getPos: () => number | undefined) {
    this.node = node
    this.view = view
    this.getPos = getPos
    this.dom = document.createElement('div')
    this.dom.className = 'cb'
    this.body = document.createElement('div')
    this.render()
  }

  get isMermaid() {
    return this.node.attrs.language === 'mermaid'
  }

  private render() {
    this.dom.innerHTML = ''
    const header = document.createElement('div')
    header.className = 'cb-header'
    const lang = document.createElement('span')
    lang.className = 'cb-lang'
    lang.textContent = this.node.attrs.language || 'text'
    const edit = document.createElement('button')
    edit.className = 'cb-btn'
    edit.textContent = '编辑代码'
    edit.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
    })
    edit.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.openEditor()
    })
    header.appendChild(lang)
    header.appendChild(edit)
    if (this.isMermaid) {
      const rerender = document.createElement('button')
      rerender.className = 'cb-btn'
      rerender.textContent = '重新渲染'
      rerender.addEventListener('mousedown', (e) => {
        e.preventDefault()
        e.stopPropagation()
      })
      rerender.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        this.renderBody()
      })
      header.insertBefore(rerender, edit)
    }
    this.body = document.createElement('div')
    this.body.className = 'cb-body'
    this.dom.appendChild(header)
    this.dom.appendChild(this.body)
    this.renderBody()
  }

  private renderBody() {
    const text = this.node.textContent
    if (this.isMermaid) {
      this.body.className = 'cb-body mermaid-host'
      const id = `sm-mmd-${++mermaidSeq}`
      this.body.innerHTML = '<div class="mermaid-loading">正在渲染图表…</div>'
      mermaid
        .render(id, text)
        .then(({ svg }) => {
          if (this.body) this.body.innerHTML = svg
        })
        .catch((err: unknown) => {
          if (this.body) {
            this.body.innerHTML = `<div class="mermaid-error">Mermaid 渲染失败：${String(
              (err as Error)?.message ?? err,
            )}</div>`
          }
        })
    } else {
      this.body.className = 'cb-body'
      const pre = document.createElement('pre')
      const code = document.createElement('code')
      const lang = this.node.attrs.language
      if (lang && hljs.getLanguage(lang)) {
        code.className = `language-${lang}`
        code.innerHTML = hljs.highlight(text, { language: lang }).value
      } else {
        code.textContent = text
      }
      pre.appendChild(code)
      this.body.appendChild(pre)
    }
  }

  private openEditor() {
    useStore.getState().openModal({
      kind: 'code',
      pos: this.getPos() ?? 0,
      initial: this.node.textContent,
      language: this.node.attrs.language,
    })
  }

  update(node: Node) {
    if (node.type.name !== 'code_block') return false
    if (node.textContent !== this.node.textContent || node.attrs.language !== this.node.attrs.language) {
      this.node = node
      this.render()
    } else {
      this.node = node
    }
    return true
  }

  stopEvent() {
    return true
  }

  ignoreMutation() {
    return true
  }
}

class MathInlineView implements NodeView {
  dom: HTMLSpanElement
  node: Node
  view: EditorView
  getPos: () => number | undefined

  constructor(node: Node, view: EditorView, getPos: () => number | undefined) {
    this.node = node
    this.view = view
    this.getPos = getPos
    this.dom = document.createElement('span')
    this.dom.className = 'math-inline-view'
    this.dom.contentEditable = 'false'
    this.render()
    this.dom.addEventListener('dblclick', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.openEditor()
    })
  }

  private render() {
    this.dom.innerHTML = katex.renderToString(this.node.attrs.content || '\\,', {
      displayMode: false,
      throwOnError: false,
    })
  }

  private openEditor() {
    useStore.getState().openModal({
      kind: 'math',
      pos: this.getPos() ?? 0,
      initial: this.node.attrs.content,
      inline: true,
    })
  }

  update(node: Node) {
    if (node.type.name !== 'math_inline') return false
    if (node.attrs.content !== this.node.attrs.content) {
      this.node = node
      this.render()
    } else {
      this.node = node
    }
    return true
  }

  selectNode() {
    this.dom.classList.add('ProseMirror-selectednode')
  }

  deselectNode() {
    this.dom.classList.remove('ProseMirror-selectednode')
  }

  stopEvent() {
    return true
  }

  ignoreMutation() {
    return true
  }
}

class MathBlockView implements NodeView {
  dom: HTMLDivElement
  node: Node
  view: EditorView
  getPos: () => number | undefined
  private content: HTMLDivElement

  constructor(node: Node, view: EditorView, getPos: () => number | undefined) {
    this.node = node
    this.view = view
    this.getPos = getPos
    this.dom = document.createElement('div')
    this.dom.className = 'math-block-view'
    this.content = document.createElement('div')
    this.content.className = 'math-block-content'
    this.render()
  }

  private render() {
    this.dom.innerHTML = ''
    const header = document.createElement('div')
    header.className = 'mb-header'
    const label = document.createElement('span')
    label.textContent = '公式'
    const edit = document.createElement('button')
    edit.className = 'cb-btn'
    edit.textContent = '编辑公式'
    edit.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
    })
    edit.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.openEditor()
    })
    header.appendChild(label)
    header.appendChild(edit)
    this.content = document.createElement('div')
    this.content.className = 'math-block-content'
    this.content.innerHTML = katex.renderToString(this.node.attrs.content, {
      displayMode: true,
      throwOnError: false,
    })
    this.dom.appendChild(header)
    this.dom.appendChild(this.content)
    this.dom.addEventListener('dblclick', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.openEditor()
    })
  }

  private openEditor() {
    useStore.getState().openModal({
      kind: 'math',
      pos: this.getPos() ?? 0,
      initial: this.node.attrs.content,
    })
  }

  update(node: Node) {
    if (node.type.name !== 'math_block') return false
    if (node.attrs.content !== this.node.attrs.content) {
      this.node = node
      this.render()
    } else {
      this.node = node
    }
    return true
  }

  selectNode() {
    this.dom.classList.add('ProseMirror-selectednode')
  }

  deselectNode() {
    this.dom.classList.remove('ProseMirror-selectednode')
  }

  stopEvent() {
    return true
  }

  ignoreMutation() {
    return true
  }
}

class ImageView implements NodeView {
  dom: HTMLSpanElement
  node: Node
  view: EditorView
  getPos: () => number | undefined
  private img: HTMLImageElement

  constructor(node: Node, view: EditorView, getPos: () => number | undefined) {
    this.node = node
    this.view = view
    this.getPos = getPos
    this.dom = document.createElement('span')
    this.dom.className = 'image-view'
    this.dom.draggable = true
    this.img = document.createElement('img')
    this.img.draggable = false
    this.dom.appendChild(this.img)
    this.dom.addEventListener('dblclick', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.openEditor()
    })
    // 单击选中节点（使 Ctrl+C 有明确的 NodeSelection 目标）
    this.dom.addEventListener('click', (e) => {
      const pos = this.getPos()
      if (pos == null) return
      const sel = this.view.state.selection
      const already = sel instanceof NodeSelection && sel.from === pos
      if (!already) {
        try {
          this.view.dispatch(this.view.state.tr.setSelection(NodeSelection.create(this.view.state.doc, pos)))
          this.view.focus()
        } catch {}
      }
      e.stopPropagation()
    })
    // 阻止图片内部拖拽默认行为，由 ProseMirror 接管
    this.img.addEventListener('dragstart', (e) => {
      // 让 ProseMirror 的拖拽处理能获取 node 信息
      e.stopPropagation()
    })
    this.setImg()
  }

  private setImg() {
    this.img.src = resolveImgSrc(this.node.attrs.src)
    this.img.alt = this.node.attrs.alt || ''
    this.img.title = this.node.attrs.title || ''
    this.img.loading = 'lazy'
    if (this.node.attrs.width) this.img.setAttribute('width', String(this.node.attrs.width))
    else this.img.removeAttribute('width')
    if (this.node.attrs.height) this.img.setAttribute('height', String(this.node.attrs.height))
    else this.img.removeAttribute('height')
    // 若有显式尺寸，覆盖 max-width，保留用户指定大小（配合表格 180 场景）
    if (this.node.attrs.width || this.node.attrs.height) {
      this.img.style.maxWidth = 'none'
      if (this.node.attrs.width) this.img.style.width = /^\d+$/.test(String(this.node.attrs.width)) ? this.node.attrs.width + 'px' : String(this.node.attrs.width)
      if (this.node.attrs.height) this.img.style.height = /^\d+$/.test(String(this.node.attrs.height)) ? this.node.attrs.height + 'px' : String(this.node.attrs.height)
    } else {
      this.img.style.maxWidth = ''
      this.img.style.width = ''
      this.img.style.height = ''
    }
  }

  private openEditor() {
    useStore.getState().openModal({
      kind: 'image',
      pos: this.getPos() ?? 0,
      initial: this.node.attrs.src || '',
      language: JSON.stringify({ alt: this.node.attrs.alt || '', title: this.node.attrs.title || '' }),
    })
  }

  update(node: Node) {
    if (node.type.name !== 'image') return false
    if (
      node.attrs.src !== this.node.attrs.src ||
      node.attrs.alt !== this.node.attrs.alt ||
      node.attrs.title !== this.node.attrs.title ||
      node.attrs.width !== this.node.attrs.width ||
      node.attrs.height !== this.node.attrs.height
    ) {
      this.node = node
      this.setImg()
    } else {
      this.node = node
    }
    return true
  }

  selectNode() {
    this.dom.classList.add('ProseMirror-selectednode')
  }

  deselectNode() {
    this.dom.classList.remove('ProseMirror-selectednode')
  }

  stopEvent(event: Event) {
    const t = event.type
    // 让 ProseMirror 接管选中与剪贴板相关事件，确保图片可被选中/复制/拖拽
    if (
      t === 'mousedown' ||
      t === 'mouseup' ||
      t === 'click' ||
      t === 'dblclick' ||
      t === 'copy' ||
      t === 'cut' ||
      t === 'paste' ||
      t === 'dragstart' ||
      t === 'dragend' ||
      t === 'drop'
    )
      return false
    return true
  }

  ignoreMutation() {
    return true
  }
}

export function buildNodeViews(): Record<string, NodeViewConstructor> {
  return {
    code_block: (n, v, g) => new CodeBlockView(n, v, g),
    math_inline: (n, v, g) => new MathInlineView(n, v, g),
    math_block: (n, v, g) => new MathBlockView(n, v, g),
    image: (n, v, g) => new ImageView(n, v, g),
  }
}
