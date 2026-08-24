import { MarkdownSerializer } from 'prosemirror-markdown'
import { schema } from './schema'

function codeDelim(parent: any): string {
  let max = 0
  const text = parent.textContent || ''
  const re = /`+/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) max = Math.max(max, m[0].length)
  return '`'.repeat(max + 1)
}

function needSpace(t: string | undefined): boolean {
  return !!t && (/^[ `]|[ `]$/.test(t))
}

export const mdSerializer = new MarkdownSerializer(
  {
    blockquote(state, node) {
      state.wrapBlock('> ', null, node, () => state.renderContent(node))
    },
    code_block(state, node) {
      const backticks = node.textContent.match(/`{3,}/gm)
      const fence = backticks ? backticks.sort().slice(-1)[0] + '`' : '```'
      const info = node.attrs.language || ''
      state.write(fence + info + '\n')
      state.text(node.textContent, false)
      state.ensureNewLine()
      state.write(fence)
      state.closeBlock(node)
    },
    heading(state, node) {
      state.write(state.repeat('#', node.attrs.level) + ' ')
      state.renderInline(node)
      state.closeBlock(node)
    },
    horizontal_rule(state, node) {
      state.write(node.attrs.markup || '---')
      state.closeBlock(node)
    },
    bullet_list(state, node) {
      state.renderList(node, '  ', () => (node.attrs.bullet || '*') + ' ')
    },
    ordered_list(state, node) {
      const start = node.attrs.order || 1
      const maxW = String(start + node.childCount - 1).length
      const space = state.repeat(' ', maxW + 2)
      state.renderList(node, space, (i) => {
        const n = String(start + i)
        return state.repeat(' ', maxW - n.length) + n + '. '
      })
    },
    list_item(state, node) {
      if (node.attrs.checked != null) state.write(node.attrs.checked ? '[x] ' : '[ ] ')
      state.renderContent(node)
    },
    paragraph(state, node) {
      state.renderInline(node)
      state.closeBlock(node)
    },
    image(state, node) {
      state.write(
        '![' +
          state.esc(node.attrs.alt || '') +
          '](' +
          node.attrs.src.replace(/[()]/g, '\\$&') +
          (node.attrs.title ? ' "' + node.attrs.title.replace(/"/g, '\\"') + '"' : '') +
          ')',
      )
    },
    hard_break(state, node, parent, index) {
      for (let i = index + 1; i < parent.childCount; i++) {
        if (parent.child(i).type.name !== 'hard_break') {
          state.write('\\\n')
          return
        }
      }
    },
    text(state, node) {
      state.text(node.text || '')
    },
    math_inline(state, node) {
      state.write('$' + node.attrs.content + '$')
    },
    math_block(state, node) {
      state.write('$$\n' + node.attrs.content + '\n$$')
      state.closeBlock(node)
    },
    table(state, node) {
      const inlineText = (cell: any) => {
        const para = schema.nodes.paragraph.create(null, cell.content)
        return mdSerializer
          .serialize(para)
          .replace(/\n$/, '')
          .replace(/\|/g, '\\|')
          .replace(/\n/g, ' ')
      }
      for (let r = 0; r < node.childCount; r++) {
        const row = node.child(r)
        const cells: string[] = []
        const aligns: (string | null)[] = []
        for (let c = 0; c < row.childCount; c++) {
          cells.push(inlineText(row.child(c)))
          aligns.push(row.child(c).attrs.align || null)
        }
        state.write('| ' + cells.join(' | ') + ' |\n')
        if (r === 0 && row.child(0)?.attrs.header) {
          state.write(
            '|' +
              aligns
                .map((a) => {
                  if (a === 'center') return ':---:'
                  if (a === 'right') return '---:'
                  if (a === 'left') return ':---'
                  return '---'
                })
                .join('|') +
              '|\n',
          )
        }
      }
      state.closeBlock(node)
    },
  },
  {
    em: { open: '*', close: '*', mixable: true, expelEnclosingWhitespace: true },
    strong: { open: '**', close: '**', mixable: true, expelEnclosingWhitespace: true },
    s: { open: '~~', close: '~~', mixable: true, expelEnclosingWhitespace: true },
    code: {
      open(state, _mark, parent, index) {
        const d = codeDelim(parent)
        return needSpace(parent.child(index)?.text) ? d + ' ' : d
      },
      close(state, _mark, parent, index) {
        const d = codeDelim(parent)
        return needSpace(parent.child(index - 1)?.text) ? ' ' + d : d
      },
      mixable: false,
    },
    link: {
      open() {
        return '['
      },
      close(state, mark) {
        const href = state.esc(mark.attrs.href)
        return '](' + href + (mark.attrs.title ? ' "' + mark.attrs.title.replace(/"/g, '\\"') + '"' : '') + ')'
      },
      mixable: false,
    },
  },
)
