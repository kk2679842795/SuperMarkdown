// 把 katex.min.css 中的字体引用内联为 base64，生成自包含的 katexEmbedded.css
// 这样导出 HTML/PDF 时数学公式字体不依赖外部文件
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const cssPath = path.join(root, 'node_modules', 'katex', 'dist', 'katex.min.css')
const css = fs.readFileSync(cssPath, 'utf-8')

let count = 0
const inlined = css.replace(/url\(([^)]+)\)/g, (m, url) => {
  const clean = url.replace(/^["']|["']$/g, '')
  if (!clean.startsWith('fonts/')) return m
  const f = path.join(root, 'node_modules', 'katex', 'dist', clean)
  if (!fs.existsSync(f)) return m
  const data = fs.readFileSync(f)
  const ext = path.extname(f).slice(1)
  const mime = ext === 'woff2' ? 'font/woff2' : ext === 'woff' ? 'font/woff' : `font/${ext}`
  count++
  return `url(data:${mime};base64,${data.toString('base64')})`
})

const outDir = path.join(root, 'src', 'renderer', 'editor')
fs.mkdirSync(outDir, { recursive: true })
const out = path.join(outDir, 'katexEmbedded.css')
fs.writeFileSync(out, inlined)
console.log(`katexEmbedded.css 已生成 (内联 ${count} 个字体, ${(inlined.length / 1024).toFixed(0)} KB)`)
