import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { buildAppMenu, showContextMenu } from './menu'

const isDev = !!process.env.VITE_DEV_SERVER_URL
let mainWindow: BrowserWindow | null = null
let pdfWindow: BrowserWindow | null = null

const OPENABLE_EXT = /\.(md|markdown|txt)$/i

function extractOpenFilePath(argv: string[]): string | null {
  for (const arg of argv.slice(1)) {
    if (!arg.startsWith('-') && OPENABLE_EXT.test(arg)) return path.resolve(arg)
  }
  return null
}

// 通过命令行/右键菜单打开的待处理文件（窗口未就绪时先暂存）
// 注意：必须放在 OPENABLE_EXT 声明之后（const 无提升）
let pendingOpenFile: string | null = extractOpenFilePath(process.argv)

async function openExternalFile(filePath: string) {
  const win = mainWindow ?? BrowserWindow.getAllWindows()[0]
  if (!win) return
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8')
    win.webContents.send('open-file', filePath, content)
  } catch (err) {
    dialog.showErrorBox('打开失败', `无法读取文件：\n${filePath}\n\n${String(err)}`)
  }
}

function recentFilePath() {
  return path.join(app.getPath('userData'), 'recent.json')
}

function readRecent(): string[] {
  try {
    return JSON.parse(fs.readFileSync(recentFilePath(), 'utf-8'))
  } catch {
    return []
  }
}

function writeRecent(list: string[]) {
  try {
    fs.writeFileSync(recentFilePath(), JSON.stringify(list, null, 2), 'utf-8')
  } catch {
    /* 忽略 */
  }
}

function createWindow() {
  const isMac = process.platform === 'darwin'
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 800,
    minHeight: 560,
    show: false,
    backgroundColor: '#fafafa',
    ...(isMac
      ? { titleBarStyle: 'hiddenInset' as const }
      : { frame: false as const }),
    ...(process.platform === 'win32'
      ? { icon: path.join(__dirname, '../../build/icon.png') }
      : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false,
      spellcheck: true,
    },
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.on('maximize', () => mainWindow?.webContents.send('window:maximized-change', true))
  mainWindow.on('unmaximize', () => mainWindow?.webContents.send('window:maximized-change', false))
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL!)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

function registerIpc() {
  ipcMain.on('window:min', () => mainWindow?.minimize())
  ipcMain.on('window:max', () => {
    if (!mainWindow) return
    if (mainWindow.isMaximized()) mainWindow.unmaximize()
    else mainWindow.maximize()
  })
  ipcMain.on('window:close', () => mainWindow?.close())
  ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() ?? false)

  ipcMain.handle('file:read', async (_e, p: string) => fs.promises.readFile(p, 'utf-8'))

  ipcMain.handle('file:write', async (_e, p: string, content: string) => {
    await fs.promises.writeFile(p, content, 'utf-8')
    return true
  })

  ipcMain.handle('file:readDir', async (_e, p: string) => {
    const entries = await fs.promises.readdir(p, { withFileTypes: true })
    return entries
      .filter((e) => e.isDirectory() || /\.(md|markdown|txt)$/i.test(e.name))
      .map((e) => ({ name: e.name, path: path.join(p, e.name), type: e.isDirectory() ? 'dir' : 'file' }))
      .sort((a, b) =>
        a.type === b.type ? a.name.localeCompare(b.name, 'zh-CN') : a.type === 'dir' ? -1 : 1,
      )
  })

  // 保存粘贴/拖入的图片到文档同目录的 assets/ 文件夹
  ipcMain.handle('image:save', async (_e, dataUrl: string, dir: string) => {
    const m = /^data:(image\/[a-zA-Z+.-]+);base64,(.*)$/s.exec(dataUrl)
    if (!m) return null
    const extMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/svg+xml': 'svg',
      'image/bmp': 'bmp',
      'image/avif': 'avif',
    }
    const ext = extMap[m[1]] || 'png'
    const assetsDir = path.join(dir, 'assets')
    await fs.promises.mkdir(assetsDir, { recursive: true })
    const name = `img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`
    const full = path.join(assetsDir, name)
    await fs.promises.writeFile(full, Buffer.from(m[2], 'base64'))
    return { path: full, rel: path.join('assets', name) }
  })

  ipcMain.handle('dialog:openFile', async () => {
    const r = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile'],
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }],
    })
    if (r.canceled || !r.filePaths[0]) return null
    const p = r.filePaths[0]
    return { path: p, content: await fs.promises.readFile(p, 'utf-8') }
  })

  ipcMain.handle('dialog:saveFile', async (_e, content: string, defaultName: string) => {
    const r = await dialog.showSaveDialog(mainWindow!, {
      defaultPath: defaultName || '未命名.md',
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
    })
    if (r.canceled || !r.filePath) return null
    await fs.promises.writeFile(r.filePath, content, 'utf-8')
    return { path: r.filePath }
  })

  ipcMain.handle('dialog:openFolder', async () => {
    const r = await dialog.showOpenDialog(mainWindow!, { properties: ['openDirectory'] })
    return r.canceled ? null : r.filePaths[0]
  })

  ipcMain.handle('recent:get', () => readRecent())
  ipcMain.handle('recent:add', (_e, p: string) => {
    const list = [p, ...readRecent().filter((x) => x !== p)].slice(0, 10)
    writeRecent(list)
    return list
  })
  ipcMain.handle('recent:clear', () => {
    writeRecent([])
    return []
  })

  ipcMain.handle('export:html', async (_e, html: string, defaultName: string) => {
    const r = await dialog.showSaveDialog(mainWindow!, {
      defaultPath: defaultName || 'export.html',
      filters: [{ name: 'HTML', extensions: ['html'] }],
    })
    if (r.canceled || !r.filePath) return { ok: false }
    await fs.promises.writeFile(r.filePath, html, 'utf-8')
    return { ok: true, path: r.filePath }
  })

  ipcMain.handle('export:pdf', async (_e, html: string, defaultName: string) => {
    const r = await dialog.showSaveDialog(mainWindow!, {
      defaultPath: defaultName || 'export.pdf',
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    })
    if (r.canceled || !r.filePath) return { ok: false }

    pdfWindow = new BrowserWindow({
      show: false,
      width: 900,
      height: 1200,
      webPreferences: { sandbox: true, contextIsolation: true },
    })
    try {
      await pdfWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
      // 等待导出页面的渲染完成信号（公式、图表已内联为静态内容）
      await new Promise<void>((resolve, reject) => {
        const started = Date.now()
        const timer = setInterval(async () => {
          try {
            const ready = await pdfWindow!.webContents.executeJavaScript('window.__mdReady === true')
            if (ready || Date.now() - started > 20000) {
              clearInterval(timer)
              resolve()
            }
          } catch (err) {
            clearInterval(timer)
            reject(err instanceof Error ? err : new Error(String(err)))
          }
        }, 250)
      })
      const data = await pdfWindow.webContents.printToPDF({
        printBackground: true,
        pageSize: 'A4',
        margins: { marginType: 'default' },
      })
      await fs.promises.writeFile(r.filePath, data)
      return { ok: true, path: r.filePath }
    } catch (err) {
      console.error('PDF 导出失败:', err)
      return { ok: false, error: String(err) }
    } finally {
      pdfWindow?.destroy()
      pdfWindow = null
    }
  })

  ipcMain.on('shell:showItem', (_e, p: string) => shell.showItemInFolder(p))
  ipcMain.on('shell:openExternal', (_e, url: string) => shell.openExternal(url))

  ipcMain.on('context-menu:show', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (win) showContextMenu(win)
  })

  // 渲染进程就绪后取走启动时待打开的文件
  ipcMain.handle('open-file:take', async () => {
    const p = pendingOpenFile
    if (!p) return null
    pendingOpenFile = null
    try {
      return { path: p, content: await fs.promises.readFile(p, 'utf-8') }
    } catch (err) {
      dialog.showErrorBox('打开失败', `无法读取文件：\n${p}\n\n${String(err)}`)
      return null
    }
  })
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', (_e, argv) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
    // 已有实例运行时，把新启动携带的文件路径转发给现有窗口
    const f = extractOpenFilePath(argv)
    if (f) void openExternalFile(f)
  })

  app.whenReady().then(() => {
    app.setAppUserModelId('com.supermarkdown.app')
    registerIpc()
    buildAppMenu()
    createWindow()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
