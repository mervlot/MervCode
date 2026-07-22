import { useEffect, useRef } from "react";
import * as monaco from "monaco-editor";

import { setupMonaco } from "../editor/monaco/setup";
import { applyLanguageFeatures } from "../editor/monaco/apply";
import { getCustomActions } from "../editor/keybinding";
import { useTheme } from "../contexts/ThemeContext";

interface EditorProps {
  doc?: string;
  langKey?: string;
  path?: string;
  fontSize?: number;
  onCursorChange?: (pos: { line: number; column: number }) => void;
  onReady?: (editor: monaco.editor.IStandaloneCodeEditor) => void;
  onSave?: (content: string) => void | Promise<void>;
  /** Fired on every keystroke so the host can track unsaved-changes state */
  onChange?: (content: string) => void;
}

export default function Editor({
  doc = "",
  langKey = "plaintext",
  path = "active_file.txt",
  fontSize = 14,
  onCursorChange,
  onReady,
  onSave,
  onChange,
}: EditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const modelRef = useRef<monaco.editor.ITextModel | null>(null);
  const onSaveRef = useRef(onSave);
  const onChangeRef = useRef(onChange);
  const { theme } = useTheme();

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!containerRef.current) return;

    try {
      setupMonaco();

      const uri = monaco.Uri.file(path);

      const model =
        monaco.editor.getModel(uri) ??
        monaco.editor.createModel(doc, langKey, uri);

      modelRef.current = model;

      const editor = monaco.editor.create(containerRef.current, {
        model,
        automaticLayout: true,
        minimap: { enabled: false },
        fontLigatures: true,
        smoothScrolling: true,
        tabSize: 2,
        insertSpaces: true,
        formatOnPaste: true,
        formatOnType: true,
        theme: theme === "light" ? "vs" : "vs-dark",
      });

      editorRef.current = editor;

      // 👇 Apply custom hotkey modules
      const customActions = getCustomActions({
        onSave: async (content) => {
          if (onSaveRef.current) {
            await onSaveRef.current(content);
          }
        },
      });

      customActions.forEach((action) => {
        const descriptor: monaco.editor.IActionDescriptor = {
          id: action.id,
          label: action.label,
          keybindings: action.keybindings,
          run: action.run,
        };

        if (action.contextMenuGroupId !== undefined) {
          descriptor.contextMenuGroupId = action.contextMenuGroupId;
        }
        if (action.contextMenuOrder !== undefined) {
          descriptor.contextMenuOrder = action.contextMenuOrder;
        }

        editor.addAction(descriptor);
      });

      applyLanguageFeatures(langKey, editor, model);

      editor.onDidChangeCursorPosition((e) => {
        onCursorChange?.({
          line: e.position.lineNumber,
          column: e.position.column,
        });
      });

      const changeSub = model.onDidChangeContent(() => {
        onChangeRef.current?.(model.getValue());
      });

      editor.addCommand(
        monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.KeyF,
        () => {
          editor.getAction("editor.action.formatDocument")?.run();
        },
      );

      onReady?.(editor);

      return () => {
        changeSub.dispose();
        editor.dispose();
        const existingModel = monaco.editor.getModel(uri);
        if (existingModel) existingModel.dispose();
      };
    } catch (error) {
      console.error("[MervCode] Failed to initialize Monaco editor:", error);
      // Swallow so the surrounding ErrorBoundary/tab UI stays intact rather
      // than crashing the whole render tree over one bad file.
      return undefined;
    }
  }, [path]);

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

  useEffect(() => {
    monaco.editor.setTheme(theme === "light" ? "vs" : "vs-dark");
  }, [theme]);

  useEffect(() => {
    editorRef.current?.updateOptions({ fontSize });
  }, [fontSize]);

  return <div ref={containerRef} className='w-full h-full min-h-0' />;
}
