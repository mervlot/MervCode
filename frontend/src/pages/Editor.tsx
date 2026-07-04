import { useEffect, useRef } from "react";
import * as monaco from "monaco-editor";

import { setupMonaco } from "../editor/monaco/setup";
import { applyLanguageFeatures } from "../editor/monaco/apply";

interface EditorProps {
  doc?: string;
  langKey?: string;
  path?: string;
  onCursorChange?: (pos: { line: number; column: number }) => void;
  onReady?: (editor: monaco.editor.IStandaloneCodeEditor) => void;
}

export default function Editor({
  doc = "",
  langKey = "plaintext",
  path = "active_file.txt",
  onCursorChange,
  onReady,
}: EditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const modelRef = useRef<monaco.editor.ITextModel | null>(null);

  useEffect(() => {
    setupMonaco();

    if (!containerRef.current) return;

    const uri = monaco.Uri.file(path);

    const model =
      monaco.editor.getModel(uri) ??
      monaco.editor.createModel(doc, langKey, uri);

    modelRef.current = model;

    const editor = monaco.editor.create(containerRef.current, {
      model,
      automaticLayout: true,
      minimap: {
        enabled: false,
      },
      fontLigatures: true,
      smoothScrolling: true,
      tabSize: 2,
      insertSpaces: true,
      formatOnPaste: true,
      formatOnType: true,
    });

    editorRef.current = editor;

    // 👇 Apply formatter, linter, LSP, snippets...
    applyLanguageFeatures(langKey, editor, model);

    editor.onDidChangeCursorPosition((e) => {
      onCursorChange?.({
        line: e.position.lineNumber,
        column: e.position.column,
      });
    });

    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.KeyF,
      () => {
        editor.getAction("editor.action.formatDocument")?.run();
      },
    );

    onReady?.(editor);

    return () => {
      editor.dispose();
      model.dispose();
    };
  }, []);

  useEffect(() => {
    const model = modelRef.current;
    if (!model) return;

    if (model.getValue() !== doc) {
      model.setValue(doc);
    }
  }, [doc]);

  useEffect(() => {
    const model = modelRef.current;
    if (!model) return;

    monaco.editor.setModelLanguage(model, langKey);

    if (editorRef.current) {
      applyLanguageFeatures(langKey, editorRef.current, model);
    }
  }, [langKey]);

  return <div ref={containerRef} className='w-full h-full min-h-0' />;
}
