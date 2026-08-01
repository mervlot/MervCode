import * as monaco from "monaco-editor";
import { CreateLSPSession } from "../../../wailsjs/go/main/App";

// ============================================================================
// Generic, WebSocket-based LSP client for Monaco.
//
// One WebSocket connection is opened per (language, workspace root) pair
// and shared across every open file of that language — matching how real
// editors run a single server instance per project, not one per file.
// The Go bridge (lsp_bridge.go) spawns the actual language server process
// and translates between this plain-JSON WebSocket protocol and the
// server's real Content-Length-framed stdio protocol.
//
// To support a new language, you don't touch this file — register the
// server in toolchain.go's `toolchains` map, then call
// openLSPDocument(editor, model, rootPath) from that language's module in
// registry.ts, the same way go.ts/java.ts/kotlin.ts already do.
// ============================================================================

type JSONValue = unknown;

interface JSONRPCRequest {
  jsonrpc: "2.0";
  id?: number;
  method: string;
  params?: JSONValue;
}

interface JSONRPCResponse {
  jsonrpc: "2.0";
  id?: number;
  method?: string;
  params?: JSONValue;
  result?: JSONValue;
  error?: { code: number; message: string };
}

type PendingResolve = (value: JSONValue) => void;

class LSPConnection {
  private ws: WebSocket | null = null;
  private ready: Promise<void>;
  private seq = 1;
  private pending = new Map<number, PendingResolve>();
  private openDocs = new Map<string, number>(); // uri -> version
  private diagnosticsListeners = new Set<
    (uri: string, diagnostics: monaco.editor.IMarkerData[]) => void
  >();
  private providersRegistered = false;

  constructor(
    public readonly lang: string,
    public readonly root: string,
  ) {
    this.ready = this.connect();
  }

  private async connect(): Promise<void> {
    const url = await CreateLSPSession(this.lang, this.root || "");
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(url);
      this.ws = ws;

      ws.onopen = () => resolve();
      ws.onerror = () =>
        reject(new Error(`LSP WebSocket error (${this.lang})`));
      ws.onclose = () => {
        // Reject any still-pending requests so callers don't hang forever.
        this.pending.forEach((resolveFn) => resolveFn(null));
        this.pending.clear();
      };
      ws.onmessage = (ev) => this.handleMessage(ev.data);
    });

    await this.initialize();
  }

  private handleMessage(raw: string) {
    let msg: JSONRPCResponse;

    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    if (msg.id !== undefined && msg.method) {
      // Server -> client request. Must always get a response or the
      // server can stall waiting for it.
      this.handleServerRequest(msg);
      return;
    }

    if (msg.id !== undefined) {
      const resolve = this.pending.get(msg.id);
      if (resolve) {
        this.pending.delete(msg.id);
        resolve(msg.error ? null : (msg.result ?? null));
      }
      return;
    }

    if (msg.method === "textDocument/publishDiagnostics") {
      const params = msg.params as {
        uri: string;
        diagnostics: Array<{
          range: {
            start: { line: number; character: number };
            end: { line: number; character: number };
          };
          message: string;
          severity?: number;
        }>;
      };
      console.log("Diagnostics:");
      console.log(JSON.stringify(params, null, 2));

      const markers = params.diagnostics.map((d) => toMarker(d));
      this.diagnosticsListeners.forEach((fn) => fn(params.uri, markers));
    }
  }

  private handleServerRequest(msg: JSONRPCResponse) {
    let result: JSONValue = null;

    if (msg.method === "workspace/configuration") {
      const params = msg.params as { items?: unknown[] };
      result = (params?.items ?? []).map(() => ({}));
    }

    this.send({
      jsonrpc: "2.0",
      id: msg.id,
      result,
    } as unknown as JSONRPCRequest);
  }

  private send(msg: JSONRPCRequest) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private request(method: string, params?: JSONValue): Promise<JSONValue> {
    const id = this.seq++;
    return new Promise((resolve) => {
      this.pending.set(id, resolve);
      this.send({ jsonrpc: "2.0", id, method, params });
      // Don't hang forever if the server never answers.
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          resolve(null);
        }
      }, 10000);
    });
  }

  private notify(method: string, params?: JSONValue) {
    this.send({ jsonrpc: "2.0", method, params });
  }

  private async initialize() {
    const rootUri = this.root ? toFileUri(this.root) : null;
    await this.request("initialize", {
      processId: null,
      rootUri,
      workspaceFolders: rootUri
        ? [{ uri: rootUri, name: this.root.split(/[\\/]/).pop() }]
        : null,
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
    this.notify("initialized", {});
  }

  async waitUntilReady(): Promise<void> {
    return this.ready;
  }

  onDiagnostics(
    fn: (uri: string, diagnostics: monaco.editor.IMarkerData[]) => void,
  ) {
    this.diagnosticsListeners.add(fn);
    return () => this.diagnosticsListeners.delete(fn);
  }

  openDocument(uri: string, languageId: string, text: string) {
    if (this.openDocs.has(uri)) return;
    this.openDocs.set(uri, 1);
    this.notify("textDocument/didOpen", {
      textDocument: { uri, languageId, version: 1, text },
    });
  }

  changeDocument(uri: string, text: string) {
    const version = (this.openDocs.get(uri) ?? 1) + 1;
    this.openDocs.set(uri, version);
    this.notify("textDocument/didChange", {
      textDocument: { uri, version },
      contentChanges: [{ text }],
    });
  }

  closeDocument(uri: string) {
    if (!this.openDocs.has(uri)) return;
    this.openDocs.delete(uri);
    this.notify("textDocument/didClose", { textDocument: { uri } });
  }

  async hover(uri: string, position: monaco.Position): Promise<JSONValue> {
    return this.request("textDocument/hover", {
      textDocument: { uri },
      position: {
        line: position.lineNumber - 1,
        character: position.column - 1,
      },
    });
  }

  async completion(uri: string, position: monaco.Position): Promise<JSONValue> {
    return this.request("textDocument/completion", {
      textDocument: { uri },
      position: {
        line: position.lineNumber - 1,
        character: position.column - 1,
      },
    });
  }

  async definition(uri: string, position: monaco.Position): Promise<JSONValue> {
    return this.request("textDocument/definition", {
      textDocument: { uri },
      position: {
        line: position.lineNumber - 1,
        character: position.column - 1,
      },
    });
  }

  async references(uri: string, position: monaco.Position): Promise<JSONValue> {
    return this.request("textDocument/references", {
      textDocument: { uri },
      position: {
        line: position.lineNumber - 1,
        character: position.column - 1,
      },
      context: { includeDeclaration: true },
    });
  }

  markProvidersRegistered(): boolean {
    if (this.providersRegistered) return true;
    this.providersRegistered = true;
    return false;
  }
}

function toFileUri(path: string): string {
  let p = path.replace(/\\/g, "/");
  if (/^[A-Za-z]:/.test(p)) {
    // use charAt to avoid possible undefined when indexing an empty string
    p = p.charAt(0).toLowerCase() + p.slice(1);
  }
  if (!p.startsWith("/")) p = "/" + p;
  return "file://" + p;
}

function toMarker(d: {
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  message: string;
  severity?: number;
}): monaco.editor.IMarkerData {
  const severityMap: Record<number, monaco.MarkerSeverity> = {
    1: monaco.MarkerSeverity.Error,
    2: monaco.MarkerSeverity.Warning,
    3: monaco.MarkerSeverity.Info,
    4: monaco.MarkerSeverity.Hint,
  };
  return {
    severity: severityMap[d.severity ?? 1] ?? monaco.MarkerSeverity.Error,
    message: d.message,
    startLineNumber: d.range.start.line + 1,
    startColumn: d.range.start.character + 1,
    endLineNumber: d.range.end.line + 1,
    endColumn: d.range.end.character + 1,
  };
}

function toRange(r: {
  start: { line: number; character: number };
  end: { line: number; character: number };
}): monaco.IRange {
  return {
    startLineNumber: r.start.line + 1,
    startColumn: r.start.character + 1,
    endLineNumber: r.end.line + 1,
    endColumn: r.end.character + 1,
  };
}

const connections = new Map<string, LSPConnection>();

function getConnection(lang: string, root: string): LSPConnection {
  const key = `${lang}::${root}`;
  let conn = connections.get(key);
  if (!conn) {
    conn = new LSPConnection(lang, root);
    connections.set(key, conn);
  }
  return conn;
}

/**
 * Wires a Monaco editor/model up to a language server over WebSocket:
 * opens the document, registers hover/completion/definition/references
 * providers for the language (once, shared across every file of that
 * language), and forwards diagnostics as Monaco markers. Returns a
 * cleanup function that closes just this document (the underlying
 * connection and process stay alive for other open files).
 */
export function openLSPDocument(
  editor: monaco.editor.IStandaloneCodeEditor,
  model: monaco.editor.ITextModel,
  rootPath?: string,
  serverId?: string,
): () => void {
  const languageId = model.getLanguageId();
  const server = serverId ?? languageId;
  const uri = model.uri.toString();

  const conn = getConnection(server, rootPath ?? "");
  let disposed = false;

  void conn.waitUntilReady().then(() => {
    if (disposed) return;
    conn.openDocument(uri, languageId, model.getValue());
  });

  const changeSub = model.onDidChangeContent(() => {
    void conn.waitUntilReady().then(() => {
      if (!disposed) conn.changeDocument(uri, model.getValue());
    });
  });

  const offDiagnostics = conn.onDiagnostics((diagUri, markers) => {
    if (diagUri !== uri) return;
    monaco.editor.setModelMarkers(model, `lsp-${languageId}`, markers);
  });

  // Providers are registered once per language, shared by every model of
  // that language — Monaco's provider APIs are global per languageId.
  if (!conn.markProvidersRegistered()) {
    monaco.languages.registerHoverProvider(languageId, {
      async provideHover(hoverModel, position) {
        await conn.waitUntilReady();
        const result = await conn.hover(hoverModel.uri.toString(), position);
        console.log("Hover:", hoverModel.uri.toString(), JSON.stringify(result, null, 2));
        if (!result) return null;
        const contents = extractHoverContents(
          (result as { contents: unknown }).contents,
        );
        if (!contents.length) return null;
        const range = (result as { range?: Parameters<typeof toRange>[0] })
          .range
          ? toRange((result as { range: Parameters<typeof toRange>[0] }).range)
          : undefined;
        return {
          contents,
          range,
        };
      },
    });

    monaco.languages.registerCompletionItemProvider(languageId, {
      triggerCharacters: [".", '"', "'", "/", "@", "<", ":"],
      async provideCompletionItems(compModel, position) {
        await conn.waitUntilReady();

        const result = await conn.completion(
          compModel.uri.toString(),
          position,
        );
        console.log("completetion", JSON.stringify(result, null, 2));

        if (!result) return { suggestions: [] };
        const items = Array.isArray(result)
          ? result
          : ((result as { items?: unknown[] }).items ?? []);
        const word = compModel.getWordUntilPosition(position);
        const range: monaco.IRange = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };
        return {
          suggestions: (items as Array<Record<string, unknown>>).map(
            (item) => ({
              label: String(item.label ?? ""),
              kind: mapCompletionKind(item.kind as number | undefined),
              detail: item.detail as string | undefined,
              documentation: extractDocumentation(item.documentation),
              insertText: String(item.insertText ?? item.label ?? ""),
              range,
            }),
          ),
        };
      },
    });

    monaco.languages.registerDefinitionProvider(languageId, {
      async provideDefinition(defModel, position) {
        await conn.waitUntilReady();
        const result = await conn.definition(defModel.uri.toString(), position);
        console.log("Definition:", JSON.stringify(result, null, 2));
        return toLocations(result);
      },
    });

    monaco.languages.registerReferenceProvider(languageId, {
      async provideReferences(refModel, position) {
        await conn.waitUntilReady();
        const result = await conn.references(refModel.uri.toString(), position);
        console.log("References:", JSON.stringify(result, null, 2));
        return toLocations(result);
      },
    });
  }

  return () => {
    disposed = true;
    changeSub.dispose();
    offDiagnostics();
    void conn.waitUntilReady().then(() => conn.closeDocument(uri));
    monaco.editor.setModelMarkers(model, `lsp-${languageId}`, []);
  };
}

function extractHoverContents(contents: unknown): monaco.IMarkdownString[] {
  if (!contents) return [];
  if (Array.isArray(contents)) {
    return contents.map((c) => ({
      value:
        typeof c === "string"
          ? c
          : String((c as { value?: string }).value ?? ""),
    }));
  }
  if (typeof contents === "string") return [{ value: contents }];
  const c = contents as { value?: string; language?: string };
  if (typeof c.value === "string") {
    return [
      {
        value: c.language
          ? "```" + c.language + "\n" + c.value + "\n```"
          : c.value,
      },
    ];
  }
  return [];
}

function extractDocumentation(doc: unknown): string | undefined {
  if (!doc) return undefined;
  if (typeof doc === "string") return doc;
  const d = doc as { value?: string };
  return d.value;
}

function toLocations(result: JSONValue): monaco.languages.Location[] {
  if (!result) return [];
  const arr = Array.isArray(result) ? result : [result];
  return (arr as Array<Record<string, unknown>>)
    .map((loc) => {
      const uri = (loc.uri as string) ?? (loc.targetUri as string);
      const range =
        (loc.range as Parameters<typeof toRange>[0]) ??
        (loc.targetSelectionRange as Parameters<typeof toRange>[0]);
      if (!uri || !range) return null;
      return { uri: monaco.Uri.parse(uri), range: toRange(range) };
    })
    .filter((x): x is monaco.languages.Location => x !== null);
}

function mapCompletionKind(kind?: number): monaco.languages.CompletionItemKind {
  const map: Record<number, monaco.languages.CompletionItemKind> = {
    1: monaco.languages.CompletionItemKind.Text,
    2: monaco.languages.CompletionItemKind.Method,
    3: monaco.languages.CompletionItemKind.Function,
    4: monaco.languages.CompletionItemKind.Constructor,
    5: monaco.languages.CompletionItemKind.Field,
    6: monaco.languages.CompletionItemKind.Variable,
    7: monaco.languages.CompletionItemKind.Class,
    8: monaco.languages.CompletionItemKind.Interface,
    9: monaco.languages.CompletionItemKind.Module,
    10: monaco.languages.CompletionItemKind.Property,
    14: monaco.languages.CompletionItemKind.Keyword,
    22: monaco.languages.CompletionItemKind.Struct,
  };
  return map[kind ?? 1] ?? monaco.languages.CompletionItemKind.Text;
}
