import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { performSearch, nextMatch, replaceCurrent, replaceAll, closeSearch } from '../editor/search'

export default function SearchBar() {
  const search = useStore((s) => s.search)
  const setSearch = useStore((s) => s.setSearch)
  const [showReplace, setShowReplace] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const replaceRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const view = () => useStore.getState().activeView()

  // 打开时聚焦并全选
  useEffect(() => {
    if (!search.open) return
    const t = setTimeout(() => {
      searchRef.current?.focus()
      searchRef.current?.select()
    }, 30)
    return () => clearTimeout(t)
  }, [search.open])

  // 输入即搜（200ms 防抖）
  useEffect(() => {
    if (!search.open) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const v = view()
      if (v) performSearch(v, search.query, search.caseSensitive)
    }, 200)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search.query, search.caseSensitive, search.open])

  const cur = search.count > 0 ? Math.max(0, search.current) + 1 : 0

  const onSearchKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (e.shiftKey) nextMatch(view()!, -1)
      else nextMatch(view()!, 1)
    } else if (e.key === 'Tab') {
      e.preventDefault()
      if (!showReplace) setShowReplace(true)
      setTimeout(() => replaceRef.current?.focus(), 30)
    } else if (e.key === 'Escape') {
      const v = view()
      if (v) closeSearch(v)
    }
  }

  const onReplaceKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const v = view()
      if (v) replaceCurrent(v, search.replace)
    } else if (e.key === 'Tab') {
      e.preventDefault()
      searchRef.current?.focus()
    }
  }

  return (
    <div className="searchbar">
      <div className="searchbar-row">
        <span className="searchbar-icon">🔍</span>
        <input
          ref={searchRef}
          className="searchbar-input"
          value={search.query}
          placeholder="搜索…（Enter 下一个）"
          spellCheck={false}
          onChange={(e) => setSearch({ query: e.target.value })}
          onKeyDown={onSearchKey}
        />
        <button
          className={`searchbar-case ${search.caseSensitive ? 'on' : ''}`}
          title="区分大小写"
          onClick={() => setSearch({ caseSensitive: !search.caseSensitive })}
        >
          Aa
        </button>
        <span className="searchbar-count" title="当前/总数">
          {cur}/{search.count}
        </span>
        <button className="searchbar-btn" title="上一个 (Shift+Enter)" onClick={() => nextMatch(view()!, -1)}>
          ↑
        </button>
        <button className="searchbar-btn" title="下一个 (Enter)" onClick={() => nextMatch(view()!, 1)}>
          ↓
        </button>
        <button
          className={`searchbar-btn ${showReplace ? 'active' : ''}`}
          title="展开/收起替换 (Tab)"
          onClick={() => setShowReplace(!showReplace)}
        >
          替换
        </button>
        <button
          className="searchbar-btn close"
          title="关闭 (Esc)"
          onClick={() => {
            const v = view()
            if (v) closeSearch(v)
          }}
        >
          ✕
        </button>
      </div>
      {showReplace && (
        <div className="searchbar-row">
          <span className="searchbar-icon">✎</span>
          <input
            ref={replaceRef}
            className="searchbar-input"
            value={search.replace}
            placeholder="替换为…"
            spellCheck={false}
            onChange={(e) => setSearch({ replace: e.target.value })}
            onKeyDown={onReplaceKey}
          />
          <button className="searchbar-btn" title="替换当前 (Enter)" onClick={() => replaceCurrent(view()!, search.replace)}>
            替换
          </button>
          <button className="searchbar-btn" title="全部替换" onClick={() => replaceAll(view()!, search.replace)}>
            全部
          </button>
        </div>
      )}
    </div>
  )
}
