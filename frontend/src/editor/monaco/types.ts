import * as monaco from "monaco-editor";

export interface MonacoLanguage {
  id: string;

  setup?(): void;

  formatter?(
    model: monaco.editor.ITextModel,
  ): Promise<monaco.languages.TextEdit[]>;

  diagnostics?(model: monaco.editor.ITextModel): void;

  lsp?(editor: monaco.editor.IStandaloneCodeEditor): void;
}
