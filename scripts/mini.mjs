import { app, BrowserWindow } from 'electron'
app.whenReady().then(async () => {
  console.log('[mini] ready')
  const win = new BrowserWindow({ show: false, width: 800, height: 600 })
  try {
    await win.loadURL('http://localhost:5173/')
    console.log('[mini] loaded')
    const r = await win.webContents.executeJavaScript('1+1')
    console.log('[mini] js:', r)
  } catch (e) {
    console.log('[mini] error:', String(e))
  }
  app.quit()
})
