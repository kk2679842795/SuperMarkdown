// 验证：撤销/重做 / Ctrl+F 选区带入 / 输入即搜（分步执行）
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
    if (level === 'error') console.log('[console:error]', msg)
  })
  await win.loadURL('http://localhost:5173/')
  await new Promise((r) => setTimeout(r, 5000))

  const step = async (label, js, wait = 500) => {
    try {
      const r = await Promise.race([
        win.webContents.executeJavaScript(js),
        new Promise((_, rej) => setTimeout(() => rej(new Error(label + ' timeout')), 25000)),
      ])
      console.log(label + ':', JSON.stringify(r))
      await new Promise((res) => setTimeout(res, wait))
      return r
    } catch (e) {
      console.log(label + ': ERROR', String(e))
      app.quit()
      throw e
    }
  }

  // 准备：暴露 view/store 到 window
  await step(
    'setup',
    `(async () => {
      const store = (await import('/src/renderer/store.ts')).useStore
      const view = store.getState().activeView()
      window.__store = store
      window.__view = view
      window.__docText = () => view.state.doc.textContent
      window.__setQuery = (q) => store.getState().setSearch({ query: q })
      window.__errs = window.__errs || []
      return true
    })()`,
    300,
  )

  // 1. 撤销/重做
  await step(
    'undo-redo',
    `(async () => {
      const view = window.__view
      const before = view.state.doc.textContent
      view.dispatch(view.state.tr.insertText('UNDOTEST', view.state.selection.from))
      await new Promise(r => setTimeout(r, 100))
      const afterInsert = view.state.doc.textContent
      const undoBtn = document.querySelector('.tb-btn[title^="撤销"]')
      undoBtn.click()
      await new Promise(r => setTimeout(r, 200))
      const undoOk = view.state.doc.textContent === before
      const redoBtn = document.querySelector('.tb-btn[title^="重做"]')
      redoBtn.click()
      await new Promise(r => setTimeout(r, 200))
      const redoOk = view.state.doc.textContent === afterInsert
      return { undoOk, redoOk, hasUndoBtn: !!undoBtn, hasRedoBtn: !!redoBtn }
    })()`,
    300,
  )

  // 2. Ctrl+F 选区带入
  await step(
    'ctrl-f-selection',
    `(async () => {
      const view = window.__view
      // 用真实 doc 坐标定位第一个 "Markdown" 文本
      let idx = -1
      view.state.doc.descendants((n, p) => {
        if (idx < 0 && n.isText && n.text.includes('Markdown')) idx = p + n.text.indexOf('Markdown')
      })
      const selClass = view.state.selection.constructor
      view.dispatch(view.state.tr.setSelection(selClass.create(view.state.doc, idx, idx + 8)))
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', ctrlKey: true, bubbles: true }))
      await new Promise(r => setTimeout(r, 500))
      const input = document.querySelector('.searchbar-input')
      return {
        queryInBox: input ? input.value : '(no input)',
        highlights: document.querySelectorAll('.search-match').length,
      }
    })()`,
    400,
  )

  // 3. 输入即搜
  await step(
    'type-search',
    `(async () => {
      window.__setQuery('公式')
      await new Promise(r => setTimeout(r, 700))
      return {
        highlights: document.querySelectorAll('.search-match').length,
        countLabel: document.querySelector('.searchbar-count')?.textContent,
      }
    })()`,
    300,
  )

  // 4. JS 错误收集
  await step('js-errors', `window.__errs || []`, 0)
  app.quit()
})
