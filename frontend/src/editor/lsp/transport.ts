import { CreateLSPSession } from "../../../wailsjs/go/main/App";
import type { JSONRPCMessage } from "./protocol";

// ============================================================================
// Raw message transport for one LSP session: opens the WebSocket the Go
// bridge (lsp_bridge.go) exposes, and shuttles plain JSON-RPC text frames
// in both directions. Knows nothing about LSP semantics (requests vs
// notifications, capabilities, documents, ...) - that's connection.ts.
//
// This is the seam where an alternate transport (raw TCP to a remote
// clangd, attaching to an already-running server, ...) would plug in
// later: connection.ts only depends on the {send, onMessage, onClose,
// close} shape below, not on WebSocket specifically.
// ============================================================================

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
  sessionId: string | null = null;

  static async connect(lang: string, root: string): Promise<WebSocketTransport> {
    const transport = new WebSocketTransport();
    await transport.open(lang, root);
    return transport;
  }

  private async open(lang: string, root: string): Promise<void> {
    const url = await CreateLSPSession(lang, root || "");
    this.sessionId = extractToken(url);

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(url);
      this.ws = ws;

      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error(`LSP WebSocket error (${lang})`));
      ws.onclose = (ev) => {
        if (this.closedManually) return;
        const reason = ev.reason || `socket closed (code ${ev.code})`;
        this.closeHandlers.forEach((fn) => fn(reason));
      };
      ws.onmessage = (ev) => {
        const msg = parseMessage(ev.data);
        if (msg) this.messageHandlers.forEach((fn) => fn(msg));
      };
    });
  }

  send(msg: JSONRPCMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
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
