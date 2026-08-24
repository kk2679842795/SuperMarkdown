import { TextSelection } from 'prosemirror-state'
import { useStore } from '../store'

export default function Outline() {
  const outline = useStore((s) => s.outline)

  const jump = (pos: number) => {
    const view = useStore.getState().view
    if (!view) return
    const { state } = view
    const resolved = state.doc.resolve(pos + 1)
    view.dispatch(state.tr.setSelection(TextSelection.near(resolved, 1)).scrollIntoView())
    view.focus()
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
