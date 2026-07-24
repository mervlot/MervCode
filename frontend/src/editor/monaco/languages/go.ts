import * as monaco from "monaco-editor";

import type { MonacoLanguage } from "../types";
import { openLSPDocument } from "../lsp";
import { FormatDocument } from "../../../../wailsjs/go/main/App";

export const go: MonacoLanguage = {
  id: "go",

  lsp(editor, _model) {
    return openLSPDocument(editor);
  },

  async formatter(model) {
    const formatted = await FormatDocument("go", model.uri.fsPath, model.getValue());

    return [
      {
        range: model.getFullModelRange(),
        text: formatted,
      },
    ];
  },
};
