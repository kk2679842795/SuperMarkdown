// 核心逻辑回归测试：解析 -> 序列化 -> 再解析 的往返一致性
import { parseMarkdown } from '../src/renderer/editor/parser'
import { mdSerializer } from '../src/renderer/editor/serializer'
import { WELCOME } from '../src/renderer/welcome'

const doc = parseMarkdown(WELCOME)
const out = mdSerializer.serialize(doc)

const asserts: [string, boolean][] = [
  ['标题保留', out.includes('# 欢迎使用 SuperMarkdown')],
  ['任务列表已完成项', /\[x\] 支持任务列表语法/.test(out)],
  ['任务列表未完成项', /\[ \] 研究更多高级功能/.test(out)],
  ['行内公式', out.includes('$e^{i\\pi} + 1 = 0$')],
  ['块级公式', out.includes('$$') && out.includes('e^{-x^2}')],
  ['Mermaid 围栏', out.includes('```mermaid')],
  ['代码块围栏', out.includes('```typescript')],
  ['表格保留', out.includes('| 功能 | 状态 | 备注 |')],
  ['表格分隔行', out.includes(':---')],
  ['删除线', out.includes('~~')],
  ['链接', /\[[^\]]+\]\([^)]+\)/.test(out)],
  ['引用', out.includes('> 本文档演示了核心能力')],
  ['分隔线', out.includes('---')],
]

let fail = 0
for (const [name, ok] of asserts) {
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name)
  if (!ok) fail++
}

// 往返：把序列化结果再解析，文本内容应一致
const doc2 = parseMarkdown(out)
const t1 = doc.textContent.replace(/\s+/g, ' ')
const t2 = doc2.textContent.replace(/\s+/g, ' ')
const roundtrip = t1 === t2
console.log((roundtrip ? 'PASS' : 'FAIL') + '  往返解析文本一致')
if (!roundtrip) {
  console.log('--- 原文 textContent (前 300 字):')
  console.log(t1.slice(0, 300))
  console.log('--- 往返后 textContent (前 300 字):')
  console.log(t2.slice(0, 300))
  fail++
}

// 独立片段往返测试
const frags = [
  'a `b` c',
  '| a | b |\n| :--- | ---: |\n| 1 | 2 |',
  '- a\n  - b\n- c',
  '$$\nx = 1\n$$',
  '**粗** 与 *斜* 与 ~~删~~',
  '[链接](https://example.com "标题")',
  '> 引用\n> 第二行',
  '```js\nconst a = 1\n```',
]
for (const src of frags) {
  const d = parseMarkdown(src)
  const s = mdSerializer.serialize(d)
  const ok = d.textContent.replace(/\s+/g, '') === parseMarkdown(s).textContent.replace(/\s+/g, '')
  console.log((ok ? 'PASS' : 'FAIL') + '  片段往返: ' + JSON.stringify(src).slice(0, 50))
  if (!ok) {
    console.log('   src:', JSON.stringify(src))
    console.log('   out:', JSON.stringify(s))
    fail++
  }
}

console.log(fail === 0 ? '\n全部通过 ✅' : `\n${fail} 项失败 ❌`)
process.exit(fail === 0 ? 0 : 1)
