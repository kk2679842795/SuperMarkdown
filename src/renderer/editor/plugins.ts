import { Plugin, PluginKey, TextSelection, type EditorState } from 'prosemirror-state'
import { keymap } from 'prosemirror-keymap'
import { baseKeymap, toggleMark } from 'prosemirror-commands'
import { history, undo, redo } from 'prosemirror-history'
import {
  inputRules,
  InputRule,
  wrappingInputRule,
  textblockTypeInputRule,
} from 'prosemirror-inputrules'
import { gapCursor } from 'prosemirror-gapcursor'
import { dropCursor } from 'prosemirror-dropcursor'
import { Decoration, DecorationSet, type EditorView } from 'prosemirror-view'
import { schema } from './schema'
import { searchPlugin } from './search'

function placeholder(text: string) {
  const key = new PluginKey('placeholder')
  return new Plugin({
    key,
    props: {
      decorations(state: EditorState) {
        const doc = state.doc
        // 仅当文档是单个空段落时显示占位
        const empty =
          doc.childCount === 1 &&
          doc.firstChild?.isTextblock === true &&
          doc.firstChild.content.size === 0
        if (!empty) return DecorationSet.empty
        const deco = Decoration.widget(
          1,
          () => {
            const el = document.createElement('span')
            el.className = 'pm-placeholder'
            el.textContent = text
            return el
          },
          { side: -1 },
        )
        return DecorationSet.create(doc, [deco])
      },
    },
  })
}

// 表格内 Tab / Shift+Tab 单元格导航
function tableNav() {
  return new Plugin({
    props: {
      handleKeyDown(view: EditorView, event: KeyboardEvent) {
        if (event.key !== 'Tab') return false
        const sel = view.state.selection
        const cellNode = sel.$from.node(sel.$from.depth)
        if (!cellNode || cellNode.type.name !== 'table_cell') return false
        event.preventDefault()
        moveCell(view, event.shiftKey ? -1 : 1)
        return true
      },
    },
  })
}

function moveCell(view: EditorView, dir: 1 | -1) {
  const { state } = view
  const sel = state.selection
  const depth = sel.$from.depth
  const cell = sel.$from.node(depth)
  const row = sel.$from.node(depth - 1)
  const table = sel.$from.node(depth - 2)
  if (!cell || !row || !table || table.type.name !== 'table') return

  let rowIndex = -1
  let cellIndex = -1
  for (let r = 0; r < table.childCount; r++) if (table.child(r) === row) rowIndex = r
  for (let c = 0; c < row.childCount; c++) if (row.child(c) === cell) cellIndex = c
  if (rowIndex < 0 || cellIndex < 0) return

  let nr = rowIndex
  let nc = cellIndex + dir
  if (nc < 0 || nc >= row.childCount) {
    nr += dir
    nc = dir === 1 ? 0 : (table.child(nr)?.childCount ?? 0) - 1
  }
  if (nr < 0 || nr >= table.childCount) return

  const targetRow = table.child(nr)
  const targetCell = targetRow.child(nc)
  const cellPos = sel.$from.before(depth)

  let offset = 0
  for (let r = 0; r < rowIndex; r++) offset += table.child(r).nodeSize
  for (let c = 0; c < cellIndex; c++) offset += row.child(c).nodeSize
  let toff = 0
  for (let r = 0; r < nr; r++) toff += table.child(r).nodeSize
  for (let c = 0; c < nc; c++) toff += targetRow.child(c).nodeSize

  const targetPos = cellPos + (toff - offset)
  const size = Math.max(1, targetCell.content.size - 1)
  view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, targetPos + 1, targetPos + 1 + size)).scrollIntoView())
}

const blockQuoteRule = wrappingInputRule(/^\s*>\s$/, schema.nodes.blockquote)
const orderedListRule = wrappingInputRule(
  /^(\d+)\.\s$/,
  schema.nodes.ordered_list,
  (match) => ({ order: +match[1] }),
  (match, node) => node.childCount + node.attrs.order === +match[1],
)
const bulletListRule = wrappingInputRule(/^\s*([-+*])\s$/, schema.nodes.bullet_list)
const codeBlockRule = textblockTypeInputRule(/^```$/, schema.nodes.code_block)
const headingRule = textblockTypeInputRule(
  /^(#{1,6})\s$/,
  schema.nodes.heading,
  (match) => ({ level: match[1].length }),
)
const hrRule = new InputRule(/^(?:---|___\s|\*\*\*\s)$/, (state, match, start, end) => {
  return state.tr.replaceWith(start, end, schema.nodes.horizontal_rule.create())
})

// 专注模式：除光标所在顶层块外，其余块半透明
function focusPlugin() {
  const key = new PluginKey('focus-mode')
  return new Plugin({
    key,
    props: {
      decorations(state: EditorState) {
        // 动态从 store 读取，保证切换后立即生效（下一次 transaction 即刷新）
        let enabled = false
        try {
          // 避免循环依赖，延迟读取
          const mod = (globalThis as unknown as { __smStore?: { getState: () => { focusMode: boolean } } }).__smStore
          if (mod) enabled = mod.getState().focusMode
          else {
            // 回退：直接读 localStorage
            enabled = localStorage.getItem('sm-focus') === '1'
          }
        } catch {
          enabled = false
        }
        if (!enabled) return DecorationSet.empty
        const { selection } = state
        const activePos = selection.from
        // 找到光标所在顶层块在 doc 中的 [from, to]
        let activeFrom = -1
        let activeTo = -1
        let offset = 0
        for (let i = 0; i < state.doc.childCount; i++) {
          const child = state.doc.child(i)
          const from = offset
          const to = offset + child.nodeSize
          // selection.from 在 [from, to) 之间即为该块（ProseMirror positions：doc 起始为 0，第一个块从 0 开始）
          if (activePos >= from && activePos < to) {
            activeFrom = from
            activeTo = to
            break
          }
          offset = to
        }
        if (activeFrom < 0) return DecorationSet.empty
        const decos: Decoration[] = []
        offset = 0
        for (let i = 0; i < state.doc.childCount; i++) {
          const child = state.doc.child(i)
          const from = offset
          const to = offset + child.nodeSize
          if (from !== activeFrom) {
            decos.push(Decoration.node(from, to, { class: 'focus-dim' }))
          }
          offset = to
        }
        return DecorationSet.create(state.doc, decos)
      },
    },
  })
}

// 打字机模式：光标始终保持在视口垂直居中
function typewriterPlugin() {
  const key = new PluginKey('typewriter')
  let raf = 0
  return new Plugin({
    key,
    view() {
      return {
        update(view: EditorView, prevState: EditorState) {
          let enabled = false
          try {
            const mod = (globalThis as unknown as { __smStore?: { getState: () => { typewriterMode: boolean } } }).__smStore
            if (mod) enabled = mod.getState().typewriterMode
            else enabled = localStorage.getItem('sm-typewriter') === '1'
          } catch {
            enabled = false
          }
          if (!enabled) return
          // 仅当选区变化时触发
          if (prevState.selection.eq(view.state.selection)) return
          if (raf) cancelAnimationFrame(raf)
          raf = requestAnimationFrame(() => {
            const sel = view.state.selection
            // 将选区头部对应的 DOM 位置滚动至容器垂直居中
            const coords = view.coordsAtPos(sel.head)
            const host = view.dom.closest('.pm-host') as HTMLElement | null
            const container = host ?? (view.dom.parentElement as HTMLElement | null)
            if (!container) return
            const rect = container.getBoundingClientRect()
            const targetTop = coords.top - rect.top + container.scrollTop - rect.height / 2 + 24
            container.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' })
          })
        },
        destroy() {
          if (raf) cancelAnimationFrame(raf)
        },
      }
    },
  })
}

export function createPlugins(openLinkModal: () => void) {
  return [
    history(),
    keymap({
      'Mod-z': undo,
      'Shift-Mod-z': redo,
      'Mod-y': redo,
      'Mod-b': toggleMark(schema.marks.strong),
      'Mod-i': toggleMark(schema.marks.em),
      'Mod-`': toggleMark(schema.marks.code),
      'Mod-Shift-x': toggleMark(schema.marks.s),
      'Mod-k': () => {
        openLinkModal()
        return true
      },
    }),
    keymap(baseKeymap),
    inputRules({
      rules: [blockQuoteRule, orderedListRule, bulletListRule, codeBlockRule, headingRule, hrRule],
    }),
    gapCursor(),
    dropCursor(),
    tableNav(),
    searchPlugin,
    focusPlugin(),
    typewriterPlugin(),
    placeholder('开始输入… 支持 Markdown 语法，Ctrl+S 保存'),
  ]
}
