import { useEffect, useRef } from 'react'
import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { python } from '@codemirror/lang-python'
import { basicSetup } from 'codemirror'

export default function CodeEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const element = useRef<HTMLDivElement>(null)
  const editor = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  useEffect(() => {
    if (!element.current) return
    const view = new EditorView({ parent: element.current, state: EditorState.create({ doc: value, extensions: [basicSetup, python(), EditorView.lineWrapping, EditorView.contentAttributes.of({ 'aria-label': '括号匹配 Python 源码' }), EditorView.updateListener.of(update => { if (update.docChanged) onChangeRef.current(update.state.doc.toString()) }), EditorView.theme({ '&': { minHeight: '270px', fontSize: '14px', backgroundColor: '#fbfaf6' }, '.cm-content': { fontFamily: 'Consolas, monospace', padding: '18px 0' }, '.cm-gutters': { backgroundColor: '#f2f1e9', borderRight: '1px solid #deded4', color: '#73766e' }, '&.cm-focused': { outline: '2px solid #327064', outlineOffset: '2px' } })] }) })
    editor.current = view
    return () => { view.destroy(); editor.current = null }
  }, [])
  useEffect(() => { const view = editor.current; if (view && view.state.doc.toString() !== value) view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } }) }, [value])
  return <div className="code-editor" ref={element}/>
}
