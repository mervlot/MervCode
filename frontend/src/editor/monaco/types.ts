import * as monaco from "monaco-editor";

export interface MonacoLanguage {
  id: string;

  setup?(): void;

  formatter?(
    model: monaco.editor.ITextModel,
  ): Promise<monaco.languages.TextEdit[]>;

  diagnostics?(model: monaco.editor.ITextModel): void;

  /**
   * Starts this language's configured linter (see toolchain.go's
   * LanguageToolchain.Linter and editor/lint/) against `model`. Returns a
   * cleanup function that stops linting and clears its markers - called
   * whenever the document closes or the language changes, exactly like
   * `lsp`'s cleanup contract below. Optional - languages with no linter
   * configured simply omit this.
   */
  linter?(model: monaco.editor.ITextModel): (() => void) | void;

  lsp?(
    editor: monaco.editor.IStandaloneCodeEditor,
    model: monaco.editor.ITextModel,
    rootPath?: string,
  ): (() => void) | void;
}
