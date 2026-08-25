import { MarkdownParser } from 'prosemirror-markdown'
import { DOMParser, type Node } from 'prosemirror-model'
import { schema } from './schema'
import { markdownIt } from './markdown'

function listIsTight(tokens: any[], i: number) {
  while (++i < tokens.length) if (tokens[i].type !== 'list_item_open') return tokens[i].hidden
  return false
}

export const mdParser = new MarkdownParser(schema, markdownIt, {
  blockquote: { block: 'blockquote' },
  paragraph: { block: 'paragraph' },
  list_item: {
    block: 'list_item',
    getAttrs: (tok: any) => {
      const c = tok.attrGet('checked')
      return c == null ? null : { checked: c === '1' }
    },
  },
  bullet_list: {
    block: 'bullet_list',
    getAttrs: (_tok: any, tokens: any[], i: number) => ({ tight: listIsTight(tokens, i) }),
  },
  ordered_list: {
    block: 'ordered_list',
    getAttrs: (tok: any, tokens: any[], i: number) => ({
      order: +tok.attrGet('start') || 1,
      tight: listIsTight(tokens, i),
    }),
  },
  heading: { block: 'heading', getAttrs: (tok: any) => ({ level: +tok.tag.slice(1) }) },
  code_block: { block: 'code_block', noCloseToken: true },
  fence: { block: 'code_block', getAttrs: (tok: any) => ({ language: tok.info.trim() || null }), noCloseToken: true },
  hr: { node: 'horizontal_rule' },
  image: {
    node: 'image',
    getAttrs: (tok: any) => ({
      src: tok.attrGet('src'),
      title: tok.attrGet('title') || null,
      alt: (tok.children && tok.children[0] && tok.children[0].content) || null,
    }),
  },
  hardbreak: { node: 'hard_break' },
  math_inline: { node: 'math_inline', getAttrs: (tok: any) => ({ content: tok.content }) },
  math_block: { node: 'math_block', getAttrs: (tok: any) => ({ content: tok.content }) },
  em: { mark: 'em' },
  strong: { mark: 'strong' },
  s: { mark: 's' },
  code_inline: { mark: 'code', noCloseToken: true },
  link: {
    mark: 'link',
    getAttrs: (tok: any) => ({ href: tok.attrGet('href'), title: tok.attrGet('title') || null }),
  },
  // 表格（markdown-it 把对齐信息放在 style 属性里）
  table: { block: 'table' },
  thead: { ignore: true },
  tbody: { ignore: true },
  tr: { block: 'table_row' },
  th: {
    block: 'table_cell',
    getAttrs: (tok: any) => {
      const style = tok.attrGet('style') || ''
      const m = /text-align:\s*(\w+)/.exec(style)
      return { header: true, align: m ? m[1] : null }
    },
  },
  td: {
    block: 'table_cell',
    getAttrs: (tok: any) => {
      const style = tok.attrGet('style') || ''
      const m = /text-align:\s*(\w+)/.exec(style)
      return { header: false, align: m ? m[1] : null }
    },
  },
})

// raw HTML 支持：markdown-it html:true 会产生 html_block / html_inline
// 通过 schema 的 DOMParser 将其整体还原为 ProseMirror 节点，解决 <table> 中 <a><img></a> 等嵌套无法渲染的问题
function parseHtmlFragment(html: string, state: any) {
  // Node 环境（单元测试）下 document 不可用，降级为文本
  if (typeof document === 'undefined') {
    state.addText(html)
    return
  }
  const wrap = document.createElement('div')
  wrap.innerHTML = html
  try {
    const slice = DOMParser.fromSchema(schema).parseSlice(wrap)
    let pushed = 0
    slice.content.forEach((node: Node) => {
      // 跳过空文本节点，避免产生多余空段落
      if (node.isText && !node.textContent?.trim()) return
      state.push(node)
      pushed++
    })
    // 若 DOMParser 未产出任何有效节点（例如纯空白或不被 schema 支持的标签），回退为文本避免内容丢失
    if (pushed === 0 && html.trim()) state.addText(html.trim())
  } catch {
    // 降级：作为纯文本插入，避免解析失败导致整段丢失
    state.addText(html)
  }
}
// html_block 包含完整块级 HTML（如整个 <table>...</table>）
;(mdParser as unknown as { tokenHandlers: Record<string, unknown> }).tokenHandlers['html_block'] = (
  state: unknown,
  tok: { content: string },
) => parseHtmlFragment(tok.content, state)
// html_inline 为行内 HTML 片段（如单个标签），尽力解析，失败则忽略
;(mdParser as unknown as { tokenHandlers: Record<string, unknown> }).tokenHandlers['html_inline'] = (
  state: unknown,
  tok: { content: string },
) => parseHtmlFragment(tok.content, state)

export function parseMarkdown(text: string): Node {
  const parsed = mdParser.parse(text)
  // 空文档补一个空段落，便于占位提示与后续输入
  if (parsed.content.size === 0) return schema.nodes.doc.createAndFill() ?? parsed
  return parsed
}
