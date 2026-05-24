import { javascript } from "@codemirror/lang-javascript"
import { html } from '@codemirror/lang-html'
import { go } from "@codemirror/lang-go"
import { css } from "@codemirror/lang-css";
import { rust } from "@codemirror/lang-rust";
import { sql } from "@codemirror/lang-sql";
import { markdown } from "@codemirror/lang-markdown";
import { python } from "@codemirror/lang-python";
import { json } from "@codemirror/lang-json";
const langMap = {
  js: javascript,
  html: html,
  go:go,
  css:css,
  rs: rust,
  sql: sql,
  md: markdown,
  py: python,
  json: json,

}
  function detectLang(name = "") {
    if (name.endsWith(".js")) return "js"
    if (name.endsWith(".go")) return "go"
    if (name.endsWith(".css")) return "css"
    if (name.endsWith(".sql")) return "sql"
    if (name.endsWith(".go")) return "go"
    if (name.endsWith(".json")) return "json"
    if (name.endsWith(".py")) return "py"
    if (name.endsWith(".rs")) return "rs"
    if (name.endsWith(".md")) return "md"
    if (name ==="README.txt") return "md"
    if (name === "README") return "md"
    return "txt"
  }
  export{
    langMap,
    detectLang
  }
export default langMap