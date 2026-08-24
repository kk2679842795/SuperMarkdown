import { useEffect, useState } from 'react'
import { api } from '../api'
import { useStore } from '../store'

export default function TitleBar() {
  const fileName = useStore((s) => s.fileName)
  const dirty = useStore((s) => s.dirty)
  const [maxed, setMaxed] = useState(false)
  const isMac = api.platform === 'darwin'
  const isElectron = api.isElectron

  useEffect(() => {
    if (!isElectron) return
    void api.isMaximized().then(setMaxed)
    const off = api.onMaximizedChange(setMaxed)
    return off
  }, [isElectron])

  const title = (
    <span className="titlebar-title">
      {fileName}
      {dirty ? <span className="titlebar-dirty"> •</span> : null}
    </span>
  )

  if (isMac) {
    return <div className="titlebar titlebar-mac">{title}</div>
  }

  return (
    /* 注意：Windows 上双击拖拽区域默认会最大化/还原，无需手动处理 */
    <div className="titlebar">
      <span className="titlebar-app">SuperMarkdown</span>
      {title}
      {isElectron && (
        <div className="win-btns">
          <button className="win-btn" title="最小化" onClick={() => api.minWindow()}>
            <svg width="10" height="10" viewBox="0 0 10 10">
              <line x1="0" y1="5" x2="10" y2="5" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </button>
          <button className="win-btn" title={maxed ? '还原' : '最大化'} onClick={() => api.maxWindow()}>
            {maxed ? (
              <svg width="10" height="10" viewBox="0 0 10 10">
                <rect x="0.5" y="2.5" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1.2" />
                <path d="M2.5 2.5 V0.5 H9.5 V7.5 H7.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
              </svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 10 10">
                <rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="1.2" />
              </svg>
            )}
          </button>
          <button className="win-btn close" title="关闭" onClick={() => api.closeWindow()}>
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path d="M0.5 0.5 L9.5 9.5 M9.5 0.5 L0.5 9.5" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
