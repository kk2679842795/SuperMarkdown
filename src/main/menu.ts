import { app, BrowserWindow, Menu, type MenuItemConstructorOptions } from 'electron'

const isDev = !!process.env.VITE_DEV_SERVER_URL

function send(action: string) {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  win?.webContents.send('menu:action', action)
}

export function buildAppMenu() {
  const isMac = process.platform === 'darwin'

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about', label: '关于 SuperMarkdown' },
              { type: 'separator' },
              { role: 'hide', label: '隐藏' },
              { role: 'hideOthers', label: '隐藏其他' },
              { role: 'unhide', label: '全部显示' },
              { type: 'separator' },
              { role: 'quit', label: '退出 SuperMarkdown' },
            ],
          } as MenuItemConstructorOptions,
        ]
      : []),
    {
      label: '文件',
      submenu: [
        { label: '新建', accelerator: 'CmdOrCtrl+N', click: () => send('new') },
        { label: '打开…', accelerator: 'CmdOrCtrl+O', click: () => send('open') },
        { label: '打开文件夹…', accelerator: 'CmdOrCtrl+Shift+O', click: () => send('open-folder') },
        { type: 'separator' },
        { label: '保存', accelerator: 'CmdOrCtrl+S', click: () => send('save') },
        { label: '另存为…', accelerator: 'CmdOrCtrl+Shift+S', click: () => send('save-as') },
        { type: 'separator' },
        { label: '导出为 HTML…', click: () => send('export-html') },
        { label: '导出为 PDF…', click: () => send('export-pdf') },
        { type: 'separator' },
        isMac
          ? ({ role: 'close', label: '关闭窗口' } as MenuItemConstructorOptions)
          : ({ role: 'quit', label: '退出' } as MenuItemConstructorOptions),
      ],
    },
    {
      label: '编辑',
      submenu: [
        // 撤销/重做走 ProseMirror 自身历史，不能用 role: 'undo'/'redo'（原生撤销对 ProseMirror 无效）
        { label: '撤销', accelerator: 'CmdOrCtrl+Z', click: () => send('undo') },
        {
          label: '重做',
          accelerator: isMac ? 'Shift+CmdOrCtrl+Z' : 'CmdOrCtrl+Y',
          click: () => send('redo'),
        },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { label: '切换侧边栏', accelerator: 'CmdOrCtrl+B', click: () => send('toggle-sidebar') },
        { label: '切换大纲', accelerator: 'CmdOrCtrl+Shift+L', click: () => send('toggle-outline') },
        { label: '切换主题', accelerator: 'CmdOrCtrl+Shift+T', click: () => send('toggle-theme') },
        { type: 'separator' },
        { role: 'resetZoom', label: '实际大小' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' },
        ...(isDev ? [{ type: 'separator' as const }, { role: 'toggleDevTools' as const, label: '开发者工具' }] : []),
      ],
    },
    {
      label: '帮助',
      submenu: [
        { label: '项目主页 (GitCode)', click: () => send('open-home') },
        { label: '支持我们（爱发电）', click: () => send('donate') },
        { type: 'separator' },
        { label: '关于 SuperMarkdown', click: () => send('about') },
      ],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// 编辑区右键菜单：撤销/重做走渲染进程历史，剪贴板用原生 role
export function showContextMenu(win: BrowserWindow) {
  const isMac = process.platform === 'darwin'
  const menu = Menu.buildFromTemplate([
    { label: '撤销', accelerator: 'CmdOrCtrl+Z', click: () => send('undo') },
    {
      label: '重做',
      accelerator: isMac ? 'Shift+CmdOrCtrl+Z' : 'CmdOrCtrl+Y',
      click: () => send('redo'),
    },
    { type: 'separator' },
    { role: 'cut', label: '剪切' },
    { role: 'copy', label: '复制' },
    { role: 'paste', label: '粘贴' },
    { role: 'selectAll', label: '全选' },
    { type: 'separator' },
    { label: '插入链接…', accelerator: 'CmdOrCtrl+K', click: () => send('insert-link') },
    { label: '插入图片…', click: () => send('insert-image') },
    { type: 'separator' },
    { label: '查找与替换…', accelerator: 'CmdOrCtrl+F', click: () => send('open-search') },
  ])
  menu.popup({ window: win })
}
