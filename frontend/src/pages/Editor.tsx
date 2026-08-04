import * as monaco from "monaco-editor";
import { useEffect, useRef } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { getCustomActions } from "../editor/keybinding";
import { applyLanguageFeatures } from "../editor/monaco/apply";
import { setupMonaco } from "../editor/monaco/setup";
import { toModelOptions, toMonacoOptions } from "../editor/monaco/toMonacoOptions";
import { summarizeText } from "../lib/backendLog";
import type { EditorSettings } from "../types";

// Logs Monaco's view of a file without leaking a full buffer. These are the
// tags used everywhere in the dev console: `[monaco]` = what Monaco itself
// sees, `[backend →/←]` = calls that reach Go (lib/backendLog.ts).
function mlog(message: string, ...args: unknown[]): void {
  console.log(`[monaco] ${message}`, ...args);
}

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
  // Tracks which feature wiring is active for this editor. LSP/lint providers
  // are intentionally attached only while a tab is active; hidden tabs keep
  // their Monaco model but do not spawn/hold language-server documents. This
  // prevents Java/Kotlin projects from starting several JDTLS/Kotlin LSP
  // processes for the same root when restored tabs render in the background.
  const appliedRootPathRef = useRef<string | undefined>(undefined);
  const appliedLangRef = useRef<string | null>(null);
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: one editor instance per path; langKey/doc/theme/rootPath apply through their own effects below
  useEffect(() => {
    if (!containerRef.current) return;

    try {
      mlog(
        `mount: path=${path} langKey=${langKey} docBytes=${doc.length} rootPath=${
          rootPathRef.current ?? "(none)"
        } active=${active}`,
      );
      setupMonaco();

      const uri = monaco.Uri.file(path);

      const existingModel = monaco.editor.getModel(uri);
      const model = existingModel ?? monaco.editor.createModel(doc, langKey, uri);

      modelRef.current = model;

      mlog(
        `model ${existingModel ? "reused" : "created"} for ${uri.toString()}: languageId=${model.getLanguageId()} valueBytes=${model.getValue().length}`,
      );

      const editor = monaco.editor.create(containerRef.current, {
        model,
        automaticLayout: true,
        theme: theme === "light" ? "vs" : "vs-dark",
        ...(settingsRef.current ? toMonacoOptions(settingsRef.current) : {}),
      });

      editorRef.current = editor;
      mlog(`editor instance created for ${path}`);

      const customActions = getCustomActions({
        onSave: async (content) => {
          const s = settingsRef.current;
          if (s?.formatOnSave) {
            await editor.getAction("editor.action.formatDocument")?.run();
            content = model.getValue();
          }
          if (onSaveRef.current) {
            mlog(`save requested for ${path}, bytes=${content.length}`);
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

      editor.onDidChangeCursorPosition((e) => {
        onCursorChange?.({
          line: e.position.lineNumber,
          column: e.position.column,
        });
      });

      const changeSub = model.onDidChangeContent((event) => {
        mlog(
          `content change on ${path}: ${event.changes.length} edit(s)`,
          event.changes.map((c) => ({
            range: `${c.range.startLineNumber}:${c.range.startColumn}->${c.range.endLineNumber}:${c.range.endColumn}`,
            text: summarizeText(c.text),
          })),
          `totalBytes=${model.getValue().length}`,
        );
        onChangeRef.current?.(model.getValue());

        const s = settingsRef.current;
        if (s?.autoSave === "afterDelay") {
          if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
          }
          autoSaveTimerRef.current = setTimeout(async () => {
            mlog(`auto-save firing for ${path}`);
            if (s?.formatOnSave) {
              await editor.getAction("editor.action.formatDocument")?.run();
            }
            onSaveRef.current?.(model.getValue());
          }, s.autoSaveDelay);
        }
      });

      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.KeyF, () => {
        editor.getAction("editor.action.formatDocument")?.run();
      });

      const blurSub = editor.onDidBlurEditorWidget(() => {
        const s = settingsRef.current;
        if (s?.autoSave !== "onFocusChange") return;
        void onSaveRef.current?.(model.getValue());
      });

      const windowBlurHandler = () => {
        const s = settingsRef.current;
        if (s?.autoSave !== "onWindowChange") return;
        void onSaveRef.current?.(model.getValue());
      };
      window.addEventListener("blur", windowBlurHandler);

      onReady?.(editor);

      return () => {
        mlog(`unmount: disposing editor/model for ${path}`);
        lspCleanupRef.current?.();
        lspCleanupRef.current = null;
        appliedLangRef.current = null;
        appliedRootPathRef.current = undefined;
        if (autoSaveTimerRef.current) {
          clearTimeout(autoSaveTimerRef.current);
        }
        changeSub.dispose();
        blurSub.dispose();
        window.removeEventListener("blur", windowBlurHandler);
        editor.dispose();
        const existingModel = monaco.editor.getModel(uri);
        if (existingModel) existingModel.dispose();
      };
    } catch (error) {
      console.error("[MervCode] Failed to initialize Monaco editor:", error);
      console.error("[monaco] init failed for", { path, langKey });
      return undefined;
    }
  }, [path]);

  useEffect(() => {
    rootPathRef.current = rootPath;

    const model = modelRef.current;
    const editor = editorRef.current;
    if (!model || !editor) return;

    if (model.getLanguageId() !== langKey) {
      mlog(`language change: ${model.getLanguageId()} -> ${langKey} for ${path}`);
      monaco.editor.setModelLanguage(model, langKey);
      mlog(`monaco now sees languageId=${model.getLanguageId()} for ${path}`);
    }

    if (!active) {
      if (lspCleanupRef.current) {
        mlog(`language features suspended for inactive tab: ${path}`);
        lspCleanupRef.current();
        lspCleanupRef.current = null;
      }
      appliedRootPathRef.current = undefined;
      appliedLangRef.current = null;
      return;
    }

    const sameRoot = appliedRootPathRef.current === rootPath;
    const sameLang = appliedLangRef.current === langKey;
    if (lspCleanupRef.current && sameRoot && sameLang) return;

    lspCleanupRef.current?.();
    appliedRootPathRef.current = rootPath;
    appliedLangRef.current = langKey;
    lspCleanupRef.current = applyLanguageFeatures(langKey, editor, model, rootPath) ?? null;
    mlog(
      `language features active: lang=${langKey} root=${rootPath ?? "(auto)"} path=${path}`,
    );
  }, [active, langKey, rootPath, path]);

  useEffect(() => {
    const model = modelRef.current;
    if (!model) return;

    if (model.getValue() !== doc) {
      mlog(
        `syncing model content for ${path} (model=${model.getValue().length}B, doc prop=${doc.length}B)`,
      );
      model.setValue(doc);
    }
  }, [doc, path]);



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
