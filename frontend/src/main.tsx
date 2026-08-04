import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import "bootstrap-icons/font/bootstrap-icons.css";
import App from "./App";
import "./index.css";
import { installBackendTracing } from "./lib/backendLog";

// Wrap every Wails Go binding so ALL frontend -> backend traffic is logged
// to the browser console (method, args, result, latency) - see
// lib/backendLog.ts. Must run before any component calls the backend.
installBackendTracing();

import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import cssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import htmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
// Import Monaco workers using Vite's explicit ?worker query
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";

self.MonacoEnvironment = {
  getWorker(_: any, label: string) {
    if (label === "json") {
      return new jsonWorker();
    }
    if (label === "css" || label === "scss" || label === "less") {
      return new cssWorker();
    }
    if (label === "html" || label === "handlebars" || label === "razor") {
      return new htmlWorker();
    }
    if (
      label === "typescript" ||
      label === "typescriptreact" ||
      label === "javascript" ||
      label === "javascriptreact"
    ) {
      return new tsWorker();
    }
    return new editorWorker();
  },
};

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

ReactDOM.createRoot(rootElement).render(
  <HashRouter>
    <App />
  </HashRouter>,
);
