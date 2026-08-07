import type { MonacoLanguage } from "../types";
import { openLSPDocument } from "../../lsp";
import { registerLinter } from "../../lint";
import { FormatDocument } from "../../../../wailsjs/go/main/App";

// Uses the bundled Kotlin LSP runtime under runtime/kotlin and the
// configured ktfmt/ktlint backend tooling from toolchain.go.
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
