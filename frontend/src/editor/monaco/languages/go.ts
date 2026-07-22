import * as monaco from "monaco-editor";

import type { MonacoLanguage } from "../types";
import { openLSPDocument } from "../lsp";

export const go: MonacoLanguage = {
  id: "go",

  lsp(editor, _model) {
    return openLSPDocument(editor);
  },
};
