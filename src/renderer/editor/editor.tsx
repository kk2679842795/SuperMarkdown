import { useEffect, useRef } from 'react'
import { EditorState } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { parseMarkdown } from './parser'
import { createPlugins } from './plugins'
import { buildNodeViews } from './nodeviews'
import { useStore } from '../store'
import { handleEditorClick, handleEditorPaste, handleEditorDrop, handleEditorCopy } from './commands'

function EditorPane({ tabId }: { tabId: string }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const inited = useRef(false)

  useEffect(() => {
    const host = hostRef.current
    if (!host || inited.current) return
    inited.current = true
    const tab = useStore.getState().tabs.find((t) => t.id === tabId)
    if (!tab) return
    const openLinkModal = () => {
      const view = useStore.getState().activeView()
      if (!view) return
      useStore.getState().openModal({ kind: 'link', pos: view.state.selection.from, initial: '' })
    }
    const view = new EditorView(host, {
      state: EditorState.create({
        doc: parseMarkdown(tab.initial),
        plugins: createPlugins(openLinkModal),
      }),
      nodeViews: buildNodeViews(),
      dispatchTransaction(tr) {
        const newState = view.state.apply(tr)
        view.updateState(newState)
        useStore.getState().updateDocMeta(tabId, view)
      },
      handleDOMEvents: {
        click(v, event) {
          return handleEditorClick(v, event)
        },
        paste(v, event) {
          return handleEditorPaste(v, event as ClipboardEvent)
        },
        drop(v, event) {
          return handleEditorDrop(v, event as DragEvent)
        },
        copy(v, event) {
          return handleEditorCopy(v, event as ClipboardEvent)
        },
        cut(v, event) {
          return handleEditorCopy(v, event as ClipboardEvent)
        },
      },
    })
    useStore.getState().setView(tabId, view)
    useStore.getState().updateDocMeta(tabId, view, { markDirty: false })
    return () => {
      view.destroy()
      useStore.getState().removeView(tabId)
    }
  }, [tabId])

  return <div className="pm-pane-inner" ref={hostRef} />
}

export default function Editor() {
  const tabs = useStore((s) => s.tabs)
  const activeTabId = useStore((s) => s.activeTabId)

  return (
    <div className="pm-host">
      {tabs.map((t) => (
        <div key={t.id} className={`pm-pane ${t.id === activeTabId ? 'active' : ''}`}>
          <EditorPane tabId={t.id} />
        </div>
      ))}
    </div>
  )
}
