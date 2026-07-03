import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
import { formatJS } from "./formatters/prettier";
import { go } from "@codemirror/lang-go";
import { rust } from "@codemirror/lang-rust";
import { html } from "@codemirror/lang-html";
import { json } from "@codemirror/lang-json";
import { python } from "@codemirror/lang-python";
import { css } from "@codemirror/lang-css";
import { markdown } from "@codemirror/lang-markdown";
import { sql } from "@codemirror/lang-sql";
import type { Extension } from "@codemirror/state";
// Instantiate extension items for easy plug-and-play mapping

type EditorRegistryEntry = {
  formatter: ((code: string, parser?: string) => string | Promise<string>) | null;
  extensions: Extension[];
};

export const editorRegistry: Record<string, EditorRegistryEntry> = {
  js: {
    formatter: (code) => formatJS(code, "js"),
    extensions: [
      javascript(),

    ],
  },

  ts: {
    formatter: (code) => formatJS(code, "ts"),
    extensions: [
      javascript({ typescript: true }),
      oneDark,

    ],
  },
  go: {
    formatter: null,
    extensions: [go() ],
  },
  rs: {
    formatter: null,
    extensions: [rust()],
  },
  html: {
    formatter: null,
    extensions: [html() ],
  },
  json: {
    formatter: null,
    extensions: [json() ],
  },
  py: {
    formatter: null,
    extensions: [python() ],
  },
  css: {
    formatter: null,
    extensions: [css() ],
  },
  sql: {
    formatter: null,
    extensions: [sql() ],
  },
  md: {
    formatter: null,
    extensions: [markdown() ],
  },
 
};

export const fallbackRegistry: EditorRegistryEntry = {
  formatter: null,
  extensions: [],
};
