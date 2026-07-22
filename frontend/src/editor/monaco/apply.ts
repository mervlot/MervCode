import * as monaco from "monaco-editor";
import { registry } from "./registry";

export function applyLanguageFeatures(
  language: string,
  editor: monaco.editor.IStandaloneCodeEditor,
  model: monaco.editor.ITextModel,
): (() => void) | void {
  const lang = registry[language];

  if (!lang) return;

  lang.setup?.();
  lang.diagnostics?.(model);

  const lspCleanup = lang.lsp?.(editor, model);

  if (lang.formatter) {
    const formatterDisposable =
      monaco.languages.registerDocumentFormattingEditProvider(language, {
        provideDocumentFormattingEdits: (model) => lang.formatter!(model),
      });
    const origCleanup = lspCleanup;
    return () => {
      origCleanup?.();
      formatterDisposable.dispose();
    };
  }

  return lspCleanup;
}
