import { Plugin, PluginKey, TextSelection, type EditorState } from 'prosemirror-state'
import { keymap } from 'prosemirror-keymap'
import { baseKeymap, toggleMark } from 'prosemirror-commands'
import { history } from 'prosemirror-history'
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

function placeholder(text: string) {
  const key = new PluginKey('placeholder')
  return new Plugin({
    key,
    props: {
      decorations(state: EditorState) {
        const doc = state.doc
        if (doc.content.size > 0) return DecorationSet.empty
        const deco = Decoration.widget(
          0,
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

export function createPlugins(openLinkModal: () => void) {
  return [
    history(),
    keymap({
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
    placeholder('开始输入… 支持 Markdown 语法，Ctrl+S 保存'),
  ]
}
