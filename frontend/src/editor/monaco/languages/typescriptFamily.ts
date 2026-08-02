import type { MonacoLanguage } from "../types";
import { openLSPDocument } from "../../lsp";
import { registerLinter } from "../../lint";
import { FormatDocument } from "../../../../wailsjs/go/main/App";

// TypeScript, TSX, JavaScript, and JSX all share one "typescript" backend
// toolchain entry (see toolchain.go) - one typescript-language-server LSP
// connection, one Prettier formatter, one ESLint linter - regardless of
// which of the four concrete Monaco language IDs the open file actually
// is. That's why `lsp`/`formatter`/`linter` below all explicitly pass
// "typescript" rather than using Monaco's own language id.
function createTypeScriptLanguage(
  id: "typescript" | "typescriptreact" | "javascript" | "javascriptreact",
): MonacoLanguage {
  return {
    id,

    lsp(editor, model, rootPath) {
      return openLSPDocument(editor, model, rootPath, "typescript");
    },

    async formatter(model) {
      const formatted = await FormatDocument(
        "typescript",
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

    linter(model) {
      return registerLinter("typescript", model);
    },
  };
}

export const typescript = createTypeScriptLanguage("typescript");

export const typescriptreact = createTypeScriptLanguage("typescriptreact");

export const javascript = createTypeScriptLanguage("javascript");

export const javascriptreact = createTypeScriptLanguage("javascriptreact");
