// 测试主进程 PDF 导出链路：大 HTML 字符串的 data URL 加载 + printToPDF
import { app, BrowserWindow } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function makeBigHtml() {
  // 复用 export-test 的构建逻辑：直接请求 vite 构建? 简化：拼一个含中文字符和 CSS 的大字符串
  const base = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'editor', 'katexEmbedded.css'), 'utf-8')
  const content = `
  <h1>测试导出 PDF</h1>
  <p>中文内容测试：公式 $e^{i\\pi}+1=0$、Mermaid 图、任务列表等。</p>
  <p>${'重复文本。'.repeat(2000)}</p>
  <style>${base}</style>
  <script>window.__mdReady = true;<\/script>`
  return '<!doctype html><html><head><meta charset="utf-8"></head><body>' + content + '</body></html>'
}

app.whenReady().then(async () => {
  const html = await makeBigHtml()
  console.log('HTML 大小:', (html.length / 1024 / 1024).toFixed(2), 'MB')
  const win = new BrowserWindow({ show: false, width: 900, height: 1200, webPreferences: { sandbox: true, contextIsolation: true } })
  try {
    const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(html)
    console.log('data URL 大小:', (dataUrl.length / 1024 / 1024).toFixed(2), 'MB')
    await win.loadURL(dataUrl)
    console.log('[loadURL] 成功')
    await new Promise((resolve) => {
      const timer = setInterval(async () => {
        try {
          const ready = await win.webContents.executeJavaScript('window.__mdReady === true')
          if (ready) { clearInterval(timer); resolve() }
        } catch { clearInterval(timer); resolve() }
      }, 250)
      setTimeout(() => { clearInterval(timer); resolve() }, 15000)
    })
    const data = await win.webContents.printToPDF({ printBackground: true, pageSize: 'A4', margins: { marginType: 'default' } })
    console.log('[printToPDF] 成功，PDF 大小:', (data.length / 1024).toFixed(0), 'KB')
    fs.writeFileSync(path.join(__dirname, '..', 'out', 'test-export.pdf'), data)
    console.log('[saved] out/test-export.pdf')
  } catch (e) {
    console.log('[FAIL]', String(e && e.message || e))
  }
  app.quit()
})
