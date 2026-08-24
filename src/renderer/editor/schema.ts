import { Schema } from 'prosemirror-model'

export const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: {
      content: 'inline*',
      group: 'block',
      parseDOM: [{ tag: 'p' }],
      toDOM: () => ['p', 0],
    },
    blockquote: {
      content: 'block+',
      group: 'block',
      parseDOM: [{ tag: 'blockquote' }],
      toDOM: () => ['blockquote', 0],
    },
    horizontal_rule: {
      group: 'block',
      attrs: { markup: { default: '---' } },
      parseDOM: [{ tag: 'hr' }],
      toDOM: (node) => ['hr', { 'data-markup': node.attrs.markup }],
    },
    heading: {
      content: 'inline*',
      group: 'block',
      defining: true,
      attrs: { level: { default: 1 } },
      parseDOM: [
        { tag: 'h1', attrs: { level: 1 } },
        { tag: 'h2', attrs: { level: 2 } },
        { tag: 'h3', attrs: { level: 3 } },
        { tag: 'h4', attrs: { level: 4 } },
        { tag: 'h5', attrs: { level: 5 } },
        { tag: 'h6', attrs: { level: 6 } },
      ],
      toDOM: (node) => ['h' + node.attrs.level, 0],
    },
    code_block: {
      content: 'text*',
      group: 'block',
      code: true,
      defining: true,
      marks: '',
      attrs: { language: { default: null } },
      parseDOM: [
        {
          tag: 'pre',
          preserveWhitespace: 'full',
          getAttrs: (el) => ({ language: (el as HTMLElement).getAttribute('data-language') || null }),
        },
      ],
      toDOM: (node) => ['pre', { 'data-language': node.attrs.language || null, class: 'hljs-code' }, ['code', 0]],
    },
    text: { group: 'inline' },
    image: {
      inline: true,
      group: 'inline',
      draggable: true,
      attrs: { src: {}, alt: { default: null }, title: { default: null } },
      parseDOM: [
        {
          tag: 'img',
          getAttrs: (el) => ({
            src: (el as HTMLElement).getAttribute('src'),
            alt: (el as HTMLElement).getAttribute('alt'),
            title: (el as HTMLElement).getAttribute('title'),
          }),
        },
      ],
      toDOM: (node) => ['img', { src: node.attrs.src, alt: node.attrs.alt || null, title: node.attrs.title || null }],
    },
    hard_break: {
      inline: true,
      group: 'inline',
      selectable: false,
      parseDOM: [{ tag: 'br' }],
      toDOM: () => ['br'],
    },
    math_inline: {
      inline: true,
      group: 'inline',
      atom: true,
      selectable: true,
      attrs: { content: { default: '' } },
      parseDOM: [
        { tag: 'span.math-inline', getAttrs: (el) => ({ content: (el as HTMLElement).getAttribute('data-content') || '' }) },
      ],
      toDOM: (node) => ['span', { class: 'math-inline', 'data-content': node.attrs.content }],
    },
    math_block: {
      group: 'block',
      atom: true,
      attrs: { content: { default: '' } },
      parseDOM: [
        { tag: 'div.math-block', getAttrs: (el) => ({ content: (el as HTMLElement).getAttribute('data-content') || '' }) },
      ],
      toDOM: (node) => ['div', { class: 'math-block', 'data-content': node.attrs.content }],
    },
    ordered_list: {
      content: 'list_item+',
      group: 'block',
      attrs: { order: { default: 1 }, tight: { default: false } },
      parseDOM: [
        {
          tag: 'ol',
          getAttrs: (el) => ({
            order: (el as HTMLElement).hasAttribute('start') ? +(el as HTMLElement).getAttribute('start')! : 1,
            tight: (el as HTMLElement).hasAttribute('data-tight'),
          }),
        },
      ],
      toDOM: (node) => ['ol', { start: node.attrs.order === 1 ? null : node.attrs.order, 'data-tight': node.attrs.tight ? 'true' : null }, 0],
    },
    bullet_list: {
      content: 'list_item+',
      group: 'block',
      attrs: { tight: { default: false }, bullet: { default: null } },
      parseDOM: [{ tag: 'ul', getAttrs: (el) => ({ tight: (el as HTMLElement).hasAttribute('data-tight') }) }],
      toDOM: (node) => ['ul', { 'data-tight': node.attrs.tight ? 'true' : null }, 0],
    },
    list_item: {
      content: 'block+',
      defining: true,
      attrs: { checked: { default: null } },
      parseDOM: [
        {
          tag: 'li',
          getAttrs: (el) => ({
            checked: (el as HTMLElement).hasAttribute('data-checked')
              ? (el as HTMLElement).getAttribute('data-checked') === 'true'
              : null,
          }),
        },
      ],
      toDOM: (node) =>
        node.attrs.checked != null
          ? ['li', { 'data-checked': node.attrs.checked ? 'true' : 'false' }, 0]
          : ['li', 0],
    },
    table: {
      content: 'table_row+',
      group: 'block',
      isolating: true,
      attrs: { align: { default: null } },
      parseDOM: [{ tag: 'table' }],
      toDOM: () => ['table', { class: 'pm-table' }, ['tbody', 0]],
    },
    table_row: {
      content: 'table_cell+',
      isolating: true,
      parseDOM: [{ tag: 'tr' }],
      toDOM: () => ['tr', 0],
    },
    table_cell: {
      content: 'inline*',
      isolating: true,
      attrs: { header: { default: false }, align: { default: null } },
      parseDOM: [
        { tag: 'th', getAttrs: (el) => ({ header: true, align: (el as HTMLElement).style.textAlign || null }) },
        { tag: 'td', getAttrs: (el) => ({ header: false, align: (el as HTMLElement).style.textAlign || null }) },
      ],
      toDOM: (node) =>
        node.attrs.align
          ? [node.attrs.header ? 'th' : 'td', { style: 'text-align: ' + node.attrs.align }, 0]
          : [node.attrs.header ? 'th' : 'td', 0],
    },
  },
  marks: {
    em: { parseDOM: [{ tag: 'i' }, { tag: 'em' }, { style: 'font-style=italic' }], toDOM: () => ['em', 0] },
    strong: {
      parseDOM: [{ tag: 'strong' }, { tag: 'b' }, { style: 'font-weight=bold' }],
      toDOM: () => ['strong', 0],
    },
    link: {
      attrs: { href: {}, title: { default: null } },
      inclusive: false,
      parseDOM: [
        {
          tag: 'a',
          getAttrs: (el) => ({
            href: (el as HTMLElement).getAttribute('href'),
            title: (el as HTMLElement).getAttribute('title'),
          }),
        },
      ],
      toDOM: (node) => ['a', { href: node.attrs.href, title: node.attrs.title || null }, 0],
    },
    code: { parseDOM: [{ tag: 'code' }], toDOM: () => ['code', 0] },
    s: { parseDOM: [{ tag: 's' }, { tag: 'del' }, { tag: 'strike' }], toDOM: () => ['s', 0] },
  },
})
