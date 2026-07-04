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
}
