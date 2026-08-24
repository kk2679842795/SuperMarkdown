import { Plugin, PluginKey, TextSelection, type EditorState, type Transaction } from 'prosemirror-state'
import { Decoration, DecorationSet, type EditorView } from 'prosemirror-view'
import type { Node } from 'prosemirror-model'
import { useStore } from '../store'

export const searchKey = new PluginKey('search-state')

export interface SearchPluginState {
  query: string
  caseSensitive: boolean
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

interface OffsetMap {
  offsets: number[]
  positions: number[]
  texts: string[]
  full: string
}

function buildMap(doc: Node): OffsetMap {
  const offsets: number[] = []
  const positions: number[] = []
  const texts: string[] = []
  let len = 0
  doc.descendants((n, pos) => {
    if (n.isText) {
      offsets.push(len)
      positions.push(pos)
      const t = n.text || ''
      texts.push(t)
      len += t.length
    }
  })
  return { offsets, positions, texts, full: texts.join('') }
}

function offsetToPos(map: OffsetMap, offset: number): number | null {
  for (let i = map.offsets.length - 1; i >= 0; i--) {
    if (offset >= map.offsets[i]) {
      const local = offset - map.offsets[i]
      if (local <= map.texts[i].length) return map.positions[i] + local
      return null
    }
  }
  return null
}

export interface Match {
  from: number
  to: number
}

export function findMatches(doc: Node, query: string, caseSensitive: boolean): Match[] {
  if (!query) return []
  const map = buildMap(doc)
  const re = new RegExp(escapeRegExp(query), caseSensitive ? 'g' : 'gi')
  const out: Match[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(map.full))) {
    const from = offsetToPos(map, m.index)
    const to = offsetToPos(map, m.index + m[0].length)
    if (from != null && to != null) out.push({ from, to })
  }
  return out
}

export const searchPlugin = new Plugin<SearchPluginState>({
  key: searchKey,
  state: {
    init: () => ({ query: '', caseSensitive: false }),
    apply(tr: Transaction, prev: SearchPluginState): SearchPluginState {
      const meta = tr.getMeta(searchKey)
      if (meta) return meta as SearchPluginState
      return prev
    },
  },
  props: {
    decorations(state: EditorState) {
      const s = searchKey.getState(state) as SearchPluginState | undefined
      if (!s?.query) return DecorationSet.empty
      const matches = findMatches(state.doc, s.query, s.caseSensitive)
      const store = useStore.getState()
      if (store.search.count !== matches.length || store.search.query !== s.query) {
        store.setSearch({ count: matches.length })
      }
      const current = Math.min(Math.max(store.search.current, 0), Math.max(0, matches.length - 1))
      const decos = matches.map((m, i) =>
        Decoration.inline(m.from, m.to, {
          class: 'search-match' + (i === current ? ' current' : ''),
        }),
      )
      return DecorationSet.create(state.doc, decos)
    },
  },
})

export function performSearch(view: EditorView, query: string, caseSensitive: boolean) {
  const matches = findMatches(view.state.doc, query, caseSensitive)
  useStore.getState().setSearch({
    query,
    caseSensitive,
    count: matches.length,
    current: matches.length ? 0 : -1,
  })
  view.dispatch(view.state.tr.setMeta(searchKey, { query, caseSensitive }))
  if (matches.length) {
    const m = matches[0]
    view.dispatch(
      view.state.tr.setSelection(TextSelection.create(view.state.doc, m.from, m.to)).scrollIntoView(),
    )
  }
  view.focus()
}

export function closeSearch(view: EditorView) {
  useStore.getState().setSearch({ open: false, query: '', count: 0, current: -1 })
  view.dispatch(view.state.tr.setMeta(searchKey, { query: '', caseSensitive: false }))
  view.focus()
}

export function nextMatch(view: EditorView, dir: 1 | -1) {
  const s = useStore.getState().search
  if (!s.query) return
  const matches = findMatches(view.state.doc, s.query, s.caseSensitive)
  if (!matches.length) return
  const cur = s.current < 0 ? (dir === 1 ? -1 : 0) : s.current
  const next = ((cur + dir) % matches.length + matches.length) % matches.length
  useStore.getState().setSearch({ current: next })
  const m = matches[next]
  view.dispatch(
    view.state.tr.setSelection(TextSelection.create(view.state.doc, m.from, m.to)).scrollIntoView(),
  )
  view.focus()
}

export function replaceCurrent(view: EditorView, replaceText: string) {
  const s = useStore.getState().search
  if (!s.query) return
  const matches = findMatches(view.state.doc, s.query, s.caseSensitive)
  if (!matches.length) return
  const m = matches[Math.min(Math.max(s.current, 0), matches.length - 1)]
  view.dispatch(view.state.tr.insertText(replaceText, m.from, m.to))
  performSearch(view, s.query, s.caseSensitive)
  nextMatch(view, 1)
}

export function replaceAll(view: EditorView, replaceText: string) {
  const s = useStore.getState().search
  if (!s.query) return
  const matches = findMatches(view.state.doc, s.query, s.caseSensitive)
  if (!matches.length) return
  const tr = view.state.tr
  for (let i = matches.length - 1; i >= 0; i--) {
    tr.insertText(replaceText, matches[i].from, matches[i].to)
  }
  view.dispatch(tr)
  performSearch(view, s.query, s.caseSensitive)
}
