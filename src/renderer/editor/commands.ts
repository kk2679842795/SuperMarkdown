import type { EditorView } from 'prosemirror-view'
import type { Node } from 'prosemirror-model'
import { Fragment } from 'prosemirror-model'
import { NodeSelection, TextSelection } from 'prosemirror-state'
import { setBlockType, toggleMark } from 'prosemirror-commands'
import { wrapInList } from 'prosemirror-schema-list'
import { schema } from './schema'
import { api } from '../api'
import { useStore } from '../store'

export const toggleStrong = toggleMark(schema.marks.strong)
export const toggleEm = toggleMark(schema.marks.em)
export const toggleStrike = toggleMark(schema.marks.s)
export const toggleCode = toggleMark(schema.marks.code)

export const toggleBulletList = wrapInList(schema.nodes.bullet_list)
export const toggleOrderedList = wrapInList(schema.nodes.ordered_list)

export function setHeading(level: number | null) {
  return level
    ? setBlockType(schema.nodes.heading, { level })
    : setBlockType(schema.nodes.paragraph)
}

export function insertHr(view: EditorView) {
  view.dispatch(view.state.tr.replaceSelectionWith(schema.nodes.horizontal_rule.create()))
  view.focus()
}

export function insertMathInline(view: EditorView, prefill = 'x^2') {
  const tr = view.state.tr.replaceSelectionWith(schema.nodes.math_inline.create({ content: prefill }))
  view.dispatch(tr)
  useStore.getState().openModal({ kind: 'math', pos: tr.selection.from, initial: prefill, inline: true })
}

export function insertMathBlock(view: EditorView, prefill = 'a^2 + b^2 = c^2') {
  const tr = view.state.tr.replaceSelectionWith(schema.nodes.math_block.create({ content: prefill }))
  view.dispatch(tr)
  useStore.getState().openModal({ kind: 'math', pos: tr.selection.from, initial: prefill })
}

export function insertCodeBlock(view: EditorView, language = 'typescript') {
  const { state } = view
  const prefill = state.doc.textBetween(state.selection.from, state.selection.to, '\n', ' ')
  const node = schema.nodes.code_block.create({ language }, schema.text(prefill))
  const tr = state.tr.replaceSelectionWith(node)
  view.dispatch(tr)
  useStore.getState().openModal({ kind: 'code', pos: tr.selection.from, initial: prefill, language })
}

export function insertMermaid(view: EditorView) {
  const { state } = view
  const prefill = 'flowchart TD\n    A[开始] --> B[结束]'
  const node = schema.nodes.code_block.create({ language: 'mermaid' }, schema.text(prefill))
  const tr = state.tr.replaceSelectionWith(node)
  view.dispatch(tr)
  useStore.getState().openModal({ kind: 'code', pos: tr.selection.from, initial: prefill, language: 'mermaid' })
}

export function insertImage(view: EditorView, src: string, alt: string, title: string) {
  const node = schema.nodes.image.create({ src, alt: alt || null, title: title || null })
  const info = findValidImagePos(view, view.state.selection.from)
  if (info.wrapInParagraph) {
    const para = schema.nodes.paragraph.create(null, node)
    let tr = view.state.tr.replaceWith(info.pos, info.pos, para)
    tr = tr.setSelection(TextSelection.create(tr.doc, info.pos + para.nodeSize - 1))
    view.dispatch(tr)
  } else {
    let tr = view.state.tr.replaceWith(info.pos, info.pos, node)
    tr = tr.setSelection(TextSelection.create(tr.doc, info.pos + node.nodeSize))
    view.dispatch(tr)
  }
  view.focus()
}

export function updateImageAt(view: EditorView, pos: number, src: string, alt: string, title: string) {
  view.dispatch(view.state.tr.setNodeMarkup(pos, null, { src, alt: alt || null, title: title || null }))
  view.focus()
}

export function addLink(view: EditorView, href: string, title = '') {
  const { state } = view
  const mark = schema.marks.link.create({ href, title: title || null })
  if (state.selection.empty) {
    const node = schema.text(href, [mark])
    view.dispatch(state.tr.replaceSelectionWith(node))
  } else {
    view.dispatch(state.tr.addMark(state.selection.from, state.selection.to, mark))
  }
  view.focus()
}

export function toggleTaskList(view: EditorView) {
  const { state } = view
  const sel = state.selection
  const items: { pos: number; node: Node }[] = []
  state.doc.nodesBetween(sel.from, sel.to, (n, pos) => {
    if (n.type.name === 'list_item') items.push({ pos, node: n })
  })

  if (items.length === 0) {
    // 普通段落 -> 包裹为任务列表
    const cmd = wrapInList(schema.nodes.bullet_list)
    if (cmd(state, view.dispatch)) {
      const s2 = view.state
      const newItems: { pos: number; node: Node }[] = []
      s2.doc.nodesBetween(s2.selection.from, s2.selection.to, (n, pos) => {
        if (n.type.name === 'list_item') newItems.push({ pos, node: n })
      })
      const tr = s2.tr
      newItems.forEach((it) => tr.setNodeMarkup(it.pos, null, { checked: true }))
      view.dispatch(tr)
    }
  } else {
    const allChecked = items.every((it) => it.node.attrs.checked === true)
    const tr = state.tr
    items.forEach((it) => tr.setNodeMarkup(it.pos, null, { checked: !allChecked }))
    view.dispatch(tr)
  }
  view.focus()
}

export function insertTable(view: EditorView, rows: number, cols: number) {
  const r = Math.max(1, Math.min(10, Math.floor(rows)))
  const c = Math.max(1, Math.min(10, Math.floor(cols)))
  const makeCell = (header: boolean) => schema.nodes.table_cell.create({ header }, null)
  const makeRow = (header: boolean) =>
    schema.nodes.table_row.create(null, Array.from({ length: c }, () => makeCell(header)))
  const table = schema.nodes.table.create(null, [
    makeRow(true),
    ...Array.from({ length: Math.max(0, r - 1) }, () => makeRow(false)),
  ])
  view.dispatch(view.state.tr.replaceSelectionWith(table))
  // 选中第一个单元格
  const sel = view.state.selection
  if (sel instanceof NodeSelection && sel.node.type.name === 'table') {
    const p = sel.from + 3
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, p, p)))
  }
  view.focus()
}

// 点击任务列表勾选框
export function handleEditorClick(view: EditorView, event: MouseEvent): boolean {
  const target = event.target as HTMLElement
  const li = target.closest('li[data-checked]')
  if (!li) return false
  const rect = li.getBoundingClientRect()
  if (event.clientX - rect.left > 26) return false
  const pos = view.posAtDOM(li, 0)
  if (pos == null) return false
  const res = view.state.doc.resolve(pos)
  for (let d = res.depth; d > 0; d--) {
    if (res.node(d).type.name === 'list_item') {
      const checked = !res.node(d).attrs.checked
      view.dispatch(view.state.tr.setNodeMarkup(res.before(d), null, { checked }))
      return true
    }
  }
  return false
}

// ---------- 图片粘贴 / 拖拽 ----------

function getImageFile(files: FileList | null): File | null {
  if (!files || !files.length) return null
  return Array.from(files).find((f) => f.type.startsWith('image/')) ?? null
}

async function persistImage(file: File): Promise<string> {
  const dataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('读取图片失败'))
    reader.readAsDataURL(file)
  })
  const tab = useStore.getState().activeTab()
  if (!tab?.path) return dataUrl
  const dir = tab.path.split(/[\\/]/).slice(0, -1).join('/') || '.'
  const res = await api.imageSave(dataUrl, dir)
  return res?.rel ?? dataUrl
}

async function insertImageAt(view: EditorView, file: File, pos: number) {
  try {
    const src = await persistImage(file)
    const info = findValidImagePos(view, pos)
    const node = schema.nodes.image.create({ src, alt: file.name || '', title: null })
    let tr: typeof view.state.tr
    if (info.wrapInParagraph) {
      const para = schema.nodes.paragraph.create(null, node)
      tr = view.state.tr.replaceWith(info.pos, info.pos, para)
      tr = tr.setSelection(TextSelection.create(tr.doc, info.pos + para.nodeSize - 1))
    } else {
      tr = view.state.tr.replaceWith(info.pos, info.pos, node)
      tr = tr.setSelection(TextSelection.create(tr.doc, info.pos + node.nodeSize))
    }
    view.dispatch(tr)
    view.focus()
  } catch (e) {
    useStore.getState().notify('图片插入失败：' + String(e))
  }
}

// 找到最近一个能容纳 inline image 的位置；若当前位置不允许 inline，则回退到最近文本块或提示需包裹段落
function findValidImagePos(
  view: EditorView,
  pos: number,
): { pos: number; wrapInParagraph: boolean } {
  const doc = view.state.doc
  if (doc.childCount === 0) return { pos: 0, wrapInParagraph: true }
  const clamped = Math.max(0, Math.min(pos, doc.content.size))
  try {
    const $pos = doc.resolve(clamped)
    // 直接在 inline 容器中
    if ($pos.parent && $pos.parent.type.validContent(Fragment.from(schema.nodes.image.create({ src: '' })))) {
      return { pos: clamped, wrapInParagraph: false }
    }
    // 向上查找最近的 textblock 祖先
    for (let d = $pos.depth; d > 0; d--) {
      const node = $pos.node(d)
      if (node.isTextblock && node.type.validContent(Fragment.from(schema.nodes.image.create({ src: '' })))) {
        const start = $pos.start(d)
        const end = $pos.end(d)
        // 若原 pos 在该块内，返回原 pos；否则返回块末尾前
        if (clamped >= start && clamped <= end) return { pos: clamped, wrapInParagraph: false }
        return { pos: end - 1, wrapInParagraph: false }
      }
    }
  } catch {
    /* fallthrough */
  }
  // 位于块间隙或表格/代码块等不允许 inline 的位置：插入新段落承载图片
  return { pos: clamped, wrapInParagraph: true }
}

export function handleEditorPaste(view: EditorView, event: ClipboardEvent): boolean {
  const file = getImageFile(event.clipboardData?.files ?? null)
  if (!file) return false
  event.preventDefault()
  // 立刻快照位置（异步保存图片期间用户可能继续输入导致 selection 漂移）
  const pos = view.state.selection.from
  void insertImageAt(view, file, pos)
  return true
}

export function handleEditorDrop(view: EditorView, event: DragEvent): boolean {
  const file = getImageFile(event.dataTransfer?.files ?? null)
  if (!file) return false
  const coords = view.posAtCoords({ left: event.clientX, top: event.clientY })
  event.preventDefault()
  const pos = coords?.pos ?? view.state.selection.from
  void insertImageAt(view, file, pos)
  return true
}

// ---------- 图片复制 ----------

function absoluteImagePath(src: string): string | null {
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

export function handleEditorCopy(view: EditorView, event: ClipboardEvent): boolean {
  const sel = view.state.selection
  // 仅处理单张图片的 NodeSelection
  if (!(sel instanceof NodeSelection) || sel.node.type.name !== 'image') return false
  const node = sel.node
  const src: string = node.attrs.src || ''
  const alt: string = node.attrs.alt || ''
  const title: string = node.attrs.title || ''
  // 剪贴板纯文本：Markdown 语法，便于粘贴到其他 Markdown 编辑器
  const md = title ? `![${alt}](${src} "${title.replace(/"/g, '\\"')}")` : `![${alt}](${src})`
  // 剪贴板 HTML：带 img 标签
  const html = `<img src="${src.replace(/"/g, '&quot;')}" alt="${alt.replace(/"/g, '&quot;')}"${title ? ` title="${title.replace(/"/g, '&quot;')}"` : ''}>`
  try {
    event.clipboardData?.setData('text/plain', md)
    event.clipboardData?.setData('text/html', html)
  } catch {
    /* ignore */
  }
  // 尝试异步把图片文件本身写入剪贴板（支持粘贴为图片到聊天/文档）
  const abs = absoluteImagePath(src)
  if (abs && event.clipboardData) {
    // 同步已写入文本/HTML，这里异步增强为二进制图片
    void (async () => {
      try {
        const dataUrl = await api.readImageAsDataUrl(abs)
        if (!dataUrl) return
        const m = /^data:(image\/[a-zA-Z+.-]+);base64,(.*)$/s.exec(dataUrl)
        if (!m) return
        const mime = m[1]
        const bin = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0))
        const blob = new Blob([bin], { type: mime })
        // 现代 Clipboard API：写入图片
        const nav = navigator as unknown as { clipboard?: { write?: (items: unknown[]) => Promise<void> } }
        const ClipboardItemCtor = (globalThis as unknown as { ClipboardItem?: new (d: Record<string, Blob>) => unknown }).ClipboardItem
        if (nav.clipboard?.write && ClipboardItemCtor) {
          try {
            await nav.clipboard.write([new ClipboardItemCtor({ [mime]: blob })])
          } catch {
            /* 忽略，用户已通过文本/HTML 获得复制内容 */
          }
        }
      } catch {
        /* ignore */
      }
    })()
  }
  event.preventDefault()
  // 剪切时删除选中节点
  if (event.type === 'cut') {
    view.dispatch(view.state.tr.deleteSelection())
    view.focus()
  }
  return true
}
