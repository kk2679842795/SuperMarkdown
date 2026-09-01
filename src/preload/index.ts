import { contextBridge, ipcRenderer } from 'electron'

const api = {
  platform: process.platform,
  isElectron: true,

  minWindow: () => ipcRenderer.send('window:min'),
  maxWindow: () => ipcRenderer.send('window:max'),
  closeWindow: () => ipcRenderer.send('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  onMaximizedChange: (cb: (v: boolean) => void) => {
    const l = (_e: unknown, v: boolean) => cb(v)
    ipcRenderer.on('window:maximized-change', l)
    return () => {
      ipcRenderer.removeListener('window:maximized-change', l)
    }
  },
  onMenuAction: (cb: (action: string) => void) => {
    const l = (_e: unknown, action: string) => cb(action)
    ipcRenderer.on('menu:action', l)
    return () => {
      ipcRenderer.removeListener('menu:action', l)
    }
  },
  showContextMenu: () => ipcRenderer.send('context-menu:show'),
  popAppMenu: () => ipcRenderer.send('app-menu:popup'),
  onOpenFile: (cb: (path: string, content: string) => void) => {
    const l = (_e: unknown, p: string, content: string) => cb(p, content)
    ipcRenderer.on('open-file', l)
    return () => {
      ipcRenderer.removeListener('open-file', l)
    }
  },
  takePendingOpenFile: (): Promise<{ path: string; content: string } | null> =>
    ipcRenderer.invoke('open-file:take'),

  readFile: (p: string) => ipcRenderer.invoke('file:read', p),
  writeFile: (p: string, content: string) => ipcRenderer.invoke('file:write', p, content),
  copyFile: (src: string, dest: string) => ipcRenderer.invoke('file:copy', src, dest),
  imageSave: (dataUrl: string, dir: string) => ipcRenderer.invoke('image:save', dataUrl, dir),
  readImageAsDataUrl: (filePath: string) => ipcRenderer.invoke('image:readAsDataUrl', filePath),
  openFileDialog: () => ipcRenderer.invoke('dialog:openFile'),
  saveFileDialog: (content: string, defaultName: string) =>
    ipcRenderer.invoke('dialog:saveFile', content, defaultName),
  openFolderDialog: () => ipcRenderer.invoke('dialog:openFolder'),
  readDir: (p: string) => ipcRenderer.invoke('file:readDir', p),

  getRecent: () => ipcRenderer.invoke('recent:get'),
  addRecent: (p: string) => ipcRenderer.invoke('recent:add', p),
  clearRecent: () => ipcRenderer.invoke('recent:clear'),
  removeRecent: (p: string): Promise<string[]> => ipcRenderer.invoke('recent:remove', p),

  getWorkspaceFolder: (): Promise<string | null> => ipcRenderer.invoke('workspace:get'),
  setWorkspaceFolder: (p: string | null): Promise<boolean> => ipcRenderer.invoke('workspace:set', p),

  exportHtml: (html: string, name: string) => ipcRenderer.invoke('export:html', html, name),
  exportPdf: (html: string, name: string) => ipcRenderer.invoke('export:pdf', html, name),

  showItemInFolder: (p: string) => ipcRenderer.send('shell:showItem', p),
  openExternal: (url: string) => ipcRenderer.send('shell:openExternal', url),
}

contextBridge.exposeInMainWorld('api', api)
