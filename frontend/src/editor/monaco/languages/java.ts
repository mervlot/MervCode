import type { MonacoLanguage } from "../types";
import { openLSPDocument } from "../../lsp";
import { registerLinter } from "../../lint";
import { FormatDocument } from "../../../../wailsjs/go/main/App";

// Uses the bundled JDTLS runtime under runtime/java and the configured
// google-java-format/Checkstyle backend tooling from toolchain.go.
export const java: MonacoLanguage = {
  id: "java",

  lsp(editor, model, rootPath) {
    return openLSPDocument(editor, model, rootPath);
  },

  async formatter(model) {
    const formatted = await FormatDocument(
      "java",
      model.uri.fsPath,
      model.getValue(),
    );

    return [{ range: model.getFullModelRange(), text: formatted }];
  },

  linter(model) {
    return registerLinter("java", model);
  },
};
