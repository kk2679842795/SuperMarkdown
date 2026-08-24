import { useEffect, useRef } from 'react'
import { useStore } from '../store'
import { performSearch, nextMatch, replaceCurrent, replaceAll, closeSearch } from '../editor/search'

export default function SearchBar() {
  const search = useStore((s) => s.search)
  const setSearch = useStore((s) => s.setSearch)
  const inputRef = useRef<HTMLInputElement>(null)
  const replaceRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (search.open) {
      // 延迟到渲染完成后再聚焦
      const t = setTimeout(() => inputRef.current?.focus(), 30)
      return () => clearTimeout(t)
    }
  }, [search.open])

  const view = () => useStore.getState().activeView()
  const doSearch = () => {
    const v = view()
    if (v) performSearch(v, search.query, search.caseSensitive)
  }

  return (
    <div className="searchbar">
      <span className="searchbar-icon">🔍</span>
      <input
        ref={inputRef}
        className="searchbar-input"
        value={search.query}
        placeholder="搜索…"
        spellCheck={false}
        onChange={(e) => setSearch({ query: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            if (e.shiftKey) nextMatch(view()!, -1)
            else doSearch()
          } else if (e.key === 'Escape') {
            const v = view()
            if (v) closeSearch(v)
          }
        }}
      />
      <button
        className={`searchbar-case ${search.caseSensitive ? 'on' : ''}`}
        title="区分大小写"
        onClick={() => {
          setSearch({ caseSensitive: !search.caseSensitive })
          doSearch()
        }}
      >
        Aa
      </button>
      <span className="searchbar-count">{search.count}</span>
      <button className="searchbar-btn" title="上一个 (Shift+Enter)" onClick={() => nextMatch(view()!, -1)}>
        ↑
      </button>
      <button className="searchbar-btn" title="下一个 (Enter)" onClick={() => nextMatch(view()!, 1)}>
        ↓
      </button>
      <span className="searchbar-sep" />
      <input
        ref={replaceRef}
        className="searchbar-input"
        value={search.replace}
        placeholder="替换为…"
        spellCheck={false}
        onChange={(e) => setSearch({ replace: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            const v = view()
            if (v) replaceCurrent(v, search.replace)
          }
        }}
      />
      <button className="searchbar-btn" title="替换当前" onClick={() => replaceCurrent(view()!, search.replace)}>
        替换
      </button>
      <button className="searchbar-btn" title="全部替换" onClick={() => replaceAll(view()!, search.replace)}>
        全部替换
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
  )
}
