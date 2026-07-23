import * as monaco from "monaco-editor";

let initialized = false;

export function setupMonaco() {
  if (initialized) return;

  initialized = true;

  monaco.editor.defineTheme("merv-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: {},
  });

  monaco.editor.setTheme("merv-dark");

  // Monaco bundles its own standalone TypeScript worker (wired up in
  // main.tsx) that runs independently of our external
  // typescript-language-server LSP proxy. It has no knowledge of the
  // real project's tsconfig.json (jsx, paths, etc.) and defaults to
  // jsx-less compiler options, which is what produces the
  // "Cannot use JSX unless the '--jsx' flag is provided" (17004) error
  // on .tsx/.jsx files, plus duplicate/conflicting diagnostics against
  // the real, project-aware LSP. Since the LSP proxy already supplies
  // accurate hover/completion/definition/diagnostics for these
  // languages, turn off Monaco's own semantic + syntax validation so
  // it only contributes tokenization/basic editing features.
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