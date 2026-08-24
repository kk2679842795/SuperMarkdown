import type { EditorView } from 'prosemirror-view'
import { wrapIn, lift } from 'prosemirror-commands'
import { undo as undoHist, redo as redoHist } from 'prosemirror-history'
import { useStore } from '../store'
import { api } from '../api'
import {
  toggleStrong,
  toggleEm,
  toggleStrike,
  toggleCode,
  toggleBulletList,
  toggleOrderedList,
  setHeading,
  insertHr,
  insertMathInline,
  insertMathBlock,
  insertCodeBlock,
  insertMermaid,
  insertTable,
  toggleTaskList,
} from '../editor/commands'
import { exportAsHtml, exportAsPdf } from '../editor/export'

export default function Toolbar() {
  const view = useStore((s) => (s.activeTabId ? s.views[s.activeTabId] ?? null : null))
  const openModal = useStore((s) => s.openModal)

  const run = (fn: (v: EditorView) => void) => {
    if (view) fn(view)
  }
  const get = () => useStore.getState()

  return (
    <div className="toolbar">
      <div className="tb-group">
        <button
          className="tb-btn"
          title="撤销 (Ctrl+Z)"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => run((v) => undoHist(v.state, v.dispatch))}
        >
          <svg width="15" height="15" viewBox="0 0 16 16">
            <path d="M6 4 L2.5 7.5 L6 11" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M2.5 7.5 H10.5 a3.5 3.5 0 0 1 0 7 H8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        </button>
        <button
          className="tb-btn"
          title="重做 (Ctrl+Y)"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => run((v) => redoHist(v.state, v.dispatch))}
        >
          <svg width="15" height="15" viewBox="0 0 16 16">
            <path d="M10 4 L13.5 7.5 L10 11" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M13.5 7.5 H5.5 a3.5 3.5 0 0 0 0 7 H8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        </button>
        <span className="tb-sep" />
      </div>

      <div className="tb-group">
        <button className="tb-btn" title="新建文档 (Ctrl+N)" onClick={() => get().newFile()}>
          <svg width="15" height="15" viewBox="0 0 16 16">
            <path d="M8 1v14M1 8h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
        <button
          className="tb-btn"
          title="打开文件 (Ctrl+O)"
          onClick={() => {
            void api.openFileDialog().then((r) => r && get().openPath(r.path, r.content))
          }}
        >
          <svg width="15" height="15" viewBox="0 0 16 16">
            <path d="M2 3h4l1.5 2H14v8H2z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          </svg>
        </button>
        <button className="tb-btn" title="保存 (Ctrl+S)" onClick={() => void get().saveCurrent()}>
          <svg width="15" height="15" viewBox="0 0 16 16">
            <path d="M3 1h8l3 3v11H3z M5 1v4h5V1 M5 15v-5h6v5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="tb-sep" />
        <button className="tb-btn" title="导出为 HTML" onClick={() => void exportAsHtml()}>
          HTML
        </button>
        <button className="tb-btn" title="导出为 PDF" onClick={() => void exportAsPdf()}>
          PDF
        </button>
      </div>

      <span className="tb-sep" />

      <div className="tb-group">
        <button
          className="tb-btn tb-bold"
          title="加粗 (Ctrl+B)"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => run((v) => toggleStrong(v.state, v.dispatch))}
        >
          B
        </button>
        <button
          className="tb-btn tb-italic"
          title="斜体 (Ctrl+I)"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => run((v) => toggleEm(v.state, v.dispatch))}
        >
          I
        </button>
        <button
          className="tb-btn tb-strike"
          title="删除线 (Ctrl+Shift+X)"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => run((v) => toggleStrike(v.state, v.dispatch))}
        >
          S
        </button>
        <button
          className="tb-btn tb-code"
          title="行内代码 (Ctrl+`)"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => run((v) => toggleCode(v.state, v.dispatch))}
        >
          {'</>'}
        </button>
        <button
          className="tb-btn"
          title="行内公式"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => run((v) => insertMathInline(v))}
        >
          {'∑'}
        </button>
        <button
          className="tb-btn"
          title="插入链接 (Ctrl+K)"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => run((v) => openModal({ kind: 'link', pos: v.state.selection.from, initial: '' }))}
        >
          🔗
        </button>
      </div>

      <span className="tb-sep" />

      <div className="tb-group">
        <select
          className="tb-select"
          title="段落样式"
          defaultValue="0"
          onChange={(e) => {
            const val = e.target.value
            e.target.value = '0'
            run((v) => setHeading(val === '0' ? null : Number(val))(v.state, v.dispatch))
          }}
        >
          <option value="0">正文</option>
          <option value="1">标题 1</option>
          <option value="2">标题 2</option>
          <option value="3">标题 3</option>
          <option value="4">标题 4</option>
          <option value="5">标题 5</option>
          <option value="6">标题 6</option>
        </select>
        <button
          className="tb-btn"
          title="引用"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() =>
            run((v) => {
              const bq = wrapIn(v.state.schema.nodes.blockquote)
              if (!bq(v.state, v.dispatch)) lift(v.state, v.dispatch)
            })
          }
        >
          ❝
        </button>
        <button
          className="tb-btn"
          title="无序列表"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => run((v) => toggleBulletList(v.state, v.dispatch))}
        >
          •列表
        </button>
        <button
          className="tb-btn"
          title="有序列表"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => run((v) => toggleOrderedList(v.state, v.dispatch))}
        >
          1.列表
        </button>
        <button
          className="tb-btn"
          title="任务列表"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => run((v) => toggleTaskList(v))}
        >
          ☑
        </button>
        <button
          className="tb-btn"
          title="分隔线"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => run((v) => insertHr(v))}
        >
          ─
        </button>
      </div>

      <span className="tb-sep" />

      <div className="tb-group">
        <button
          className="tb-btn"
          title="代码块"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => run((v) => insertCodeBlock(v))}
        >
          {'</>'}
        </button>
        <button
          className="tb-btn"
          title="公式块"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => run((v) => insertMathBlock(v))}
        >
          ∫
        </button>
        <button
          className="tb-btn"
          title="Mermaid 图表"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => run((v) => insertMermaid(v))}
        >
          📊
        </button>
        <button
          className="tb-btn"
          title="插入表格"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => run((v) => openModal({ kind: 'table', pos: v.state.selection.from, initial: '2x3' }))}
        >
          ▦
        </button>
        <button
          className="tb-btn"
          title="插入图片"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => run((v) => openModal({ kind: 'image', pos: v.state.selection.from, initial: '' }))}
        >
          🖼
        </button>
      </div>

      <div className="tb-spacer" />

      <div className="tb-group">
        <button
          className="tb-btn"
          title="切换侧边栏 (Ctrl+B)"
          onClick={() => get().setSidebarOpen(!get().sidebarOpen)}
        >
          ☰
        </button>
        <button
          className="tb-btn"
          title="切换大纲 (Ctrl+Shift+L)"
          onClick={() => get().setOutlineOpen(!get().outlineOpen)}
        >
          ☰
        </button>
        <button className="tb-btn" title="切换主题 (Ctrl+Shift+T)" onClick={() => get().toggleTheme()}>
          {get().theme === 'light' ? '🌙' : '☀️'}
        </button>
      </div>
    </div>
  )
}
