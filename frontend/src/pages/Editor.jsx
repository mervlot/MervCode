import { useEffect, useRef } from "react"
import { EditorView, keymap } from "@codemirror/view"
import { EditorState } from "@codemirror/state"
import { basicSetup } from "codemirror"
import { customKeymap } from "../vars/keymap"
import { oneDark } from "@codemirror/theme-one-dark"
import { defaultKeymap } from "@codemirror/commands"

export default function Editor({ language, doc = "" }) {
  const ref = useRef(null)
  const viewRef = useRef(null)

  useEffect(() => {
    if (!ref.current) return

    const fullHeightTheme = EditorView.theme({
      "&": { height: "100%" },
      ".cm-scroller": { overflow: "auto" }
    })

    const state = EditorState.create({
      doc,
      extensions: [
        basicSetup,
        oneDark,
        fullHeightTheme,
        keymap.of([...defaultKeymap, ...customKeymap]),
        typeof language === "function" ? language() : []
      ]
    })

    const view = new EditorView({
      state,
      parent: ref.current,
    })

    viewRef.current = view

    return () => view.destroy()
  }, []) // ❗ IMPORTANT: run ONCE ONLY

  // sync file content without resetting editor state
  useEffect(() => {
    const view = viewRef.current
    if (!view) return

    const current = view.state.doc.toString()
    if (current === doc) return

    view.dispatch({
      changes: {
        from: 0,
        to: current.length,
        insert: doc,
      },
    })
  }, [doc])

  return (
    <div ref={ref} className="w-full h-full min-h-0 bg-[#282c34]" />
  )
}