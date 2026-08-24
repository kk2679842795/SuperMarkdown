import { useStore } from '../store'

const SAVE_TEXT: Record<string, string> = {
  saved: '已保存',
  dirty: '未保存更改',
  saving: '保存中…',
}

export default function StatusBar() {
  const words = useStore((s) => s.words)
  const lines = useStore((s) => s.lines)
  const cursor = useStore((s) => s.cursor)
  const tab = useStore((s) => s.tabs.find((t) => t.id === s.activeTabId))
  const dirty = tab?.dirty ?? false

  return (
    <footer className="statusbar">
      <div className="sb-left">
        <span>{words} 字</span>
        <span>{lines} 行</span>
      </div>
      <div className="sb-right">
        <span>
          行 {cursor.line}, 列 {cursor.col}
        </span>
        <span className={`save-state ${dirty ? 'dirty' : ''}`}>{SAVE_TEXT[tab?.saveState ?? 'saved']}</span>
        <span className="sb-file">{tab?.name ?? ''}</span>
      </div>
    </footer>
  )
}
