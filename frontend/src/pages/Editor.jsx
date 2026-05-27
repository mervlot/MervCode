import { useEffect, useRef } from "react";
import { EditorView, keymap } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { Compartment } from "@codemirror/state";
import { defaultKeymap } from "@codemirror/commands";
import { customKeymap } from "../vars/keymap";
import { formatDocument } from "../editor/format";
import { editorRegistry, fallbackRegistry } from "../editor/registry";

export default function Editor({
  doc = "",
  langKey = "js",
  extensions = [],
  onCursorChange,
  onReady,
}) {
  const ref = useRef(null);
  const viewRef = useRef(null);

  const extCompartment = useRef(new Compartment());

  useEffect(() => {
    if (!ref.current) return;

    const cursorListener = EditorView.updateListener.of((update) => {
      if (update.selectionSet || update.docChanged) {
        const pos = update.state.selection.main.head;
        const line = update.state.doc.lineAt(pos);

        onCursorChange?.({
          line: line.number,
          column: pos - line.from + 1,
        });
      }
    });

    const formatKey = EditorView.domEventHandlers({
      keydown: (event, view) => {
        if (event.key === "F12") {
          event.preventDefault();
          formatFile(view);
          return true;
        }
        return false;
      },
    });

    const state = EditorState.create({
      doc,
      extensions: [
        extCompartment.current.of([ ...extensions]),
        cursorListener,
        formatKey,
        keymap.of([...defaultKeymap, ...customKeymap]),
      ],
    });

    const view = new EditorView({
      state,
      parent: ref.current,
    });

    viewRef.current = view;
    onReady?.(view);

    return () => view.destroy();
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    view.dispatch({
      effects: extCompartment.current.reconfigure(extensions),
    });
  }, [extensions]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const current = view.state.doc.toString();
    if (current === doc) return;

    view.dispatch({
      changes: {
        from: 0,
        to: current.length,
        insert: doc,
      },
    });
  }, [doc]);

  const formatFile = async (view) => {
    const config = editorRegistry[langKey] || fallbackRegistry;

    const code = view.state.doc.toString();
    const formatted = await config.formatter?.(code);

    if (!formatted || formatted === code) return;

    view.dispatch({
      changes: {
        from: 0,
        to: view.state.doc.length,
        insert: formatted,
      },
    });
  };

  return <div ref={ref} className="w-full h-full min-h-0" />;
}
