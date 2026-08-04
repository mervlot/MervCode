import * as monaco from "monaco-editor";
import { registry } from "./registry";

const registeredFormatters = new Set<string>();

function registerFormatterOnce(language: string): void {
  if (registeredFormatters.has(language)) return;

  const lang = registry[language];
  if (!lang?.formatter) return;

  // Monaco formatting providers are global for a language id. Registering one
  // per open editor tab means formatting a single .jsx file can trigger several
  // identical Prettier calls (one closure per hidden tab), and the first/stale
  // provider to answer wins. One provider per concrete language keeps the
  // protocol deterministic while still formatting whichever model Monaco passes
  // into provideDocumentFormattingEdits.
  monaco.languages.registerDocumentFormattingEditProvider(language, {
    provideDocumentFormattingEdits: (model) => {
      console.log(
        `[monaco] format request language=${language} modelLanguage=${model.getLanguageId()} uri=${model.uri.toString()}`,
      );
      return lang.formatter!(model);
    },
  });
  registeredFormatters.add(language);
}

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

  registerFormatterOnce(language);

  if (cleanups.length === 0) return undefined;
  return () => cleanups.forEach((cleanup) => cleanup());
}
