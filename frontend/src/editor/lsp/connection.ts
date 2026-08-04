import type * as monaco from "monaco-editor";
import { GetLanguageProfile } from "../../../wailsjs/go/main/App";
import { EMPTY_CAPABILITIES, ServerCapabilities } from "./capabilities";
import { toMarker } from "./diagnostics";
import { lspLogger } from "./logger";
import type {
  ContentChange,
  JSONRPCMessage,
  JSONValue,
  PublishDiagnosticsParams,
  RawServerCapabilities,
} from "./protocol";
import { priorityForMethod, type RequestPriority, RequestScheduler } from "./requestScheduler";
import { type Transport, WebSocketTransport } from "./transport";
import { toFileUri } from "./uri";

// ============================================================================
// LSPConnection: one per (language, project root) - the orchestrator that
// used to be the entire lspClient.ts. It now delegates to transport.ts
// (wire I/O), requestScheduler.ts (priority/concurrency), capabilities.ts
// (feature negotiation) and logger.ts (Dev Tools visibility), and only
// owns: request/notification bookkeeping, document lifecycle, and crash
// recovery.
// ============================================================================

export type ConnectionStatus = "connecting" | "ready" | "reconnecting" | "disabled" | "closed";

const MAX_RESTARTS = 5;
const DEFAULT_REQUEST_TIMEOUT_MS = 10000;

// JVM-based servers are legitimately much slower to respond than
// gopls/typescript-language-server, especially on early requests while
// they're still importing/indexing the project (Maven/Gradle dependency
// resolution can easily take longer than 10s on its own). Using the
// default timeout for them meant every hover/completion sent during that
// window silently resolved to null - looking exactly like "hover doesn't
// work at all" even though the server would have answered given more
// time.
const SLOW_SERVER_TIMEOUT_MS = 60000;
const SLOW_SERVER_LANGS = new Set(["java", "kotlin"]);

function requestTimeoutFor(lang: string): number {
  return SLOW_SERVER_LANGS.has(lang) ? SLOW_SERVER_TIMEOUT_MS : DEFAULT_REQUEST_TIMEOUT_MS;
}

interface OpenDoc {
  languageId: string;
  model: monaco.editor.ITextModel;
  version: number;
}

interface PendingEntry {
  complete: (
    status: "resolved" | "error",
    value: JSONValue,
    errorMessage?: string,
  ) => void;
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
    this.pending.forEach((entry) => {
      entry.complete("error", null, "connection disposed");
    });
    this.pending.clear();
  }

  // ── connection lifecycle ────────────────────────────────────────────

  private async connect(): Promise<void> {
    this._status = this.restartCount === 0 ? "connecting" : "reconnecting";
    lspLogger.lifecycle(this.connectionId, this.lang, this.root, this._status);
    console.log(`[lsp] (${this.lang}) ${this._status} root=${this.root}`);

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
      console.log(`[lsp] (${this.lang}) ready`);

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
      console.error(`[lsp] (${this.lang}) connect failed: ${message}`);
      this.handleDisconnect(message);
    }
  }

  private handleDisconnect(reason: string) {
    if (this.disposed || this._status === "disabled") return;

    // Unblock anything still waiting on this generation of the connection.
    this.pending.forEach((entry) => {
      entry.complete("error", null, `connection lost: ${reason}`);
    });
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
      console.error(`[lsp] (${this.lang}) disabled after ${MAX_RESTARTS} crashes: ${reason}`);
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
    console.warn(
      `[lsp] (${this.lang}) crashed: ${reason} - reconnecting in ${backoffMs}ms (attempt ${this.restartCount}/${MAX_RESTARTS})`,
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
      workspaceFolders: rootUri ? [{ uri: rootUri, name: this.root.split(/[\\/]/).pop() }] : null,
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

    const capabilities = (result as { capabilities?: RawServerCapabilities } | null)?.capabilities;
    if (!capabilities) {
      // An initialize JSON-RPC error means the server rejected the session (for
      // TypeScript this commonly means no usable tsserver.js). Do not mark the
      // connection ready or send didOpen with empty capabilities; surface the
      // failure and let crash/reconnect handling make it visible in logs.
      throw new Error("LSP initialize failed: server returned no capabilities");
    }

    this._capabilities = new ServerCapabilities(capabilities);
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
    const logKey = lspLogger.beginRequest(this.connectionId, this.lang, method, params, priority);

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
          complete: (status, value, errorMessage) => {
            finish(status, value, errorMessage);
            resolveTask(value);
          },
        });
        this.sendRaw({ jsonrpc: "2.0", id, method, params });

        timeoutHandle = setTimeout(() => {
          finish("timed-out", null, `no response within ${requestTimeoutFor(this.lang) / 1000}s`);
          resolveTask(null);
        }, requestTimeoutFor(this.lang));
      });
    });

    const cancel = () => {
      if (settled) return;
      if (cancelQueued()) {
        finish("cancelled", null, "cancelled while queued");
        return;
      }
      if (id >= 0) {
        this.sendRaw({
          jsonrpc: "2.0",
          method: "$/cancelRequest",
          params: { id },
        });
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
        if (msg.error) {
          const message = `${msg.error.code}: ${msg.error.message}`;
          console.warn(
            `[lsp] (${this.lang}) request #${msg.id} failed from server: ${message}`,
          );
          entry.complete("error", null, message);
        } else {
          entry.complete("resolved", msg.result ?? null);
        }
      } else {
        // This usually means the request timed out/cancelled locally and the
        // server answered later. LSP cancellation responses (-32800) are normal
        // during hover/completion churn, so keep those at debug level; anything
        // else remains a warning because it may indicate a protocol mismatch.
        const log = msg.error?.code === -32800 ? console.debug : console.warn;
        log(
          `[lsp] (${this.lang}) received response for unknown/stale request #${msg.id}`,
          msg,
        );
      }
      return;
    }

    if (!msg.method) return;
    lspLogger.notification(this.connectionId, this.lang, "incoming", msg.method, msg.params);

    if (msg.method === "textDocument/publishDiagnostics") {
      const params = msg.params as PublishDiagnosticsParams;
      const markers = params.diagnostics.map(toMarker);
      this.diagnosticsListeners.forEach((fn) => {
        fn(params.uri, markers);
      });
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

  onDiagnostics(fn: (uri: string, diagnostics: monaco.editor.IMarkerData[]) => void): () => void {
    this.diagnosticsListeners.add(fn);
    return () => this.diagnosticsListeners.delete(fn);
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
