// ============================================================================
// Shared JSON-RPC / LSP wire types used across the lsp/ module. Kept
// intentionally loose (many optional fields) since different servers
// populate different subsets - callers narrow what they need.
// ============================================================================

export type JSONValue = unknown;

export interface JSONRPCMessage {
  jsonrpc: "2.0";
  id?: number;
  method?: string;
  params?: JSONValue;
  result?: JSONValue;
  error?: { code: number; message: string };
}

export interface LSPPosition {
  line: number;
  character: number;
}

export interface LSPRange {
  start: LSPPosition;
  end: LSPPosition;
}

/** LSP `TextDocumentContentChangeEvent`, incremental form. */
export interface IncrementalChange {
  range: LSPRange;
  rangeLength?: number;
  text: string;
}

/** LSP `TextDocumentContentChangeEvent`, whole-document form. */
export interface FullChange {
  text: string;
}

export type ContentChange = IncrementalChange | FullChange;

export enum TextDocumentSyncKind {
  None = 0,
  Full = 1,
  Incremental = 2,
}

/** The subset of `ServerCapabilities` MervCode currently understands. */
export interface RawServerCapabilities {
  textDocumentSync?: number | { openClose?: boolean; change?: number; save?: unknown };
  hoverProvider?: boolean | Record<string, unknown>;
  completionProvider?: {
    resolveProvider?: boolean;
    triggerCharacters?: string[];
  };
  definitionProvider?: boolean | Record<string, unknown>;
  referencesProvider?: boolean | Record<string, unknown>;
  [key: string]: unknown;
}

export interface LSPDiagnostic {
  range: LSPRange;
  message: string;
  severity?: number;
  source?: string;
  code?: string | number;
}

export interface PublishDiagnosticsParams {
  uri: string;
  version?: number;
  diagnostics: LSPDiagnostic[];
}

export interface LSPLocation {
  uri: string;
  range: LSPRange;
}
