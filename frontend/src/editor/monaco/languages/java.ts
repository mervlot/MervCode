import type { MonacoLanguage } from "../types";
import { openLSPDocument } from "../lspClient";

// Requires jdtls (Eclipse JDT Language Server) on PATH — see the
// "java" entry in toolchain.go for install instructions. No external
// formatter is wired up yet; format-on-save/format-document for Java
// isn't available until one is added.
export const java: MonacoLanguage = {
  id: "java",

  lsp(editor, model, rootPath) {
    return openLSPDocument(editor, model, rootPath);
  },
};
