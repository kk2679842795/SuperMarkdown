import { create } from 'zustand'
import { EditorState } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'
import { api } from './api'
import { mdSerializer } from './editor/serializer'
import { parseMarkdown } from './editor/parser'
import { createPlugins } from './editor/plugins'


export interface ModalState {
  kind: 'code' | 'math' | 'image' | 'link' | 'table'
  pos: number
  initial: string
  language?: string
  inline?: boolean
}

export interface FileNode {
  name: string
  path: string
  type: 'dir' | 'file'
  children?: FileNode[]
  loaded?: boolean
}

export interface OutlineItem {
  level: number
  text: string
  pos: number
}

export type SaveState = 'saved' | 'dirty' | 'saving'

function initZenMode(): boolean {
  return localStorage.getItem('sm-zen') === '1'
}
function initFocusMode(): boolean {
  return localStorage.getItem('sm-focus') === '1'
}
function initTypewriter(): boolean {
  return localStorage.getItem('sm-typewriter') === '1'
}

const EXTERNAL_SRC_RE = /^(data|https?|blob|file|smimg):/i

function parentDirOf(p: string): string {
  return p.split(/[\\/]/).slice(0, -1).join('/')
}

function sameDir(a: string, b: string): boolean {
  const norm = (x: string) => x.replace(/[\\/]+/g, '/').replace(/\/+$/, '').toLowerCase()
  return norm(a) === norm(b)
}

function isLocalRelativeSrc(s: string): boolean {
  if (!s || EXTERNAL_SRC_RE.test(s)) return false
  return !/^[A-Za-z]:[\\/]/.test(s) && !s.startsWith('/') && !s.startsWith('\\\\')
}

// 另存为时把旧目录中文档引用到的本地图片复制到新目录，保持相对路径引用有效
async function migrateAssetsOnSaveAs(
  oldDocPath: string,
  newDocPath: string,
  view: EditorView,
): Promise<{ copied: number; missing: number; failed: number }> {
  const oldDir = parentDirOf(oldDocPath)
  const newDir = parentDirOf(newDocPath)
  const result = { copied: 0, missing: 0, failed: 0 }
  if (!oldDocPath || !oldDir || !newDir || sameDir(oldDir, newDir)) return result
  const rels = new Set<string>()
  view.state.doc.descendants((node) => {
    if (node.type.name === 'image') {
      const s = String(node.attrs.src ?? '').replace(/\\/g, '/')
      if (isLocalRelativeSrc(s)) rels.add(s)
    }
    return true
  })
  for (const rel of rels) {
    try {
      const r = await api.copyFile(oldDir + '/' + rel, newDir + '/' + rel)
      if (r === 'ok') result.copied++
      else if (r === 'missing') result.missing++
      else result.failed++
    } catch {
      result.failed++
    }
  }
  return result
}

export interface Tab {
  id: string
  path: string | null
  name: string
  dirty: boolean
  saveState: SaveState
  /** 打开/新建时的初始内容（EditorPane 挂载时用于创建文档） */
  initial: string
}

export interface SearchState {
  open: boolean
  query: string
  replace: string
  caseSensitive: boolean
  /** 当前高亮的匹配序号（0-based） */
  current: number
  /** 当前文档匹配总数 */
  count: number
}

interface AppState {
  theme: 'light' | 'dark'
  sidebarOpen: boolean
  outlineOpen: boolean
  zenMode: boolean
  focusMode: boolean
  typewriterMode: boolean
  tabs: Tab[]
  activeTabId: string | null
  views: Record<string, EditorView>
  treeRoot: string | null
  tree: FileNode[] | null
  recents: string[]
  outline: OutlineItem[]
  words: number
  lines: number
  cursor: { line: number; col: number }
  modal: ModalState | null
  toast: string | null
  search: SearchState

  activeTab: () => Tab | null
  activeView: () => EditorView | null
  setView: (tabId: string, v: EditorView) => void
  removeView: (tabId: string) => void
  updateDocMeta: (tabId: string, view: EditorView, opts?: { markDirty?: boolean }) => void
  openPath: (path: string, content: string) => void
  newFile: () => void
  switchTab: (id: string) => void
  closeTab: (id: string) => void
  saveCurrent: (silent?: boolean) => Promise<void>
  saveCurrentAs: () => Promise<void>
  saveTab: (tabId: string, silent?: boolean) => Promise<void>
  loadRecents: () => Promise<void>
  removeRecent: (path: string) => Promise<void>
  openFolder: () => Promise<void>
  restoreWorkspace: () => Promise<void>
  loadDir: (dir: string) => Promise<FileNode[]>
  setTree: (tree: FileNode[] | null) => void
  setTreeRoot: (root: string | null) => void
  expandDir: (path: string) => Promise<void>
  collapseDir: (path: string) => void
  toggleTheme: () => void
  setSidebarOpen: (v: boolean) => void
  setOutlineOpen: (v: boolean) => void
  setZenMode: (v: boolean) => void
  toggleZenMode: () => void
  setFocusMode: (v: boolean) => void
  toggleFocusMode: () => void
  setTypewriterMode: (v: boolean) => void
  toggleTypewriterMode: () => void
  openModal: (m: ModalState) => void
  closeModal: () => void
  openLinkModal: () => void
  notify: (msg: string) => void
  setSearch: (partial: Partial<SearchState>) => void
}

let tabSeq = 0
let saveTimer: ReturnType<typeof setTimeout> | null = null
let toastTimer: ReturnType<typeof setTimeout> | null = null

const genTabId = () => 'tab-' + ++tabSeq
const baseName = (p: string) => p.split(/[\\/]/).pop() || '未命名.md'

function initTheme(): 'light' | 'dark' {
  const saved = localStorage.getItem('sm-theme')
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export const useStore = create<AppState>((set, get) => ({
  theme: initTheme(),
  sidebarOpen: true,
  outlineOpen: true,
  zenMode: initZenMode(),
  focusMode: initFocusMode(),
  typewriterMode: initTypewriter(),
  tabs: [],
  activeTabId: null,
  views: {},
  treeRoot: null,
  tree: null,
  recents: [],
  outline: [],
  words: 0,
  lines: 1,
  cursor: { line: 1, col: 1 },
  modal: null,
  toast: null,
  search: { open: false, query: '', replace: '', caseSensitive: false, current: 0, count: 0 },

  activeTab: () => {
    const s = get()
    return s.tabs.find((t) => t.id === s.activeTabId) ?? null
  },

  activeView: () => {
    const s = get()
    return (s.activeTabId && s.views[s.activeTabId]) || null
  },

  setView: (tabId, v) => set({ views: { ...get().views, [tabId]: v } }),

  removeView: (tabId) => {
    const views = { ...get().views }
    delete views[tabId]
    set({ views })
  },

  updateDocMeta: (tabId, view, opts) => {
    const doc = view.state.doc
    let words = 0
    doc.descendants((n) => {
      if (n.isText) words += (n.text || '').replace(/\s/g, '').length
    })
    const outline: OutlineItem[] = []
    doc.descendants((n, pos) => {
      if (n.type.name === 'heading') outline.push({ level: n.attrs.level, text: n.textContent, pos })
    })
    const head = view.state.selection.head
    const before = doc.textBetween(0, head, '\n', ' ')
    const line = before.split('\n').length
    const col = before.length - before.lastIndexOf('\n')
    set((s) => ({
      words,
      outline,
      lines: doc.textContent.split('\n').length,
      cursor: { line, col },
      tabs:
        opts?.markDirty === false
          ? s.tabs
          : s.tabs.map((t) => (t.id === tabId ? { ...t, dirty: true, saveState: 'dirty' as SaveState } : t)),
    }))
    if (opts?.markDirty !== false) {
      const tab = get().tabs.find((t) => t.id === tabId)
      if (tab?.path) {
        if (saveTimer) clearTimeout(saveTimer)
        saveTimer = setTimeout(() => {
          void get().saveTab(tabId, true)
        }, 1200)
      }
    }
  },

  openPath: (path, content) => {
    const { tabs } = get()
    const exist = tabs.find((t) => t.path === path)
    if (exist) {
      set({ activeTabId: exist.id })
      document.title = exist.name + ' - SuperMarkdown'
      return
    }
    const id = genTabId()
    const name = baseName(path)
    set({ tabs: [...tabs, { id, path, name, dirty: false, saveState: 'saved', initial: content }], activeTabId: id })
    document.title = name + ' - SuperMarkdown'
    void api.addRecent(path).then(() => get().loadRecents())
  },

  newFile: () => {
    const { tabs } = get()
    const id = genTabId()
    const tab: Tab = { id, path: null, name: '未命名.md', dirty: false, saveState: 'saved', initial: '' }
    set({ tabs: [...tabs, tab], activeTabId: id })
    document.title = '未命名.md - SuperMarkdown'
  },

  switchTab: (id) => {
    if (get().activeTabId === id) return
    set({ activeTabId: id })
    const tab = get().tabs.find((t) => t.id === id)
    const view = get().views[id]
    if (tab) document.title = tab.name + ' - SuperMarkdown'
    if (view) get().updateDocMeta(id, view, { markDirty: false })
  },

  closeTab: (id) => {
    const { tabs, activeTabId } = get()
    const idx = tabs.findIndex((t) => t.id === id)
    if (idx < 0) return
    const tab = tabs[idx]
    // 有路径且未保存则先保存
    if (tab.dirty && tab.path) void get().saveTab(id, false)
    let next = tabs.filter((t) => t.id !== id)
    if (next.length === 0) {
      // 全部关闭时回到开始页（空标签态），不再以欢迎文档顶替
      set({ tabs: [], activeTabId: null })
      document.title = 'SuperMarkdown'
      return
    }
    let newActive: string
    if (activeTabId === id) {
      newActive = next[Math.min(idx, next.length - 1)].id
    } else {
      newActive = activeTabId ?? next[0].id
    }
    set({ tabs: next, activeTabId: newActive })
    const nt = next.find((t) => t.id === newActive)
    if (nt) document.title = nt.name + ' - SuperMarkdown'
    const nv = get().views[newActive]
    if (nv) get().updateDocMeta(newActive, nv, { markDirty: false })
  },

  saveTab: async (tabId, silent) => {
    const view = get().views[tabId]
    const tab = get().tabs.find((t) => t.id === tabId)
    if (!view || !tab) return
    if (!tab.path) {
      if (silent) return
      return get().saveCurrentAs()
    }
    const md = mdSerializer.serialize(view.state.doc)
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, saveState: 'saving' as SaveState } : t)),
    }))
    try {
      await api.writeFile(tab.path, md)
      set((s) => ({
        tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, dirty: false, saveState: 'saved' as SaveState } : t)),
      }))
    } catch (e) {
      console.error('保存失败:', e)
      set((s) => ({
        tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, saveState: 'dirty' as SaveState } : t)),
      }))
      get().notify('保存失败：' + String(e))
    }
  },

  saveCurrent: async (silent) => {
    const tab = get().activeTab()
    if (!tab) return
    await get().saveTab(tab.id, silent)
  },

  saveCurrentAs: async () => {
    const tab = get().activeTab()
    const view = get().activeView()
    if (!tab || !view) return
    const md = mdSerializer.serialize(view.state.doc)
    const oldPath = tab.path
    const res = await api.saveFileDialog(md, tab.name)
    if (res?.path) {
      const name = baseName(res.path)
      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.id === tab.id ? { ...t, path: res.path, name, dirty: false, saveState: 'saved' as SaveState } : t,
        ),
      }))
      document.title = name + ' - SuperMarkdown'
      void api.addRecent(res.path).then(() => get().loadRecents())
      if (oldPath) {
        const m = await migrateAssetsOnSaveAs(oldPath, res.path, view)
        if (m.failed > 0) {
          get().notify(`另存为完成，但 ${m.failed} 个图片文件迁移失败`)
        }
      }
    }
  },

  loadRecents: async () => {
    set({ recents: await api.getRecent() })
  },

  // 单条删除最近记录：非乐观更新，以 API 返回列表为唯一事实来源；仅更新 recents，不触碰 tabs/views（编辑会话隔离）
  removeRecent: async (path) => {
    try {
      const next = await api.removeRecent(path)
      set({ recents: next })
    } catch {
      get().notify('删除失败，请重试')
    }
  },

  openFolder: async () => {
    const dir = await api.openFolderDialog()
    if (!dir) return
    const tree = await get().loadDir(dir)
    set({ treeRoot: dir, tree })
    void api.setWorkspaceFolder(dir)
  },

  // 启动时恢复上次打开的文件夹；主进程已校验存在性，此处加载失败再兜底清除记录，不弹错打扰
  restoreWorkspace: async () => {
    try {
      const dir = await api.getWorkspaceFolder()
      if (!dir || get().treeRoot) return
      const tree = await get().loadDir(dir)
      set({ treeRoot: dir, tree })
    } catch {
      void api.setWorkspaceFolder(null)
    }
  },

  loadDir: async (dir) => {
    const entries = await api.readDir(dir)
    return entries.map((e): FileNode => (e.type === 'dir' ? { ...e, loaded: false } : { ...e }))
  },

  setTree: (tree) => set({ tree }),
  setTreeRoot: (root) => set({ treeRoot: root }),

  expandDir: async (path) => {
    const tree = get().tree
    if (!tree) return
    const update = async (nodes: FileNode[]): Promise<FileNode[]> => {
      const out: FileNode[] = []
      for (const n of nodes) {
        if (n.type === 'dir' && n.path === path) {
          const children = await get().loadDir(path)
          out.push({ ...n, loaded: true, children })
        } else if (n.type === 'dir' && n.children) {
          out.push({ ...n, children: await update(n.children) })
        } else {
          out.push(n)
        }
      }
      return out
    }
    set({ tree: await update(tree) })
  },

  collapseDir: (path) => {
    const tree = get().tree
    if (!tree) return
    const update = (nodes: FileNode[]): FileNode[] =>
      nodes.map((n) => {
        if (n.type === 'dir' && n.path === path) return { ...n, children: undefined, loaded: false }
        if (n.type === 'dir' && n.children) return { ...n, children: update(n.children) }
        return n
      })
    set({ tree: update(tree) })
  },

  toggleTheme: () => {
    const theme = get().theme === 'light' ? 'dark' : 'light'
    localStorage.setItem('sm-theme', theme)
    document.documentElement.dataset.theme = theme
    set({ theme })
  },

  setSidebarOpen: (v) => set({ sidebarOpen: v }),
  setOutlineOpen: (v) => set({ outlineOpen: v }),
  setZenMode: (v) => {
    localStorage.setItem('sm-zen', v ? '1' : '0')
    try { document.documentElement.dataset.zen = v ? '1' : '0' } catch {}
    set({ zenMode: v })
  },
  toggleZenMode: () => {
    const v = !get().zenMode
    localStorage.setItem('sm-zen', v ? '1' : '0')
    try { document.documentElement.dataset.zen = v ? '1' : '0' } catch {}
    set({ zenMode: v })
    get().notify(v ? '已进入极简模式 — 按 Esc 或 F9 退出' : '已退出极简模式')
  },
  setFocusMode: (v) => {
    localStorage.setItem('sm-focus', v ? '1' : '0')
    try { document.documentElement.dataset.focus = v ? '1' : '0' } catch {}
    set({ focusMode: v })
  },
  toggleFocusMode: () => {
    const v = !get().focusMode
    localStorage.setItem('sm-focus', v ? '1' : '0')
    try { document.documentElement.dataset.focus = v ? '1' : '0' } catch {}
    set({ focusMode: v })
    get().notify(v ? '已开启专注模式' : '已关闭专注模式')
  },
  setTypewriterMode: (v) => {
    localStorage.setItem('sm-typewriter', v ? '1' : '0')
    try { document.documentElement.dataset.typewriter = v ? '1' : '0' } catch {}
    set({ typewriterMode: v })
  },
  toggleTypewriterMode: () => {
    const v = !get().typewriterMode
    localStorage.setItem('sm-typewriter', v ? '1' : '0')
    try { document.documentElement.dataset.typewriter = v ? '1' : '0' } catch {}
    set({ typewriterMode: v })
    get().notify(v ? '已开启打字机模式' : '已关闭打字机模式')
  },
  openModal: (m) => set({ modal: m }),
  closeModal: () => set({ modal: null }),

  openLinkModal: () => {
    const view = get().activeView()
    if (!view) return
    get().openModal({ kind: 'link', pos: view.state.selection.from, initial: '' })
  },

  notify: (msg) => {
    set({ toast: msg })
    if (toastTimer) clearTimeout(toastTimer)
    toastTimer = setTimeout(() => set({ toast: null }), 2600)
  },

  setSearch: (partial) => set({ search: { ...get().search, ...partial } }),
}))

document.documentElement.dataset.theme = useStore.getState().theme
// 启动即开始页（空标签态）：窗口标题不带「未命名.md」
if (useStore.getState().tabs.length === 0) document.title = 'SuperMarkdown'
// 供 editor 插件读取（专注/打字机）
;(globalThis as unknown as { __smStore?: typeof useStore }).__smStore = useStore
// 同步 zen/focus/typewriter 到 html dataset 便于 CSS（可选）
try {
  document.documentElement.dataset.zen = useStore.getState().zenMode ? '1' : '0'
  document.documentElement.dataset.focus = useStore.getState().focusMode ? '1' : '0'
  document.documentElement.dataset.typewriter = useStore.getState().typewriterMode ? '1' : '0'
} catch {
  /* ignore */
}
