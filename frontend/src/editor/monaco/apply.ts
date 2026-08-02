import * as monaco from "monaco-editor";
import { registry } from "./registry";

export function applyLanguageFeatures(
  language: string,
  editor: monaco.editor.IStandaloneCodeEditor,
  model: monaco.editor.ITextModel,
  rootPath?: string,
): (() => void) | void {
  const lang = registry[language];

  if (!lang) return;

  lang.setup?.();
  lang.diagnostics?.(model);

  const cleanups: Array<() => void> = [];

  const lspCleanup = lang.lsp?.(editor, model, rootPath);
  if (lspCleanup) cleanups.push(lspCleanup);

  const linterCleanup = lang.linter?.(model);
  if (linterCleanup) cleanups.push(linterCleanup);

  if (lang.formatter) {
    const formatterDisposable =
      monaco.languages.registerDocumentFormattingEditProvider(language, {
        provideDocumentFormattingEdits: (model) => lang.formatter!(model),
      });
    cleanups.push(() => formatterDisposable.dispose());
  }

  if (cleanups.length === 0) return undefined;
  return () => cleanups.forEach((cleanup) => cleanup());
}
