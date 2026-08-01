import type * as monaco from "monaco-editor";
import { GetLanguageProfile } from "../../../wailsjs/go/main/App";
import { ServerCapabilities, EMPTY_CAPABILITIES } from "./capabilities";
import { toMarker } from "./diagnostics";
import { lspLogger } from "./logger";
import type { JSONRPCMessage, JSONValue, PublishDiagnosticsParams, ContentChange, RawServerCapabilities } from "./protocol";
import {
  RequestScheduler,
  priorityForMethod,
  type RequestPriority,
} from "./requestScheduler";
import { WebSocketTransport, type Transport } from "./transport";
import { toFileUri } from "./uri";

// ============================================================================
// LSPConnection: one per (language, project root) - the orchestrator that
// used to be the entire lspClient.ts. It now delegates to transport.ts
// (wire I/O), requestScheduler.ts (priority/concurrency), capabilities.ts
// (feature negotiation) and logger.ts (Dev Tools visibility), and only
// owns: request/notification bookkeeping, document lifecycle, and crash
// recovery.
// ============================================================================

export type ConnectionStatus =
  | "connecting"
  | "ready"
  | "reconnecting"
  | "disabled"
  | "closed";

const MAX_RESTARTS = 5;
const REQUEST_TIMEOUT_MS = 10000;

interface OpenDoc {
  languageId: string;
  model: monaco.editor.ITextModel;
  version: number;
}

interface PendingEntry {
  resolve: (value: JSONValue) => void;
}

export interface ConnectionSnapshot {
  key: string;
  lang: string;
  root: string;
  status: ConnectionStatus;
  sessionId: string | null;
  restartCount: number;
  openDocuments: string[];
  capabilities: ServerCapabilities;
}

export class LSPConnection {
  private transport: Transport | null = null;
  private seq = 1;
  private pending = new Map<number, PendingEntry>();
  private inFlightByKey = new Map<string, { cancel: () => void }>();
  private scheduler = new RequestScheduler();
  private openDocs = new Map<string, OpenDoc>();
  private diagnosticsListeners = new Set<
    (uri: string, diagnostics: monaco.editor.IMarkerData[]) => void
  >();
  private providersRegistered = false;
  private restartCount = 0;
  private disposed = false;
  private _status: ConnectionStatus = "connecting";
  private _capabilities: ServerCapabilities = EMPTY_CAPABILITIES;
  private readyPromise: Promise<void>;

  constructor(
    public readonly lang: string,
    public readonly root: string,
  ) {
    this.readyPromise = this.connect();
  }

  get connectionId(): string {
    return `${this.lang}::${this.root}`;
  }

  get status(): ConnectionStatus {
    return this._status;
  }

  get capabilities(): ServerCapabilities {
    return this._capabilities;
  }

  async waitUntilReady(): Promise<void> {
    return this.readyPromise;
  }

  snapshot(): ConnectionSnapshot {
    return {
      key: this.connectionId,
      lang: this.lang,
      root: this.root,
      status: this._status,
      sessionId: this.transport?.sessionId ?? null,
      restartCount: this.restartCount,
      openDocuments: Array.from(this.openDocs.keys()),
      capabilities: this._capabilities,
    };
  }

  /** Resets the crash counter and reconnects - used by the "Restart" action
   * in the LSP Inspector once a connection has auto-disabled itself. */
  reconnect(): void {
    if (this.disposed) return;
    this.restartCount = 0;
    this._status = "connecting";
    this.readyPromise = this.connect();
  }

  dispose(): void {
    this.disposed = true;
    this._status = "closed";
    this.transport?.close();
    this.pending.forEach((entry) => entry.resolve(null));
    this.pending.clear();
  }

  // ── connection lifecycle ────────────────────────────────────────────

  private async connect(): Promise<void> {
    this._status = this.restartCount === 0 ? "connecting" : "reconnecting";
    lspLogger.lifecycle(this.connectionId, this.lang, this.root, this._status);

    try {
      const transport = await WebSocketTransport.connect(this.lang, this.root);
      if (this.disposed) {
        transport.close();
        return;
      }
      this.transport = transport;
      transport.onMessage((msg) => this.handleMessage(msg));
      transport.onClose((reason) => this.handleDisconnect(reason));

      await this.initialize();
      this._status = "ready";
      this.restartCount = 0;
      lspLogger.lifecycle(this.connectionId, this.lang, this.root, "ready");

      // Replay documents that were open before a reconnect. Version resets
      // to 1: this is a brand new server process with no memory of the
      // old one, so there's nothing to reconcile against.
      for (const [uri, doc] of this.openDocs) {
        doc.version = 1;
        this.sendDidOpen(uri, doc.languageId, doc.model.getValue());
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      lspLogger.lifecycle(
        this.connectionId,
        this.lang,
        this.root,
        "connect-failed",
        "error",
        message,
      );
      this.handleDisconnect(message);
    }
  }

  private handleDisconnect(reason: string) {
    if (this.disposed || this._status === "disabled") return;

    // Unblock anything still waiting on this generation of the connection.
    this.pending.forEach((entry) => entry.resolve(null));
    this.pending.clear();

    if (this.restartCount >= MAX_RESTARTS) {
      this._status = "disabled";
      lspLogger.lifecycle(
        this.connectionId,
        this.lang,
        this.root,
        "disabled",
        "error",
        `Gave up after ${MAX_RESTARTS} crashes (${reason}). Restart manually from the LSP Inspector.`,
      );
      return;
    }

    this.restartCount++;
    this._status = "reconnecting";
    const backoffMs = Math.min(30000, 500 * 2 ** this.restartCount);
    lspLogger.lifecycle(
      this.connectionId,
      this.lang,
      this.root,
      "crashed",
      "warn",
      `${reason} - reconnecting in ${backoffMs}ms (attempt ${this.restartCount}/${MAX_RESTARTS})`,
    );

    this.readyPromise = new Promise((resolve) => {
      setTimeout(() => {
        this.connect().then(resolve);
      }, backoffMs);
    });
  }

  private async initialize() {
    const rootUri = this.root ? toFileUri(this.root) : null;
    const profile = await GetLanguageProfile(this.lang).catch(() => null);

    const result = await this.request("initialize", {
      processId: null,
      rootUri,
      workspaceFolders: rootUri
        ? [{ uri: rootUri, name: this.root.split(/[\\/]/).pop() }]
        : null,
      initializationOptions: profile?.initializationOptions ?? {},
      capabilities: {
        textDocument: {
          hover: { contentFormat: ["markdown", "plaintext"] },
          completion: {
            completionItem: {
              snippetSupport: false,
              documentationFormat: ["markdown", "plaintext"],
            },
          },
          definition: {},
          references: {},
          synchronization: { didSave: true },
          publishDiagnostics: {},
        },
        workspace: {
          didChangeConfiguration: {},
          workspaceFolders: true,
          configuration: true,
        },
      },
    });

    this._capabilities = new ServerCapabilities(
      (result as { capabilities?: RawServerCapabilities } | null)?.capabilities,
    );
    this.notify("initialized", {});
  }

  // ── request / notification plumbing ─────────────────────────────────

  private sendRaw(msg: JSONRPCMessage) {
    this.transport?.send(msg);
  }

  private notify(method: string, params?: JSONValue) {
    if (this._status === "disabled") return;
    lspLogger.notification(this.connectionId, this.lang, "outgoing", method, params);
    this.sendRaw({ jsonrpc: "2.0", method, params });
  }

  /** Fire-and-forget-the-cancel-handle variant, for internal callers
   * (initialize, shutdown) that never need to cancel their own request. */
  private request(method: string, params?: JSONValue): Promise<JSONValue> {
    return this.requestCancellable(method, params).promise;
  }

  /**
   * Sends a request through the priority scheduler and returns both its
   * result promise and a `cancel()` handle. If `supersedeKey` is given,
   * any previous still-in-flight request registered under the same key is
   * cancelled first - this is what stops stale hover/completion responses
   * from a previous keystroke overwriting a newer one.
   */
  requestCancellable(
    method: string,
    params?: JSONValue,
    opts: { priority?: RequestPriority; supersedeKey?: string } = {},
  ): { promise: Promise<JSONValue>; cancel: () => void } {
    const priority = opts.priority ?? priorityForMethod(method);
    const logKey = lspLogger.beginRequest(
      this.connectionId,
      this.lang,
      method,
      params,
      priority,
    );

    if (this._status === "disabled") {
      lspLogger.endRequest(logKey, "error", null, "connection disabled after repeated crashes");
      return { promise: Promise.resolve(null), cancel: () => {} };
    }

    let settled = false;
    let id = -1;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

    const finish = (
      status: "resolved" | "error" | "cancelled" | "timed-out",
      value: JSONValue,
      errorMessage?: string,
    ) => {
      if (settled) return;
      settled = true;
      if (timeoutHandle) clearTimeout(timeoutHandle);
      if (id >= 0) this.pending.delete(id);
      lspLogger.endRequest(logKey, status, value, errorMessage);
    };

    const { result, cancelQueued } = this.scheduler.schedule<JSONValue>(priority, () => {
      return new Promise<JSONValue>((resolveTask) => {
        if (settled) {
          resolveTask(null);
          return;
        }
        id = this.seq++;
        this.pending.set(id, {
          resolve: (value) => {
            finish("resolved", value);
            resolveTask(value);
          },
        });
        this.sendRaw({ jsonrpc: "2.0", id, method, params });

        timeoutHandle = setTimeout(() => {
          finish("timed-out", null, "no response within 10s");
          resolveTask(null);
        }, REQUEST_TIMEOUT_MS);
      });
    });

    const cancel = () => {
      if (settled) return;
      if (cancelQueued()) {
        finish("cancelled", null, "cancelled while queued");
        return;
      }
      if (id >= 0) {
        this.sendRaw({ jsonrpc: "2.0", method: "$/cancelRequest", params: { id } });
      }
      finish("cancelled", null, "cancelled");
    };

    if (opts.supersedeKey) {
      this.inFlightByKey.get(opts.supersedeKey)?.cancel();
      this.inFlightByKey.set(opts.supersedeKey, { cancel });
    }

    return { promise: result, cancel };
  }

  private handleMessage(msg: JSONRPCMessage) {
    if (msg.id !== undefined && msg.method) {
      this.handleServerRequest(msg);
      return;
    }

    if (msg.id !== undefined) {
      const entry = this.pending.get(msg.id);
      if (entry) {
        this.pending.delete(msg.id);
        entry.resolve(msg.error ? null : (msg.result ?? null));
      }
      return;
    }

    if (!msg.method) return;
    lspLogger.notification(this.connectionId, this.lang, "incoming", msg.method, msg.params);

    if (msg.method === "textDocument/publishDiagnostics") {
      const params = msg.params as PublishDiagnosticsParams;
      const markers = params.diagnostics.map(toMarker);
      this.diagnosticsListeners.forEach((fn) => fn(params.uri, markers));
    }
  }

  private handleServerRequest(msg: JSONRPCMessage) {
    let result: JSONValue = null;

    if (msg.method === "workspace/configuration") {
      const params = msg.params as { items?: unknown[] };
      result = (params?.items ?? []).map(() => ({}));
    }

    lspLogger.notification(
      this.connectionId,
      this.lang,
      "incoming",
      msg.method ?? "(request)",
      msg.params,
    );
    this.sendRaw({ jsonrpc: "2.0", id: msg.id, result } as JSONRPCMessage);
  }

  // ── document lifecycle ──────────────────────────────────────────────

  openDocument(uri: string, languageId: string, model: monaco.editor.ITextModel) {
    if (this.openDocs.has(uri)) return;
    this.openDocs.set(uri, { languageId, model, version: 1 });
    this.sendDidOpen(uri, languageId, model.getValue());
  }

  private sendDidOpen(uri: string, languageId: string, text: string) {
    const doc = this.openDocs.get(uri);
    this.notify("textDocument/didOpen", {
      textDocument: { uri, languageId, version: doc?.version ?? 1, text },
    });
  }

  changeDocument(uri: string, changes: ContentChange[]) {
    const doc = this.openDocs.get(uri);
    if (!doc) return;
    doc.version += 1;
    this.notify("textDocument/didChange", {
      textDocument: { uri, version: doc.version },
      contentChanges: changes,
    });
  }

  closeDocument(uri: string) {
    if (!this.openDocs.has(uri)) return;
    this.openDocs.delete(uri);
    this.notify("textDocument/didClose", { textDocument: { uri } });
  }

  onDiagnostics(
    fn: (uri: string, diagnostics: monaco.editor.IMarkerData[]) => void,
  ): () => void {
    this.diagnosticsListeners.add(fn);
    return () => this.diagnosticsListeners.delete(fn);
  }

  markProvidersRegistered(): boolean {
    if (this.providersRegistered) return true;
    this.providersRegistered = true;
    return false;
  }

  // ── feature requests (Monaco-flavored positions in, LSP positions out) ─

  hoverRequest(uri: string, position: monaco.Position) {
    return this.requestCancellable(
      "textDocument/hover",
      { textDocument: { uri }, position: toLspPosition(position) },
      { supersedeKey: `hover:${uri}` },
    );
  }

  completionRequest(uri: string, position: monaco.Position) {
    return this.requestCancellable(
      "textDocument/completion",
      { textDocument: { uri }, position: toLspPosition(position) },
      { supersedeKey: `completion:${uri}` },
    );
  }

  definitionRequest(uri: string, position: monaco.Position) {
    return this.requestCancellable("textDocument/definition", {
      textDocument: { uri },
      position: toLspPosition(position),
    });
  }

  referencesRequest(uri: string, position: monaco.Position) {
    return this.requestCancellable("textDocument/references", {
      textDocument: { uri },
      position: toLspPosition(position),
      context: { includeDeclaration: true },
    });
  }
}

function toLspPosition(position: monaco.Position) {
  return { line: position.lineNumber - 1, character: position.column - 1 };
}
