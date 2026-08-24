import { useEffect, useRef } from 'react'
import { EditorState } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { parseMarkdown } from './parser'
import { createPlugins } from './plugins'
import { buildNodeViews } from './nodeviews'
import { useStore } from '../store'
import { WELCOME } from '../welcome'
import { handleEditorClick } from './commands'

export default function Editor() {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const openLinkModal = () => {
      const view = useStore.getState().view
      if (!view) return
      useStore.getState().openModal({ kind: 'link', pos: view.state.selection.from, initial: '' })
    }
    const view = new EditorView(host, {
      state: EditorState.create({
        doc: parseMarkdown(WELCOME),
        plugins: createPlugins(openLinkModal),
      }),
      nodeViews: buildNodeViews(),
      dispatchTransaction(tr) {
        const newState = view.state.apply(tr)
        view.updateState(newState)
        useStore.getState().updateDocMeta(view)
      },
      handleDOMEvents: {
        click(v, event) {
          return handleEditorClick(v, event)
        },
      },
    })
    useStore.getState().setView(view)
    useStore.getState().updateDocMeta(view, { markDirty: false })
    return () => {
      view.destroy()
      useStore.getState().setView(null)
    }
  }, [])

  return <div className="pm-host" ref={hostRef} />
}
