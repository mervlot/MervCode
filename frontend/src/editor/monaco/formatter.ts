import * as monaco from "monaco-editor";

export type Formatter = (
  model: monaco.editor.ITextModel,
) => Promise<monaco.languages.TextEdit[]>;
