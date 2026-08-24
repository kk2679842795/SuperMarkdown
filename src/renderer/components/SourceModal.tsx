import { useEffect, useState } from 'react'
import { schema } from '../editor/schema'
import { insertImage, updateImageAt, addLink, insertTable } from '../editor/commands'
import { useStore } from '../store'

export default function SourceModal() {
  const modal = useStore((s) => s.modal)
  const closeModal = useStore((s) => s.closeModal)
  const [text, setText] = useState('')
  const [extra, setExtra] = useState({ alt: '', title: '', rows: 2, cols: 3, href: '' })

  // 每次打开重置本地状态
  useEffect(() => {
    if (!modal) return
    setText(modal.initial || '')
    if (modal.kind === 'image') {
      try {
        const meta = JSON.parse(modal.language || '{}')
        setExtra({ alt: meta.alt || '', title: meta.title || '', rows: 2, cols: 3, href: '' })
      } catch {
        setExtra({ alt: '', title: '', rows: 2, cols: 3, href: '' })
      }
    } else {
      setExtra({ alt: '', title: '', rows: 2, cols: 3, href: '' })
    }
  }, [modal])

  useEffect(() => {
    if (!modal) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal()
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') commit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!modal) return null

  const commit = () => {
    const view = useStore.getState().view
    if (!view) {
      closeModal()
      return
    }
    if (modal.kind === 'code') {
      const node = view.state.doc.nodeAt(modal.pos)
      if (node && node.type.name === 'code_block') {
        const lang = modal.language || node.attrs.language || null
        view.dispatch(
          view.state.tr.replaceWith(
            modal.pos,
            modal.pos + node.nodeSize,
            schema.nodes.code_block.create({ language: lang }, schema.text(text)),
          ),
        )
      }
    } else if (modal.kind === 'math') {
      const node = view.state.doc.nodeAt(modal.pos)
      if (node && (node.type.name === 'math_inline' || node.type.name === 'math_block')) {
        view.dispatch(view.state.tr.setNodeMarkup(modal.pos, null, { content: text.trim() }))
      }
    } else if (modal.kind === 'image') {
      const node = view.state.doc.nodeAt(modal.pos)
      if (node && node.type.name === 'image') {
        updateImageAt(view, modal.pos, text.trim(), extra.alt, extra.title)
      } else {
        insertImage(view, text.trim(), extra.alt, extra.title)
      }
    } else if (modal.kind === 'link') {
      if (text.trim()) addLink(view, text.trim(), extra.title)
    } else if (modal.kind === 'table') {
      insertTable(view, extra.rows, extra.cols)
    }
    closeModal()
    view.focus()
  }

  const titles: Record<string, string> = {
    code: '编辑代码块',
    math: modal.inline ? '编辑行内公式' : '编辑公式块',
    image: '图片',
    link: '插入链接',
    table: '插入表格',
  }

  return (
    <div className="modal-mask" onMouseDown={(e) => e.target === e.currentTarget && closeModal()}>
      <div className="modal">
        <div className="modal-head">{titles[modal.kind]}</div>
        <div className="modal-body">
          {modal.kind === 'code' && (
            <>
              <div className="modal-field">
                <label>语言</label>
                <input
                  type="text"
                  defaultValue={modal.language || ''}
                  id="code-lang"
                  placeholder="如 javascript / python / mermaid / typescript"
                  spellCheck={false}
                />
              </div>
              <div className="modal-field">
                <label>代码</label>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  spellCheck={false}
                  autoFocus
                  placeholder="在此输入代码…"
                />
              </div>
            </>
          )}
          {modal.kind === 'math' && (
            <div className="modal-field">
              <label>LaTeX 公式</label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                spellCheck={false}
                autoFocus
                placeholder="如 a^2 + b^2 = c^2"
                className={modal.inline ? 'math-input' : 'math-input block'}
              />
              <div className="modal-hint">提示：输入 LaTeX 语法，保存后即时渲染{modal.inline ? '' : '（块级居中显示）'}</div>
            </div>
          )}
          {modal.kind === 'image' && (
            <>
              <div className="modal-field">
                <label>图片地址</label>
                <input
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  autoFocus
                  placeholder="支持本地路径或 http(s) 链接"
                />
              </div>
              <div className="modal-field">
                <label>替代文本 (alt)</label>
                <input type="text" value={extra.alt} onChange={(e) => setExtra({ ...extra, alt: e.target.value })} />
              </div>
              <div className="modal-field">
                <label>标题 (title)</label>
                <input type="text" value={extra.title} onChange={(e) => setExtra({ ...extra, title: e.target.value })} />
              </div>
            </>
          )}
          {modal.kind === 'link' && (
            <>
              <div className="modal-field">
                <label>链接地址</label>
                <input
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  autoFocus
                  placeholder="https:// 或相对路径"
                />
              </div>
              <div className="modal-field">
                <label>标题（可选）</label>
                <input type="text" value={extra.title} onChange={(e) => setExtra({ ...extra, title: e.target.value })} />
              </div>
            </>
          )}
          {modal.kind === 'table' && (
            <div className="modal-fields-row">
              <div className="modal-field">
                <label>行数（含表头）</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={extra.rows}
                  onChange={(e) => setExtra({ ...extra, rows: Number(e.target.value) || 1 })}
                />
              </div>
              <div className="modal-field">
                <label>列数</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={extra.cols}
                  onChange={(e) => setExtra({ ...extra, cols: Number(e.target.value) || 1 })}
                />
              </div>
            </div>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={closeModal}>取消</button>
          <button className="btn btn-primary" onClick={commit}>确定 (Ctrl+Enter)</button>
        </div>
      </div>
    </div>
  )
}
