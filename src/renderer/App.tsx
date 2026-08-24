import { useEffect } from 'react'
import TitleBar from './components/TitleBar'
import Toolbar from './components/Toolbar'
import Sidebar from './components/Sidebar'
import Outline from './components/Outline'
import StatusBar from './components/StatusBar'
import SourceModal from './components/SourceModal'
import Editor from './editor/editor'
import { useStore } from './store'
import { api } from './api'
import { exportAsHtml, exportAsPdf } from './editor/export'

export default function App() {
  const theme = useStore((s) => s.theme)
  const sidebarOpen = useStore((s) => s.sidebarOpen)
  const outlineOpen = useStore((s) => s.outlineOpen)
  const modal = useStore((s) => s.modal)
  const toast = useStore((s) => s.toast)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => {
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
          api.openExternal('https://github.com/supermarkdown/supermarkdown')
          break
        case 'about':
          get().notify('SuperMarkdown v0.1.0 — 免费开源 · MIT License')
          break
      }
    })
    return off
  }, [])

  // 拖拽打开 .md 文件
  useEffect(() => {
    const onDragOver = (e: DragEvent) => e.preventDefault()
    const onDrop = (e: DragEvent) => {
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
      <Toolbar />
      <div className="main">
        {sidebarOpen && <Sidebar />}
        <div className="content">
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
