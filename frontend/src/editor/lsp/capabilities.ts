import { type RawServerCapabilities, TextDocumentSyncKind } from "./protocol";

// ============================================================================
// Normalizes the `ServerCapabilities` object returned from `initialize` so
// the rest of the client can ask simple yes/no questions instead of
// re-deriving them from LSP's slightly awkward "boolean | options object"
// unions everywhere. Providers are gated on these instead of being
// registered (and silently failing forever) unconditionally.
// ============================================================================

export class ServerCapabilities {
  readonly raw: RawServerCapabilities;

  readonly hover: boolean;
  readonly definition: boolean;
  readonly references: boolean;
  readonly completion: boolean;
  readonly completionResolve: boolean;
  readonly completionTriggerCharacters: string[];
  readonly syncKind: TextDocumentSyncKind;

  constructor(raw: RawServerCapabilities | null | undefined) {
    this.raw = raw ?? {};

    this.hover = !!this.raw.hoverProvider;
    this.definition = !!this.raw.definitionProvider;
    this.references = !!this.raw.referencesProvider;
    this.completion = !!this.raw.completionProvider;
    this.completionResolve = !!this.raw.completionProvider?.resolveProvider;
    this.completionTriggerCharacters =
      this.raw.completionProvider?.triggerCharacters ?? [];

    this.syncKind = normalizeSyncKind(this.raw.textDocumentSync);
  }
}

function normalizeSyncKind(
  sync: RawServerCapabilities["textDocumentSync"],
): TextDocumentSyncKind {
  if (typeof sync === "number") return sync;
  if (sync && typeof sync === "object" && typeof sync.change === "number") {
    return sync.change;
  }
  // Servers that omit textDocumentSync entirely still expect at least
  // full-document sync per the LSP spec's implied default.
  return TextDocumentSyncKind.Full;
}

/** Capabilities for a connection that hasn't finished initializing yet -
 * nothing is supported, so no provider ever fires a doomed request. */
export const EMPTY_CAPABILITIES = new ServerCapabilities(null);
