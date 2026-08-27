import { TextSelection } from 'prosemirror-state'
import { useStore } from '../store'

export default function Outline() {
  const outline = useStore((s) => s.outline)

  const jump = (pos: number) => {
    const view = useStore.getState().activeView()
    if (!view) return
    const { state } = view
    const docSize = state.doc.content.size
    const inside = Math.min(Math.max(0, pos + 1), docSize)
    // 优先用 TextSelection 选中标题开头，触发 ProseMirror 内置滚动
    try {
      const resolved = state.doc.resolve(inside)
      const sel = TextSelection.near(resolved, 1)
      view.dispatch(state.tr.setSelection(sel).scrollIntoView())
    } catch {
      // 位置异常时回退到安全位置
      const fallback = Math.min(pos, docSize)
      try {
        const $pos = state.doc.resolve(fallback)
        view.dispatch(state.tr.setSelection(TextSelection.near($pos, 1)).scrollIntoView())
      } catch {
        /* ignore */
      }
    }
    view.focus()
    // 兼容 .pm-host 为独立滚动容器的场景：ProseMirror 的 scrollIntoView 可能只滚动 window，
    // 这里额外保证标题滚动到可视区域顶部
    requestAnimationFrame(() => {
      try {
        const curPos = view.state.selection.head
        const coords = view.coordsAtPos(curPos)
        const host = view.dom.closest('.pm-host') as HTMLElement | null
        if (!host) return
        const rect = host.getBoundingClientRect()
        // 标题距离容器顶部 80px 处居中偏上，预留标题栏等视距
        const targetTop = coords.top - rect.top + host.scrollTop - 72
        if (Number.isFinite(targetTop)) {
          host.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' })
        }
      } catch {
        /* ignore */
      }
    })
  }

  return (
    <aside className="outline">
      <div className="ol-title">大纲</div>
      {outline.length === 0 && <div className="sb-empty">暂无标题</div>}
      {outline.map((item, i) => (
        <div
          key={i}
          className="ol-item"
          style={{ paddingLeft: 14 + (item.level - 1) * 14 }}
          title={item.text}
          onClick={() => jump(item.pos)}
        >
          {item.text || '（空标题）'}
        </div>
      ))}
    </aside>
  )
}
