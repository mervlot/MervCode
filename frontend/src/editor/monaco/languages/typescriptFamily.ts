import type { MonacoLanguage } from "../types";
import { openLSPDocument } from "../lspClient";

function createTypeScriptLanguage(
  id:
    | "typescript"
    | "typescriptreact"
    | "javascript"
    | "javascriptreact",
): MonacoLanguage {
  return {
    id,

    lsp(editor, model, rootPath) {
      return openLSPDocument(
        editor,
        model,
        rootPath,
        "typescript",
      );
    },
  };
}

export const typescript = createTypeScriptLanguage("typescript");

export const typescriptreact =
  createTypeScriptLanguage("typescriptreact");

export const javascript =
  createTypeScriptLanguage("javascript");

export const javascriptreact =
  createTypeScriptLanguage("javascriptreact");