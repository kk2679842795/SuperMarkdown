import { useStore } from '../store'
import { api } from '../api'

export default function StartPage() {
  const recents = useStore((s) => s.recents)
  const notify = useStore((s) => s.notify)

  const openFile = () => {
    void api.openFileDialog().then((r) => {
      if (r) useStore.getState().openPath(r.path, r.content)
    })
  }

  const openRecent = async (path: string) => {
    try {
      const content = await api.readFile(path)
      useStore.getState().openPath(path, content)
    } catch (e) {
      notify('打开失败：' + String(e))
    }
  }

  return (
    <div className="start-page">
      <div className="sp-card">
        <h1 className="sp-title">SuperMarkdown</h1>
        <p className="sp-desc">
          免费、开源的跨平台 Markdown 编辑器 —— 所见即所得，支持公式、Mermaid 图表、代码高亮与一键导出 HTML / PDF。
        </p>
        <div className="sp-actions">
          <button className="btn btn-primary sp-btn" onClick={() => useStore.getState().newFile()}>
            新建文档 <kbd>Ctrl+N</kbd>
          </button>
          <button className="btn sp-btn" onClick={openFile}>
            打开文件 <kbd>Ctrl+O</kbd>
          </button>
          <button className="btn sp-btn" onClick={() => void useStore.getState().openFolder()}>
            打开文件夹
          </button>
        </div>
        <div className="sp-recents">
          <div className="sp-recents-title">最近打开</div>
          {recents.length === 0 ? (
            <div className="sp-empty">暂无最近记录</div>
          ) : (
            recents.map((p) => (
              <div key={p} className="sp-item" onClick={() => void openRecent(p)} title={p}>
                <span className="sp-item-icon">🕘</span>
                <span className="sp-item-name">{p.split(/[\\/]/).pop()}</span>
                <span className="sp-item-path">{p}</span>
              </div>
            ))
          )}
        </div>
        <div className="sp-tips">
          <kbd>Ctrl+B</kbd> 加粗 · <kbd>Ctrl+I</kbd> 斜体 · <kbd>Ctrl+K</kbd> 插入链接 · <kbd>Ctrl+F</kbd> 搜索 ·{' '}
          <kbd>Ctrl+S</kbd> 保存
        </div>
      </div>
    </div>
  )
}