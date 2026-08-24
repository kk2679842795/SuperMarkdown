import { create } from 'zustand'
import { EditorState } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'
import { api } from './api'
import { mdSerializer } from './editor/serializer'
import { parseMarkdown } from './editor/parser'
import { createPlugins } from './editor/plugins'
import { WELCOME } from './welcome'

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

interface AppState {
  theme: 'light' | 'dark'
  sidebarOpen: boolean
  outlineOpen: boolean
  currentPath: string | null
  fileName: string
  dirty: boolean
  saveState: SaveState
  treeRoot: string | null
  tree: FileNode[] | null
  recents: string[]
  outline: OutlineItem[]
  words: number
  lines: number
  cursor: { line: number; col: number }
  modal: ModalState | null
  toast: string | null
  view: EditorView | null

  setView: (v: EditorView | null) => void
  updateDocMeta: (view: EditorView, opts?: { markDirty?: boolean }) => void
  openPath: (path: string, content: string) => void
  newFile: () => void
  saveCurrent: (silent?: boolean) => Promise<void>
  saveCurrentAs: () => Promise<void>
  loadRecents: () => Promise<void>
  openFolder: () => Promise<void>
  loadDir: (dir: string) => Promise<FileNode[]>
  setTree: (tree: FileNode[] | null) => void
  setTreeRoot: (root: string | null) => void
  expandDir: (path: string) => Promise<void>
  collapseDir: (path: string) => void
  toggleTheme: () => void
  setSidebarOpen: (v: boolean) => void
  setOutlineOpen: (v: boolean) => void
  openModal: (m: ModalState) => void
  closeModal: () => void
  openLinkModal: () => void
  notify: (msg: string) => void
}

let saveTimer: ReturnType<typeof setTimeout> | null = null
let toastTimer: ReturnType<typeof setTimeout> | null = null

function initTheme(): 'light' | 'dark' {
  const saved = localStorage.getItem('sm-theme')
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export const useStore = create<AppState>((set, get) => ({
  theme: initTheme(),
  sidebarOpen: true,
  outlineOpen: true,
  currentPath: null,
  fileName: '未命名.md',
  dirty: false,
  saveState: 'saved',
  treeRoot: null,
  tree: null,
  recents: [],
  outline: [],
  words: 0,
  lines: 1,
  cursor: { line: 1, col: 1 },
  modal: null,
  toast: null,
  view: null,

  setView: (v) => set({ view: v }),

  updateDocMeta: (view, opts) => {
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
    set({
      words,
      outline,
      lines: doc.textContent.split('\n').length,
      cursor: { line, col },
      ...(opts?.markDirty === false ? {} : { dirty: true, saveState: 'dirty' as SaveState }),
    })
    if (opts?.markDirty !== false && get().currentPath) {
      if (saveTimer) clearTimeout(saveTimer)
      saveTimer = setTimeout(() => {
        void get().saveCurrent(true)
      }, 1200)
    }
  },

  openPath: (path, content) => {
    const view = get().view
    if (!view) return
    const doc = parseMarkdown(content)
    view.updateState(EditorState.create({ doc, plugins: createPlugins(() => get().openLinkModal()) }))
    const name = path.split(/[\\/]/).pop() || '未命名.md'
    set({ currentPath: path, fileName: name, dirty: false, saveState: 'saved' })
    get().updateDocMeta(view, { markDirty: false })
    void api.addRecent(path).then(() => get().loadRecents())
    document.title = name + ' - SuperMarkdown'
  },

  newFile: () => {
    const view = get().view
    if (!view) return
    // 新建空白文档（首次启动才展示欢迎文档）
    const doc = parseMarkdown('')
    view.updateState(EditorState.create({ doc, plugins: createPlugins(() => get().openLinkModal()) }))
    set({ currentPath: null, fileName: '未命名.md', dirty: false, saveState: 'saved' })
    get().updateDocMeta(view, { markDirty: false })
    document.title = '未命名.md - SuperMarkdown'
  },

  saveCurrent: async (silent) => {
    const { view, currentPath } = get()
    if (!view) return
    if (!currentPath) {
      if (silent) return
      return get().saveCurrentAs()
    }
    const md = mdSerializer.serialize(view.state.doc)
    set({ saveState: 'saving' })
    try {
      await api.writeFile(currentPath, md)
      set({ dirty: false, saveState: 'saved' })
    } catch (e) {
      console.error('保存失败:', e)
      set({ saveState: 'dirty' })
      get().notify('保存失败：' + String(e))
    }
  },

  saveCurrentAs: async () => {
    const { view, fileName } = get()
    if (!view) return
    const md = mdSerializer.serialize(view.state.doc)
    const res = await api.saveFileDialog(md, fileName)
    if (res?.path) {
      const name = res.path.split(/[\\/]/).pop() || '未命名.md'
      set({ currentPath: res.path, fileName: name, dirty: false, saveState: 'saved' })
      void api.addRecent(res.path).then(() => get().loadRecents())
      document.title = name + ' - SuperMarkdown'
    }
  },

  loadRecents: async () => {
    set({ recents: await api.getRecent() })
  },

  openFolder: async () => {
    const dir = await api.openFolderDialog()
    if (!dir) return
    const tree = await get().loadDir(dir)
    set({ treeRoot: dir, tree })
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
  openModal: (m) => set({ modal: m }),
  closeModal: () => set({ modal: null }),

  openLinkModal: () => {
    const view = get().view
    if (!view) return
    get().openModal({ kind: 'link', pos: view.state.selection.from, initial: '' })
  },

  notify: (msg) => {
    set({ toast: msg })
    if (toastTimer) clearTimeout(toastTimer)
    toastTimer = setTimeout(() => set({ toast: null }), 2600)
  },
}))

document.documentElement.dataset.theme = useStore.getState().theme
