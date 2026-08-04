import type { MonacoLanguage } from "../types";
import { openLSPDocument } from "../../lsp";
import { registerLinter } from "../../lint";
import { FormatDocument } from "../../../../wailsjs/go/main/App";

// Requires kotlin-language-server on PATH — see the "kotlin" entry in
// toolchain.go for install instructions. No external formatter is wired
// up yet; format-on-save/format-document for Kotlin isn't available
// until one is added.
export const kotlin: MonacoLanguage = {
  id: "kotlin",

  lsp(editor, model, rootPath) {
    return openLSPDocument(editor, model, rootPath);
  },

  async formatter(model) {
    const formatted = await FormatDocument(
      "kotlin",
      model.uri.fsPath,
      model.getValue(),
    );

    return [{ range: model.getFullModelRange(), text: formatted }];
  },

  linter(model) {
    return registerLinter("kotlin", model);
  },
};
