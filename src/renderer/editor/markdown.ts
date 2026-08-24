import MarkdownIt from 'markdown-it'

// $...$ 行内公式 与 $$...$$ 块级公式（不解析、仅产出 token）
function mathPlugin(md: MarkdownIt) {
  md.inline.ruler.before('escape', 'math_inline', (state: any, silent: boolean) => {
    const src = state.src
    const start = state.pos
    if (src[start] !== '$') return false
    if (src[start + 1] === '$') return false
    const end = src.indexOf('$', start + 1)
    if (end === -1) return false
    if (src[end + 1] === '$') return false
    const content = src.slice(start + 1, end)
    if (!content || /^[ \t]|[ \t]$/.test(content)) return false
    if (!silent) {
      const token = state.push('math_inline', 'math', 0)
      token.content = content
      token.markup = '$'
    }
    state.pos = end + 1
    return true
  })

  md.block.ruler.before('fence', 'math_block', (state: any, startLine: number, endLine: number, silent: boolean) => {
    const start = state.bMarks[startLine] + state.tShift[startLine]
    const max = state.eMarks[startLine]
    const line = state.src.slice(start, max)
    if (line.trim() !== '$$') return false

    let found = -1
    let nextLine = startLine + 1
    for (let l = startLine + 1; l < endLine; l++) {
      const s = state.bMarks[l] + state.tShift[l]
      if (state.src.slice(s, state.eMarks[l]).trim() === '$$') {
        found = l
        nextLine = l + 1
        break
      }
    }
    if (found === -1) return false

    const contentLines: string[] = []
    for (let l = startLine + 1; l < found; l++) {
      contentLines.push(state.src.slice(state.bMarks[l] + state.tShift[l], state.eMarks[l]))
    }
    if (!silent) {
      const token = state.push('math_block', 'math', 0)
      token.content = contentLines.join('\n')
      token.map = [startLine, nextLine]
      token.markup = '$$'
    }
    state.line = nextLine
    return true
  })
}

// GFM 任务列表：把 "- [ ] item" 的勾选状态写进 list_item_open 的 attrs
function taskListPlugin(md: MarkdownIt) {
  md.core.ruler.after('inline', 'task_list', (state: any) => {
    const tokens = state.tokens
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i]
      if (tok.type !== 'list_item_open') continue
      let depth = 0
      for (let j = i + 1; j < tokens.length; j++) {
        const t = tokens[j]
        if (t.type === 'list_item_open') {
          depth++
          continue
        }
        if (t.type === 'list_item_close') {
          if (depth === 0) break
          depth--
          continue
        }
        if (t.type === 'inline' && depth === 0 && t.children && t.children.length) {
          const first = t.children[0]
          if (first.type === 'text') {
            const m = /^\[([ xX])\]\s+/.exec(first.content)
            if (m) {
              tok.attrSet('checked', m[1] === ' ' ? '0' : '1')
              first.content = first.content.slice(m[0].length)
              if (first.content === '') t.children.shift()
            }
          }
          break
        }
      }
    }
  })
}

// 解析用 markdown-it 实例（默认预设已开启 table / strikethrough）
export const markdownIt = new MarkdownIt({ html: false, linkify: true })
  .use(mathPlugin)
  .use(taskListPlugin)
