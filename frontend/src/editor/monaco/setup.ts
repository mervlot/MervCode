import * as monaco from "monaco-editor";
import { registerFileLinks } from "./linkProvider";
import { conf as tsConf, language as tsLanguage } from "monaco-editor/esm/vs/basic-languages/typescript/typescript";
import { conf as jsConf, language as jsLanguage } from "monaco-editor/esm/vs/basic-languages/javascript/javascript";

let initialized = false;

export function setupMonaco() {
  if (initialized) return;

  initialized = true;

  registerFileLinks();

  // Custom @font-face webfonts (Monaspace, see index.css) load
  // asynchronously. If Monaco measures character widths before they've
  // finished loading, it caches metrics for whatever the browser fell
  // back to in that instant; when the real font swaps in moments later
  // the visible glyphs change width but Monaco's cached measurements
  // don't, desyncing the caret's pixel position from the actual text
  // (logical cursor position - typing, clicking, arrow keys - is
  // unaffected, since that never depends on font metrics). Re-measuring
  // once every currently-loading font has settled fixes the cache for
  // every already-created editor instance.
  if (typeof document !== "undefined" && document.fonts) {
    document.fonts.ready
      .then(() => monaco.editor.remeasureFonts())
      .catch(() => undefined);
  }

  monaco.editor.defineTheme("merv-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: {},
  });

  monaco.editor.setTheme("merv-dark");

  monaco.languages.register({ id: "typescriptreact", extensions: [".tsx"], aliases: ["TSX"] });
  monaco.languages.setLanguageConfiguration("typescriptreact", tsConf);
  monaco.languages.setMonarchTokensProvider("typescriptreact", tsLanguage);

  monaco.languages.register({ id: "javascriptreact", extensions: [".jsx"], aliases: ["JSX"] });
  monaco.languages.setLanguageConfiguration("javascriptreact", jsConf);
  monaco.languages.setMonarchTokensProvider("javascriptreact", jsLanguage);

  // Monaco bundles its own standalone TypeScript worker (wired up in
  // main.tsx) that runs independently of typescript-language-server via
  // MervCode's LSP bridge. It has no knowledge of the real project's
  // tsconfig.json (jsx, paths, etc.) and defaults to jsx-less compiler
  // options, which is what produces the "Cannot use JSX unless the
  // '--jsx' flag is provided" (17004) error on .tsx/.jsx files, plus
  // duplicate/conflicting diagnostics against the real, project-aware
  // LSP. Since the LSP bridge already supplies accurate
  // hover/completion/definition/diagnostics for these languages, turn
  // off Monaco's own semantic + syntax validation so it only
  // contributes tokenization/basic editing features.
  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: true,
    noSyntaxValidation: true,
  });
  monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: true,
    noSyntaxValidation: true,
  });

  // Keep compiler options sane (jsx included) in case anything still
  // reads them (e.g. future features that re-enable validation).
  monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
    jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
    target: monaco.languages.typescript.ScriptTarget.ESNext,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    allowNonTsExtensions: true,
    esModuleInterop: true,
  });
  monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
    jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
    target: monaco.languages.typescript.ScriptTarget.ESNext,
    allowNonTsExtensions: true,
    esModuleInterop: true,
  });
}