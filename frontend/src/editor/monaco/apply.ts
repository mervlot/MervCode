import * as monaco from "monaco-editor";
import { registry } from "./registry";

export function applyLanguageFeatures(
  language: string,
  editor: monaco.editor.IStandaloneCodeEditor,
  model: monaco.editor.ITextModel,
) {
  const lang = registry[language];

  if (!lang) return;

  lang.setup?.();
  lang.diagnostics?.(model);
  lang.lsp?.(editor);

  if (lang.formatter) {
    monaco.languages.registerDocumentFormattingEditProvider(language, {
      provideDocumentFormattingEdits: (model) => lang.formatter!(model),
    });
  }
  console.log("Applied language:", language);
}