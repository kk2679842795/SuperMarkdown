import { MarkdownParser } from 'prosemirror-markdown'
import type { Node } from 'prosemirror-model'
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

export function parseMarkdown(text: string): Node {
  const parsed = mdParser.parse(text)
  // 空文档补一个空段落，便于占位提示与后续输入
  if (parsed.content.size === 0) return schema.nodes.doc.createAndFill() ?? parsed
  return parsed
}
