// ============================================================================
// Public entry point for the lint module - this is the only thing language
// modules under editor/monaco/languages/*.ts should import. See runner.ts
// for the debounce/scheduling logic and toMarker.ts for the
// LintDiagnostic -> Monaco marker mapping.
// ============================================================================

export { registerLinter } from "./runner";
