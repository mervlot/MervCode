import * as monaco from "monaco-editor";

import type { MonacoLanguage } from "../types";
import { openLSPDocument } from "../../lsp";
import { registerLinter } from "../../lint";
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

  // golangci-lint has no stdin mode, so this always reflects the file's
  // last-saved contents on disk rather than live unsaved edits (see
  // golangci-lint.go) - the debounce in editor/lint/runner.ts still fires
  // on every keystroke pause, which is slightly wasteful for Go (nothing
  // changes until the next save) but self-corrects the moment the file is
  // saved and editing continues.
  linter(model) {
    return registerLinter("go", model);
  },
};
