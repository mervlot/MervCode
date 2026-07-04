const filenameMap: Record<string, string> = {
  dockerfile: "dockerfile",
  readme: "markdown",
  "readme.md": "markdown",
  ".gitignore": "plaintext",
  ".dockerignore": "plaintext",
  ".editorconfig": "ini",
  ".gitattributes": "ini",
  ".gitconfig": "ini",
  config: "ini",
};

const extensionMap: Record<string, string> = {
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",

  ts: "typescript",
  tsx: "typescript",
  mts: "typescript",
  cts: "typescript",

  json: "json",

  html: "html",
  htm: "html",

  css: "css",
  scss: "scss",
  less: "less",

  md: "markdown",
  mdx: "mdx",

  go: "go",
  py: "python",
  rs: "rust",
  java: "java",
  kt: "kotlin",
  kts: "kotlin",
  php: "php",
  rb: "ruby",
  lua: "lua",
  swift: "swift",

  c: "c",
  h: "c",
  cpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  hpp: "cpp",
  hh: "cpp",
  hxx: "cpp",

  cs: "csharp",

  xml: "xml",
  svg: "xml",

  yaml: "yaml",
  yml: "yaml",

  sql: "sql",

  toml: "ini",
  ini: "ini",
  properties: "ini",

  sh: "shell",
  bash: "shell",

  bat: "bat",
  cmd: "bat",

  ps1: "powershell",

  graphql: "graphql",
  gql: "graphql",

  dart: "dart",

  tf: "hcl",
  tfvars: "hcl",
  hcl: "hcl",

  proto: "proto",

  txt: "plaintext",
  log: "plaintext",
};

export function detectLang(name = ""): string {
  const file = name.toLowerCase();

  if (filenameMap[file]) {
    return filenameMap[file];
  }

  const ext = file.split(".").pop();

  if (!ext) {
    return "plaintext";
  }

  return extensionMap[ext] ?? "plaintext";
}
