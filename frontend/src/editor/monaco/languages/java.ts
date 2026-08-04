import type { MonacoLanguage } from "../types";
import { openLSPDocument } from "../../lsp";
import { registerLinter } from "../../lint";
import { FormatDocument } from "../../../../wailsjs/go/main/App";

// Requires jdtls (Eclipse JDT Language Server) on PATH — see the
// "java" entry in toolchain.go for install instructions. No external
// formatter is wired up yet; format-on-save/format-document for Java
// isn't available until one is added.
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
