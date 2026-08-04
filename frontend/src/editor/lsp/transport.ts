import { CreateLSPSession } from "../../../wailsjs/go/main/App";
import type { JSONRPCMessage } from "./protocol";

// ============================================================================
// Raw message transport for one LSP session: opens the WebSocket the Go
// bridge (lsp_bridge.go) exposes, and shuttles plain JSON-RPC text frames
// in both directions. Knows nothing about LSP semantics (requests vs
// notifications, capabilities, documents, ...) - that's connection.ts.
//
// Every frame crossing the socket is ALSO logged to the browser console
// (look for `[lsp ↑]` = frontend -> Go bridge, `[lsp ↓]` = Go bridge ->
// frontend) so backend traffic is visible without opening the Inspector.
// Document text is summarized so large buffers can't flood the console.
//
// This is the seam where an alternate transport (raw TCP to a remote
// clangd, attaching to an already-running server, ...) would plug in
// later: connection.ts only depends on the {send, onMessage, onClose,
// close} shape below, not on WebSocket specifically.
// ============================================================================

const MAX_FRAME_LOG = 300;

function summarizeText(s: string): string {
  if (s.length <= MAX_FRAME_LOG) return s;
  return `${s.slice(0, MAX_FRAME_LOG)}...[${s.length - MAX_FRAME_LOG} more chars]`;
}

// Summarizes document text inside params (didOpen.text, didChange.contentChanges[*].text)
// while leaving every other field untouched, mirroring the Go bridge.
function summarizeParams(params: unknown): unknown {
  if (params === null || typeof params !== "object") return params;
  if (Array.isArray(params)) return params.map((p) => summarizeParams(p));
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
    if (key === "text" && typeof value === "string") {
      out[key] = summarizeText(value);
    } else if (key === "contentChanges" && Array.isArray(value)) {
      out[key] = value.map((change) => {
        if (change && typeof change === "object" && "text" in change) {
          return {
            ...(change as Record<string, unknown>),
            text: summarizeText(String(change.text)),
          };
        }
        return change;
      });
    } else {
      out[key] = summarizeParams(value);
    }
  }
  return out;
}

function logFrame(direction: "↑" | "↓", lang: string, msg: JSONRPCMessage): void {
  const id = msg.id !== undefined ? `#${JSON.stringify(msg.id)}` : "";
  const method = msg.method ?? (id ? "(response)" : "(event)");
  const payload =
    msg.params !== undefined
      ? ` params=${JSON.stringify(summarizeParams(msg.params))}`
      : msg.error !== undefined
        ? ` error=${JSON.stringify(msg.error)}`
        : msg.result !== undefined
          ? ` result=${JSON.stringify(summarizeParams(msg.result))}`
          : "";
  console.log(`[lsp ${direction}] (${lang}) ${id} ${method}${payload}`);
}

export interface Transport {
  readonly sessionId: string | null;
  send(msg: JSONRPCMessage): void;
  onMessage(fn: (msg: JSONRPCMessage) => void): void;
  onClose(fn: (reason: string) => void): void;
  close(): void;
}

export class WebSocketTransport implements Transport {
  private ws: WebSocket | null = null;
  private messageHandlers: Array<(msg: JSONRPCMessage) => void> = [];
  private closeHandlers: Array<(reason: string) => void> = [];
  private closedManually = false;
  private lang = "";
  sessionId: string | null = null;

  static async connect(lang: string, root: string): Promise<WebSocketTransport> {
    const transport = new WebSocketTransport();
    await transport.open(lang, root);
    return transport;
  }

  private async open(lang: string, root: string): Promise<void> {
    this.lang = lang;
    const url = await CreateLSPSession(lang, root || "");
    this.sessionId = extractToken(url);
    console.log(`[lsp ↑] (${lang}) CreateLSPSession -> ${url.replace(/token=\w+/, "token=***")}`);

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(url);
      this.ws = ws;

      ws.onopen = () => {
        console.log(`[lsp] (${lang}) WebSocket open, session=${this.sessionId}`);
        resolve();
      };
      ws.onerror = () => reject(new Error(`LSP WebSocket error (${lang})`));
      ws.onclose = (ev) => {
        if (this.closedManually) return;
        const reason = ev.reason || `socket closed (code ${ev.code})`;
        console.warn(`[lsp] (${lang}) WebSocket closed: ${reason}`);
        this.closeHandlers.forEach((fn) => {
          fn(reason);
        });
      };
      ws.onmessage = (ev) => {
        const msg = parseMessage(ev.data);
        if (msg) {
          logFrame("↓", lang, msg);
          this.messageHandlers.forEach((fn) => {
            fn(msg);
          });
        } else {
          console.warn(`[lsp ↓] (${lang}) unparseable frame:`, ev.data);
        }
      };
    });
  }

  send(msg: JSONRPCMessage): void {
    logFrame("↑", this.lang, msg);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      console.warn(`[lsp ↑] (${this.lang}) dropped - socket not open`, msg);
    }
  }

  onMessage(fn: (msg: JSONRPCMessage) => void): void {
    this.messageHandlers.push(fn);
  }

  onClose(fn: (reason: string) => void): void {
    this.closeHandlers.push(fn);
  }

  close(): void {
    this.closedManually = true;
    console.log(`[lsp] (${this.lang}) transport closed manually`);
    this.ws?.close();
    this.ws = null;
  }
}

function parseMessage(raw: unknown): JSONRPCMessage | null {
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw) as JSONRPCMessage;
  } catch {
    return null;
  }
}

function extractToken(wsUrl: string): string | null {
  try {
    return new URL(wsUrl).searchParams.get("token");
  } catch {
    return null;
  }
}
