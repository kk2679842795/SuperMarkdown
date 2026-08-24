// 验证脚本：检查编辑器关键区域是否渲染完整（多标签版）
import { app, BrowserWindow } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'verify-preload.cjs'),
      contextIsolation: false,
      nodeIntegration: false,
      sandbox: false,
    },
  })
  win.webContents.on('console-message', (event) => {
    const msg = typeof event === 'object' && event !== null && 'message' in event ? event.message : String(event)
    const level = typeof event === 'object' && event !== null && 'level' in event ? event.level : ''
    if (level === 'error' || level === 'warning') console.log(`[console:${level}] ${msg}`)
  })
  await win.loadURL('http://localhost:5173/')
  await new Promise((r) => setTimeout(r, 6000))
  const checks = await win.webContents.executeJavaScript(`(() => {
    const q = (s) => document.querySelector(s)
    const has = (s) => !!q(s)
    const pm = q('.pm-pane.active .ProseMirror')
    return {
      titlebar: has('.titlebar'),
      tabbar: has('.tabbar'),
      tabCount: document.querySelectorAll('.tab').length,
      toolbar: has('.toolbar'),
      sidebar: has('.sidebar'),
      statusbar: has('.statusbar'),
      editor: !!pm,
      editorText: pm ? pm.textContent.slice(0, 60) : '',
      headings: pm ? pm.querySelectorAll('h1,h2').length : 0,
      mathViews: pm ? pm.querySelectorAll('.math-inline-view,.math-block-view').length : 0,
      codeViews: pm ? pm.querySelectorAll('.cb').length : 0,
      taskItems: pm ? pm.querySelectorAll('li[data-checked]').length : 0,
      tables: pm ? pm.querySelectorAll('table').length : 0,
    }
  })()`)
  console.log(JSON.stringify(checks, null, 2))
  app.quit()
})
