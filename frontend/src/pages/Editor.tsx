import { useEffect, useRef } from "react";
import * as monaco from "monaco-editor";

import { setupMonaco } from "../editor/monaco/setup";
import { applyLanguageFeatures } from "../editor/monaco/apply";
import {
  toMonacoOptions,
  toModelOptions,
} from "../editor/monaco/toMonacoOptions";
import { getCustomActions } from "../editor/keybinding";
import { useTheme } from "../contexts/ThemeContext";
import type { EditorSettings } from "../types";

interface EditorProps {
  doc?: string;
  langKey?: string;
  path?: string;
  settings?: EditorSettings;
  onCursorChange?: (pos: { line: number; column: number }) => void;
  onReady?: (editor: monaco.editor.IStandaloneCodeEditor) => void;
  onSave?: (content: string) => void | Promise<void>;
  onChange?: (content: string) => void;
  rootPath?: string | undefined;
  active?: boolean | undefined;
}

export default function Editor({
  doc = "",
  langKey = "plaintext",
  path = "active_file.txt",
  settings,
  onCursorChange,
  onReady,
  onSave,
  onChange,
  rootPath,
  active,
}: EditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const modelRef = useRef<monaco.editor.ITextModel | null>(null);
  const onSaveRef = useRef(onSave);
  const onChangeRef = useRef(onChange);
  const settingsRef = useRef(settings);
  const rootPathRef = useRef(rootPath);
  // Tracks which rootPath value the currently-active LSP connection was
  // opened with, so the effect below can tell "rootPath prop changed" from
  // "rootPath prop re-rendered with the same value".
  const appliedRootPathRef = useRef<string | undefined>(undefined);
  const lspCleanupRef = useRef<(() => void) | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { theme } = useTheme();

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

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
        theme: theme === "light" ? "vs" : "vs-dark",
        ...(settingsRef.current ? toMonacoOptions(settingsRef.current) : {}),
      });

      editorRef.current = editor;

      const customActions = getCustomActions({
        onSave: async (content) => {
          const s = settingsRef.current;
          if (s?.formatOnSave) {
            await editor.getAction("editor.action.formatDocument")?.run();
            content = model.getValue();
          }
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

      lspCleanupRef.current?.();
      appliedRootPathRef.current = rootPathRef.current;
      lspCleanupRef.current =
        applyLanguageFeatures(langKey, editor, model, rootPathRef.current) ??
        null;

      editor.onDidChangeCursorPosition((e) => {
        onCursorChange?.({
          line: e.position.lineNumber,
          column: e.position.column,
        });
      });

      const changeSub = model.onDidChangeContent(() => {
        onChangeRef.current?.(model.getValue());

        const s = settingsRef.current;
        if (s?.autoSave) {
          if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
          }
          autoSaveTimerRef.current = setTimeout(async () => {
            if (s?.formatOnSave) {
              await editor.getAction("editor.action.formatDocument")?.run();
            }
            onSaveRef.current?.(model.getValue());
          }, 1000);
        }
      });

      editor.addCommand(
        monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.KeyF,
        () => {
          editor.getAction("editor.action.formatDocument")?.run();
        },
      );

      onReady?.(editor);

      return () => {
        lspCleanupRef.current?.();
        lspCleanupRef.current = null;
        if (autoSaveTimerRef.current) {
          clearTimeout(autoSaveTimerRef.current);
        }
        changeSub.dispose();
        editor.dispose();
        const existingModel = monaco.editor.getModel(uri);
        if (existingModel) existingModel.dispose();
      };
    } catch (error) {
      console.error("[MervCode] Failed to initialize Monaco editor:", error);
      return undefined;
    }
  }, [path]);

  useEffect(() => {
    rootPathRef.current = rootPath;

    // The workspace root often isn't known yet the moment a restored tab's
    // editor mounts (ExplorerPanel resolves it asynchronously), so the
    // mount effect above can end up opening the LSP connection with an
    // undefined/stale rootPath. Once the real root arrives, re-wire the
    // connection so the language server is spawned/queried against the
    // actual opened project instead of being stuck on whatever fallback it
    // started with.
    if (appliedRootPathRef.current === rootPath) return;

    const model = modelRef.current;
    const editor = editorRef.current;
    if (!model || !editor) return;

    appliedRootPathRef.current = rootPath;
    lspCleanupRef.current?.();
    lspCleanupRef.current =
      applyLanguageFeatures(langKey, editor, model, rootPath) ?? null;
  }, [rootPath]);

  useEffect(() => {
    const model = modelRef.current;
    if (!model) return;

    if (model.getValue() !== doc) {
      model.setValue(doc);
    }
  }, [doc]);

  useEffect(() => {
    const model = modelRef.current;
    const editor = editorRef.current;
    if (!model || !editor) return;

    monaco.editor.setModelLanguage(model, langKey);

    appliedRootPathRef.current = rootPathRef.current;
    lspCleanupRef.current?.();
    lspCleanupRef.current =
      applyLanguageFeatures(langKey, editor, model, rootPathRef.current) ??
      null;
  }, [langKey]);

  useEffect(() => {
    monaco.editor.setTheme(theme === "light" ? "vs" : "vs-dark");
  }, [theme]);

  useEffect(() => {
    const editor = editorRef.current;
    const model = modelRef.current;
    if (!editor || !settings) return;

    editor.updateOptions(toMonacoOptions(settings));
    model?.updateOptions(toModelOptions(settings));
    // updateOptions can change values that affect the editor's pixel
    // dimensions (padding, lineHeight, minimap, scrollbar sizes) without
    // Monaco's automaticLayout ResizeObserver ever firing, since the
    // container element itself doesn't resize - only its internal layout
    // does. Forcing a layout() keeps the viewport/scroll metrics in sync.
    editor.layout();
  }, [settings]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !active) return;
    // Wait a frame so the container's display:none -> block transition
    // has actually taken effect before measuring it.
    const raf = requestAnimationFrame(() => {
      editor.layout();
      editor.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, [active]);

  return <div ref={containerRef} className="w-full h-full min-h-0" />;
}