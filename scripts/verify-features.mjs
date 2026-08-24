// 功能验证：多标签 / 搜索替换 / 图片粘贴（在真实渲染进程里执行）
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

  const result = await win.webContents.executeJavaScript(`(async () => {
    const out = {}
    const store = (await import('/src/renderer/store.ts')).useStore
    const search = await import('/src/renderer/editor/search.ts')

    // 1. 多标签
    const tab0 = store.getState().activeTabId
    store.getState().newFile() // 新建空白标签
    await new Promise(r => setTimeout(r, 300))
    out.tabCountAfterNew = document.querySelectorAll('.tab').length
    out.secondTabActive = store.getState().activeTabId !== tab0
    out.activeEditorHasPlaceholder = !!document.querySelector('.pm-pane.active .pm-placeholder')
    store.getState().switchTab(tab0)
    await new Promise(r => setTimeout(r, 300))
    out.switchBackActive = store.getState().activeTabId === tab0

    // 2. 搜索
    const view = store.getState().activeView()
    search.performSearch(view, 'Markdown', false)
    await new Promise(r => setTimeout(r, 300))
    out.searchMatchCount = document.querySelectorAll('.search-match').length
    out.searchCountLabel = document.querySelector('.searchbar-count')?.textContent
    search.nextMatch(view, 1)
    await new Promise(r => setTimeout(r, 200))
    out.hasCurrentMatch = !!document.querySelector('.search-match.current')

    // 3. 替换全部
    const docBefore = view.state.doc.textContent.length
    search.replaceAll(view, 'MD')
    await new Promise(r => setTimeout(r, 300))
    const docAfter = view.state.doc.textContent
    out.replaceAllDone = docAfter.includes('MD') && !docAfter.includes('Markdown')
    out.docLenChanged = docBefore !== view.state.doc.textContent.length
    search.closeSearch(view)

    // 4. 图片拖入
    const dt = new DataTransfer()
    const file = new File([new Blob(['fake-image-data'], { type: 'image/png' })], 'test.png', { type: 'image/png' })
    dt.items.add(file)
    const pm = document.querySelector('.pm-pane.active .ProseMirror')
    pm.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, clientX: 300, clientY: 300 }))
    await new Promise(r => setTimeout(r, 800))
    out.imageInserted = document.querySelectorAll('.pm-pane.active .image-view img').length > 0
    out.imageSrc = document.querySelector('.pm-pane.active .image-view img')?.getAttribute('src')?.slice(0, 30) || ''

    // 5. 关闭标签
    store.getState().closeTab(store.getState().activeTabId)
    await new Promise(r => setTimeout(r, 300))
    out.tabCountAfterClose = document.querySelectorAll('.tab').length

    // 收集 JS 错误
    out.jsErrors = window.__errs || []
    return out
  })()`)

  console.log(JSON.stringify(result, null, 2))
  app.quit()
})
