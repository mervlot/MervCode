// ============================================================================
// Canonical language-id helpers.
//
// Monaco needs concrete editor language IDs (`typescript`, `typescriptreact`,
// `javascript`, `javascriptreact`) so syntax highlighting and JSX/TSX grammar
// match the file extension. The Go backend, however, intentionally exposes one
// shared `typescript` toolchain for all four because they use the same external
// tools: typescript-language-server, Prettier, and ESLint.
//
// Keeping that conversion in one place prevents the exact class of bugs where
// `.jsx` is treated as a separate backend language (`javascriptreact`) or where
// every hidden tab gets relabeled as the active tab's language.
// ============================================================================

export type TypeScriptFamilyLanguageId =
  | "typescript"
  | "typescriptreact"
  | "javascript"
  | "javascriptreact";

const TYPESCRIPT_FAMILY = new Set<string>([
  "typescript",
  "typescriptreact",
  "javascript",
  "javascriptreact",
]);

export function isTypeScriptFamilyLanguage(
  languageId: string,
): languageId is TypeScriptFamilyLanguageId {
  return TYPESCRIPT_FAMILY.has(languageId);
}

/**
 * Maps a concrete Monaco language id to the single backend toolchain id that
 * owns its LSP/formatter/linter tools. Non-TS-family languages are already
 * canonical and are returned unchanged.
 */
export function toolchainLanguageId(languageId: string): string {
  return isTypeScriptFamilyLanguage(languageId) ? "typescript" : languageId;
}

/** Human-readable names for logging and tool prompts. */
export function languageLabel(languageId: string): string {
  switch (languageId) {
    case "typescript":
      return "TypeScript";
    case "typescriptreact":
      return "React TSX";
    case "javascript":
      return "JavaScript";
    case "javascriptreact":
      return "React JSX";
    default:
      return languageId;
  }
}
