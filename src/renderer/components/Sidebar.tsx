import type { ReactNode } from 'react'
import { api } from '../api'
import { useStore, type FileNode } from '../store'

function TreeItem({ node, depth }: { node: FileNode; depth: number }) {
  const tree = useStore((s) => s.tree)
  const currentPath = useStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.path ?? null)
  const setTree = useStore((s) => s.setTree)

  const openFile = async (path: string) => {
    try {
      const content = await api.readFile(path)
      useStore.getState().openPath(path, content)
    } catch (e) {
      useStore.getState().notify('打开失败：' + String(e))
    }
  }

  if (node.type === 'dir') {
    const isOpen = !!node.children
    return (
      <div>
        <div
          className="sb-item sb-dir"
          style={{ paddingLeft: 8 + depth * 14 }}
          onClick={() => {
            if (isOpen) useStore.getState().collapseDir(node.path)
            else void useStore.getState().expandDir(node.path)
          }}
        >
          <span className={`sb-caret ${isOpen ? 'open' : ''}`}>▶</span>
          <span>📁</span>
          <span className="sb-name">{node.name}</span>
        </div>
        {isOpen &&
          node.children?.map((child) => <TreeItem key={child.path} node={child} depth={depth + 1} />)}
      </div>
    )
  }

  const active = currentPath === node.path
  return (
    <div
      className={`sb-item ${active ? 'active' : ''}`}
      style={{ paddingLeft: 30 + depth * 14 }}
      onClick={() => void openFile(node.path)}
    >
      <span>📄</span>
      <span className="sb-name">{node.name}</span>
    </div>
  )
}

export default function Sidebar() {
  const recents = useStore((s) => s.recents)
  const tree = useStore((s) => s.tree)
  const treeRoot = useStore((s) => s.treeRoot)
  const openFolder = useStore((s) => s.openFolder)
  const loadRecents = useStore((s) => s.loadRecents)
  const notify = useStore((s) => s.notify)
  const get = useStore.getState

  const openRecent = async (path: string) => {
    try {
      const content = await api.readFile(path)
      useStore.getState().openPath(path, content)
    } catch (e) {
      notify('打开失败：' + String(e))
    }
  }

  const refresh = async () => {
    if (!get().treeRoot) return
    const t = await get().loadDir(get().treeRoot!)
    get().setTree(t)
  }

  return (
    <aside className="sidebar">
      <div className="sb-section-title">
        最近打开
        <button className="sb-clear" title="清空最近记录" onClick={() => void api.clearRecent().then(() => loadRecents())}>
          清空
        </button>
      </div>
      <div className="sb-list">
        {recents.length === 0 && <div className="sb-empty">暂无最近记录</div>}
        {recents.map((p) => (
          <div key={p} className="sb-item sb-recent" onClick={() => void openRecent(p)} title={p}>
            <span>🕘</span>
            <span className="sb-name">{p.split(/[\\/]/).pop()}</span>
          </div>
        ))}
      </div>

      <div className="sb-section-title sb-folder-title">
        文件管理
        <button className="sb-clear" onClick={() => void openFolder()}>
          打开文件夹
        </button>
      </div>
      <div className="sb-folder-head">
        <span className="sb-root">{treeRoot || '未打开文件夹'}</span>
        {treeRoot && (
          <button className="sb-clear" title="刷新" onClick={() => void refresh()}>
            刷新
          </button>
        )}
      </div>
      <div className="sb-list sb-tree">
        {!treeRoot && <div className="sb-empty">打开一个文件夹以浏览 Markdown 文件</div>}
        {tree?.map((node) => <TreeItem key={node.path} node={node} depth={0} />)}
      </div>
    </aside>
  )
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <div className="sb-section-title">{children}</div>
}
