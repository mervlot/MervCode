import type { MonacoLanguage } from "../types";
import { openLSPDocument } from "../../lsp";
import { registerLinter } from "../../lint";
import { FormatDocument } from "../../../../wailsjs/go/main/App";
import { languageLabel, type TypeScriptFamilyLanguageId } from "../../languageIds";

// TypeScript, TSX, JavaScript, and JSX all share one "typescript" backend
// toolchain entry (see toolchain.go) - one typescript-language-server LSP
// connection, one Prettier formatter, one ESLint linter - regardless of
// which of the four concrete Monaco language IDs the open file actually
// is. That's why `lsp`/`formatter`/`linter` below all explicitly pass
// "typescript" rather than using Monaco's own language id.
const BACKEND_TOOLCHAIN = "typescript";

function createTypeScriptLanguage(id: TypeScriptFamilyLanguageId): MonacoLanguage {
  return {
    id,

    lsp(editor, model, rootPath) {
      console.log(
        `[ts-family] LSP attach ${languageLabel(id)}: monacoLanguage=${model.getLanguageId()} backendToolchain=${BACKEND_TOOLCHAIN} uri=${model.uri.toString()} root=${rootPath ?? "(auto)"}`,
      );
      return openLSPDocument(editor, model, rootPath, BACKEND_TOOLCHAIN);
    },

    async formatter(model) {
      const formatted = await FormatDocument(
        BACKEND_TOOLCHAIN,
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
      console.log(
        `[ts-family] ESLint attach ${languageLabel(id)}: backendToolchain=${BACKEND_TOOLCHAIN} uri=${model.uri.toString()}`,
      );
      return registerLinter(BACKEND_TOOLCHAIN, model);
    },
  };
}

export const typescript = createTypeScriptLanguage("typescript");

export const typescriptreact = createTypeScriptLanguage("typescriptreact");

export const javascript = createTypeScriptLanguage("javascript");

export const javascriptreact = createTypeScriptLanguage("javascriptreact");
