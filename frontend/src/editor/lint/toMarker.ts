import * as monaco from "monaco-editor";
import type { main } from "../../../wailsjs/go/models";

type LintDiagnostic = main.LintDiagnostic;

const SEVERITY_MAP: Record<string, monaco.MarkerSeverity> = {
  error: monaco.MarkerSeverity.Error,
  warning: monaco.MarkerSeverity.Warning,
  info: monaco.MarkerSeverity.Info,
};

/**
 * Converts a backend LintDiagnostic (see toolchain.go's LintDiagnostic,
 * normalized from whatever a specific linter like ESLint actually emits)
 * into a Monaco marker. Positions are already 1-based, matching how
 * linters conventionally report them - unlike LSP's 0-based ranges, no
 * off-by-one adjustment is needed here.
 */
export function toMarker(
  d: LintDiagnostic,
  source: string,
): monaco.editor.IMarkerData {
  const line = d.line || 1;
  const column = d.column || 1;
  const marker: monaco.editor.IMarkerData = {
    severity: SEVERITY_MAP[d.severity] ?? monaco.MarkerSeverity.Warning,
    message: d.message,
    source,
    startLineNumber: line,
    startColumn: column,
    endLineNumber: d.endLine || line,
    endColumn: d.endColumn || column,
  };
  // Monaco's IMarkerData uses exactOptionalPropertyTypes-incompatible
  // optional fields, so `code` is only set when actually present instead
  // of being assigned an explicit `undefined`.
  if (d.ruleId) marker.code = d.ruleId;
  return marker;
}
