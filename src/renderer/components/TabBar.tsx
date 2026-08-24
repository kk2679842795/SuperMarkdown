import { useStore } from '../store'

export default function TabBar() {
  const tabs = useStore((s) => s.tabs)
  const activeTabId = useStore((s) => s.activeTabId)
  const get = () => useStore.getState()

  return (
    <div className="tabbar">
      {tabs.map((t) => (
        <div
          key={t.id}
          className={`tab ${t.id === activeTabId ? 'active' : ''}`}
          onClick={() => get().switchTab(t.id)}
          title={t.path || t.name}
        >
          <span className="tab-dot">{t.dirty ? '●' : '·'}</span>
          <span className="tab-name">{t.name}</span>
          <button
            className="tab-close"
            title="关闭标签"
            onClick={(e) => {
              e.stopPropagation()
              get().closeTab(t.id)
            }}
          >
            ×
          </button>
        </div>
      ))}
      <button className="tab-new" title="新建标签 (Ctrl+N)" onClick={() => get().newFile()}>
        +
      </button>
    </div>
  )
}
