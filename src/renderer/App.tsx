import { useEffect } from 'react'
import type { EditorView } from 'prosemirror-view'
import { undo as undoHist, redo as redoHist } from 'prosemirror-history'
import TitleBar from './components/TitleBar'
import TabBar from './components/TabBar'
import Toolbar from './components/Toolbar'
import Sidebar from './components/Sidebar'
import Outline from './components/Outline'
import StatusBar from './components/StatusBar'
import SourceModal from './components/SourceModal'
import SearchBar from './components/SearchBar'
import Editor from './editor/editor'
import { useStore } from './store'
import { api } from './api'
import { exportAsHtml, exportAsPdf } from './editor/export'
import { closeSearch, performSearch } from './editor/search'

// 打开搜索（自动带入选中文字）
function openSearch() {
  const get = useStore.getState
  const view = get().activeView()
  let query = ''
  if (view) {
    const sel = view.state.selection
    if (!sel.empty) {
      query = view.state.doc.textBetween(sel.from, sel.to, ' ', ' ').trim().slice(0, 100)
    }
  }
  get().setSearch({ open: true, query })
  if (view && query) performSearch(view, query, get().search.caseSensitive)
}

// 撤销/重做走 ProseMirror 自身历史（prosemirror-history）
function runHistory(action: 'undo' | 'redo') {
  const view: EditorView | null = useStore.getState().activeView()
  if (!view) return
  ;(action === 'undo' ? undoHist : redoHist)(view.state, view.dispatch)
  view.focus()
}

export default function App() {
  const theme = useStore((s) => s.theme)
  const sidebarOpen = useStore((s) => s.sidebarOpen)
  const outlineOpen = useStore((s) => s.outlineOpen)
  const zenMode = useStore((s) => s.zenMode)
  const focusMode = useStore((s) => s.focusMode)
  const typewriterMode = useStore((s) => s.typewriterMode)
  const modal = useStore((s) => s.modal)
  const toast = useStore((s) => s.toast)
  const searchOpen = useStore((s) => s.search.open)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  // 暴露给编辑器插件（专注/打字机需要读取最新状态）
  useEffect(() => {
    ;(globalThis as unknown as { __smStore?: typeof useStore }).__smStore = useStore
  }, [])

  // 极简模式下：Esc 退出，F9 切换
  useEffect(() => {
    const onZenKey = (e: KeyboardEvent) => {
      if (e.key === 'F9') {
        e.preventDefault()
        useStore.getState().toggleZenMode()
        // 强制刷新编辑器装饰
        Object.values(useStore.getState().views).forEach((v) => {
          v.dispatch(v.state.tr.setMeta('zen', Date.now()))
        })
      } else if (e.key === 'Escape' && useStore.getState().zenMode) {
        // 若有弹窗/搜索，优先关闭它们
        const s = useStore.getState()
        if (s.modal) {
          s.closeModal()
          return
        }
        if (s.search.open) {
          const v = s.activeView()
          if (v) closeSearch(v)
          return
        }
        s.setZenMode(false)
        Object.values(s.views).forEach((v) => {
          v.dispatch(v.state.tr.setMeta('zen', Date.now()))
        })
      }
    }
    window.addEventListener('keydown', onZenKey)
    return () => window.removeEventListener('keydown', onZenKey)
  }, [])

  useEffect(() => {
    // 启动时若无标签则创建第一个
    if (useStore.getState().tabs.length === 0) useStore.getState().newFile()
    void useStore.getState().loadRecents()
    if (!api.isElectron) return
    const off = api.onMenuAction((action) => {      const get = useStore.getState
      const refreshViews = () => {
        Object.values(get().views).forEach((v) => v.dispatch(v.state.tr.setMeta('ui', Date.now())))
      }
      switch (action) {
        case 'new':
          get().newFile()
          break
        case 'open':
          void api.openFileDialog().then((r) => r && get().openPath(r.path, r.content))
          break
        case 'open-folder':
          void get().openFolder()
          break
        case 'save':
          void get().saveCurrent()
          break
        case 'save-as':
          void get().saveCurrentAs()
          break
        case 'export-html':
          void exportAsHtml()
          break
        case 'export-pdf':
          void exportAsPdf()
          break
        case 'undo':
          runHistory('undo')
          break
        case 'redo':
          runHistory('redo')
          break
        case 'insert-link': {
          const view = get().activeView()
          if (view) get().openModal({ kind: 'link', pos: view.state.selection.from, initial: '' })
          break
        }
        case 'insert-image': {
          const view = get().activeView()
          if (view) get().openModal({ kind: 'image', pos: view.state.selection.from, initial: '' })
          break
        }
        case 'open-search':
          openSearch()
          break
        case 'toggle-sidebar':
          get().setSidebarOpen(!get().sidebarOpen)
          break
        case 'toggle-outline':
          get().setOutlineOpen(!get().outlineOpen)
          break
        case 'toggle-theme':
          get().toggleTheme()
          break
        case 'toggle-zen':
          get().toggleZenMode()
          refreshViews()
          break
        case 'toggle-focus':
          get().toggleFocusMode()
          refreshViews()
          break
        case 'toggle-typewriter':
          get().toggleTypewriterMode()
          refreshViews()
          break
        case 'open-home':
          api.openExternal('https://gitcode.com/GreenHands495/SuperMarkdown')
          break
        case 'donate':
          // 创建爱发电主页后替换为真实地址
          api.openExternal('https://afdian.com/a/csqk495')
          break
        case 'about':
          get().notify('SuperMarkdown v0.2.1 — 免费开源 · MIT License')
          break
      }
    })
    // 右键菜单/双击 .md 文件打开
    const offOpen = api.onOpenFile((p, content) => useStore.getState().openPath(p, content))
    void api.takePendingOpenFile().then((r) => {
      if (r) useStore.getState().openPath(r.path, r.content)
    })
    return () => {
      off()
      offOpen()
    }
  }, [])

  // Ctrl+F 打开搜索 / Esc 关闭
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const get = useStore.getState
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault()
        openSearch()
        return
      }
      if (e.key === 'Escape' && get().search.open) {
        const view = get().activeView()
        if (view) closeSearch(view)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // 右键菜单（Electron 原生弹窗）
  useEffect(() => {
    if (!api.isElectron) return
    const onCtxMenu = (e: MouseEvent) => {
      e.preventDefault()
      api.showContextMenu()
    }
    window.addEventListener('contextmenu', onCtxMenu)
    return () => window.removeEventListener('contextmenu', onCtxMenu)
  }, [])

  // 拖拽打开 .md 文件（编辑器内的图片拖放由 EditorPane 处理，这里处理编辑区外的文件拖放）
  useEffect(() => {
    const onDragOver = (e: DragEvent) => e.preventDefault()
    const onDrop = (e: DragEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('.ProseMirror')) return // 编辑器内的图片/文件拖放交给编辑器
      e.preventDefault()
      const file = e.dataTransfer?.files?.[0]
      if (!file) return
      if (api.isElectron) {
        const p = (file as File & { path?: string }).path
        if (p) {
          void api.readFile(p).then((content) => useStore.getState().openPath(p, content))
          return
        }
      }
      void file.text().then((content) => useStore.getState().openPath(file.name, content))
    }
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('drop', onDrop)
    }
  }, [])

  // 同步 zen/focus/typewriter 需要刷新编辑器装饰
  useEffect(() => {
    Object.values(useStore.getState().views).forEach((v) => {
      v.dispatch(v.state.tr.setMeta('ui', Date.now()))
    })
  }, [zenMode, focusMode, typewriterMode])

  return (
    <div className={`app ${zenMode ? 'zen-mode' : ''} ${focusMode ? 'focus-mode' : ''} ${typewriterMode ? 'typewriter-mode' : ''}`}>
      {!zenMode && <TitleBar />}
      {!zenMode && <TabBar />}
      {!zenMode && <Toolbar />}
      <div className="main">
        {!zenMode && sidebarOpen && <Sidebar />}
        <div className="content">
          {searchOpen && <SearchBar />}
          <Editor />
          {!zenMode && outlineOpen && <Outline />}
        </div>
      </div>
      {!zenMode && <StatusBar />}
      {zenMode && (
        <button
          className="zen-exit"
          title="退出极简模式 (Esc / F9)"
          onClick={() => {
            useStore.getState().setZenMode(false)
            Object.values(useStore.getState().views).forEach((v) => v.dispatch(v.state.tr.setMeta('zen', Date.now())))
          }}
        >
          退出极简
        </button>
      )}
      {modal && <SourceModal />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
