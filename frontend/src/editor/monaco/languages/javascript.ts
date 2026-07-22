import * as monaco from "monaco-editor";
import prettier from "prettier/standalone";
import babelPlugin from "prettier/plugins/babel";
import estreePlugin from "prettier/plugins/estree";

import type { MonacoLanguage } from "../types";
import { openLSPDocument } from "../lsp";

export const javascript: MonacoLanguage = {
  id: "javascript",

  lsp(editor, _model) {
    return openLSPDocument(editor);
  },

  async formatter(model) {
    const formatted = await prettier.format(model.getValue(), {
      parser: "babel",
      plugins: [babelPlugin, estreePlugin],
    });

    return [
      {
        range: model.getFullModelRange(),
        text: formatted,
      },
    ];
  },
};
