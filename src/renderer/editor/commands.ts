import type { EditorView } from 'prosemirror-view'
import type { Node } from 'prosemirror-model'
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
  view.dispatch(view.state.tr.replaceSelectionWith(node))
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
    const node = schema.nodes.image.create({ src, alt: file.name || '', title: null })
    view.dispatch(view.state.tr.replaceSelectionWith(node, pos === view.state.selection.from))
    view.focus()
  } catch (e) {
    useStore.getState().notify('图片插入失败：' + String(e))
  }
}

export function handleEditorPaste(view: EditorView, event: ClipboardEvent): boolean {
  const file = getImageFile(event.clipboardData?.files ?? null)
  if (!file) return false
  event.preventDefault()
  void insertImageAt(view, file, view.state.selection.from)
  return true
}

export function handleEditorDrop(view: EditorView, event: DragEvent): boolean {
  const file = getImageFile(event.dataTransfer?.files ?? null)
  if (!file) return false
  const coords = view.posAtCoords({ left: event.clientX, top: event.clientY })
  event.preventDefault()
  void insertImageAt(view, file, coords?.pos ?? view.state.selection.from)
  return true
}
