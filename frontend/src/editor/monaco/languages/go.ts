import * as monaco from "monaco-editor";

import type { MonacoLanguage } from "../types";
import { openLSPDocument } from "../lspClient";
import { FormatDocument } from "../../../../wailsjs/go/main/App";

export const go: MonacoLanguage = {
  id: "go",

  lsp(editor, model, rootPath) {
    return openLSPDocument(editor, model, rootPath);
  },

  async formatter(model) {
    const formatted = await FormatDocument(
      "go",
      model.uri.fsPath,
      model.getValue(),
    );

    return [
      {
        range: model.getFullModelRange(),
        text: formatted,
      },
    ];
  },
};
