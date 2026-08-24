import { useEffect } from 'react'
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

export default function App() {
  const theme = useStore((s) => s.theme)
  const sidebarOpen = useStore((s) => s.sidebarOpen)
  const outlineOpen = useStore((s) => s.outlineOpen)
  const modal = useStore((s) => s.modal)
  const toast = useStore((s) => s.toast)
  const searchOpen = useStore((s) => s.search.open)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    // 启动时若无标签则创建第一个
    if (useStore.getState().tabs.length === 0) useStore.getState().newFile()
    void useStore.getState().loadRecents()
    if (!api.isElectron) return
    const off = api.onMenuAction((action) => {
      const get = useStore.getState
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
        case 'toggle-sidebar':
          get().setSidebarOpen(!get().sidebarOpen)
          break
        case 'toggle-outline':
          get().setOutlineOpen(!get().outlineOpen)
          break
        case 'toggle-theme':
          get().toggleTheme()
          break
        case 'open-home':
          api.openExternal('https://gitcode.com/GreenHands495/SuperMarkdown')
          break
        case 'donate':
          // 创建爱发电主页后替换为真实地址
          api.openExternal('https://afdian.com')
          break
        case 'about':
          get().notify('SuperMarkdown v0.2.1 — 免费开源 · MIT License')
          break
      }
    })
    return off
  }, [])

  // Ctrl+F 打开搜索（自动带入选中文字）/ Esc 关闭
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const get = useStore.getState
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault()
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

  return (
    <div className="app">
      <TitleBar />
      <TabBar />
      <Toolbar />
      <div className="main">
        {sidebarOpen && <Sidebar />}
        <div className="content">
          {searchOpen && <SearchBar />}
          <Editor />
          {outlineOpen && <Outline />}
        </div>
      </div>
      <StatusBar />
      {modal && <SourceModal />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
