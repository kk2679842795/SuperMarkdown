export interface OpenResult {
  path: string
  content: string
}

export interface SaveResult {
  path: string
}

export interface DirEntry {
  name: string
  path: string
  type: 'dir' | 'file'
}

export interface AppApi {
  platform: string
  isElectron: boolean

  minWindow(): void
  maxWindow(): void
  closeWindow(): void
  isMaximized(): Promise<boolean>
  onMaximizedChange(cb: (v: boolean) => void): () => void
  onMenuAction(cb: (action: string) => void): () => void
  showContextMenu(): void
  popAppMenu(): void
  onOpenFile(cb: (path: string, content: string) => void): () => void
  takePendingOpenFile(): Promise<{ path: string; content: string } | null>

  readFile(p: string): Promise<string>
  writeFile(p: string, content: string): Promise<boolean>
  copyFile(src: string, dest: string): Promise<'ok' | 'missing' | 'error'>
  imageSave(dataUrl: string, dir: string): Promise<{ path: string; rel: string } | null>
  openFileDialog(): Promise<OpenResult | null>
  saveFileDialog(content: string, defaultName: string): Promise<SaveResult | null>
  openFolderDialog(): Promise<string | null>
  readDir(p: string): Promise<DirEntry[]>

  getRecent(): Promise<string[]>
  addRecent(p: string): Promise<string[]>
  clearRecent(): Promise<string[]>

  exportHtml(html: string, name: string): Promise<{ ok: boolean; path?: string; error?: string }>
  exportPdf(html: string, name: string): Promise<{ ok: boolean; path?: string; error?: string }>

  showItemInFolder(p: string): void
  openExternal(url: string): void
}

declare global {
  interface Window {
    api?: AppApi
  }
}

// ---------- 浏览器回退实现（用于网页预览 / 调试，无 Electron 时） ----------
function browserFallback(): AppApi {
  const recentsKey = 'sm-recents'
  const ls = (): string[] => {
    try {
      return JSON.parse(localStorage.getItem(recentsKey) || '[]')
    } catch {
      return []
    }
  }
  return {
    platform: 'browser',
    isElectron: false,
    minWindow() {},
    maxWindow() {},
    closeWindow() {},
    isMaximized: async () => false,
    onMaximizedChange: () => () => {},
    onMenuAction: () => () => {},
    showContextMenu() {},
    popAppMenu() {},
    onOpenFile: () => () => {},
    takePendingOpenFile: async () => null,
    readFile: async () => {
      throw new Error('浏览器模式不支持按路径读取文件')
    },
    writeFile: async () => true,
    copyFile: async () => 'error',
    imageSave: async (dataUrl) => ({ path: dataUrl, rel: dataUrl }),
    openFileDialog: async () => {
      return new Promise((resolve) => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.md,.markdown,.txt'
        input.onchange = async () => {
          const f = input.files?.[0]
          if (!f) return resolve(null)
          const content = await f.text()
          resolve({ path: f.name, content })
        }
        input.click()
      })
    },
    saveFileDialog: async (content, defaultName) => {
      const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = defaultName || '未命名.md'
      a.click()
      URL.revokeObjectURL(url)
      return { path: defaultName || '未命名.md' }
    },
    openFolderDialog: async () => null,
    readDir: async () => [],
    getRecent: async () => ls(),
    addRecent: async (p) => {
      const l = [p, ...ls().filter((x) => x !== p)].slice(0, 10)
      localStorage.setItem(recentsKey, JSON.stringify(l))
      return l
    },
    clearRecent: async () => {
      localStorage.removeItem(recentsKey)
      return []
    },
    exportHtml: async (html, name) => {
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = name || 'export.html'
      a.click()
      URL.revokeObjectURL(url)
      return { ok: true, path: name }
    },
    exportPdf: async (html) => {
      const w = window.open('', '_blank')
      if (!w) return { ok: false, error: '弹窗被浏览器拦截，请手动打开' }
      w.document.open()
      w.document.write(html)
      w.document.close()
      setTimeout(() => {
        try {
          w.print()
        } catch {
          /* 忽略 */
        }
      }, 1200)
      return { ok: true }
    },
    showItemInFolder() {},
    openExternal(url: string) {
      window.open(url, '_blank')
    },
  }
}

export const api: AppApi = window.api ?? browserFallback()
