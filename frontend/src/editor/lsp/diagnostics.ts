import * as monaco from "monaco-editor";
import type { LSPDiagnostic } from "./protocol";

const SEVERITY_MAP: Record<number, monaco.MarkerSeverity> = {
  1: monaco.MarkerSeverity.Error,
  2: monaco.MarkerSeverity.Warning,
  3: monaco.MarkerSeverity.Info,
  4: monaco.MarkerSeverity.Hint,
};

/** Converts an LSP `Diagnostic` into a Monaco marker. */
export function toMarker(d: LSPDiagnostic): monaco.editor.IMarkerData {
  const marker: monaco.editor.IMarkerData = {
    severity: SEVERITY_MAP[d.severity ?? 1] ?? monaco.MarkerSeverity.Error,
    message: d.message,
    startLineNumber: d.range.start.line + 1,
    startColumn: d.range.start.character + 1,
    endLineNumber: d.range.end.line + 1,
    endColumn: d.range.end.character + 1,
  };
  // Monaco's IMarkerData uses exactOptionalPropertyTypes-incompatible
  // optional fields, so these are only set when actually present instead
  // of being assigned an explicit `undefined`.
  if (d.source !== undefined) marker.source = d.source;
  if (d.code !== undefined) marker.code = String(d.code);
  return marker;
}
