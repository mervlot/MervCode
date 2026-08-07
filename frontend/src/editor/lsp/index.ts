import * as monaco from "monaco-editor";
import type { LSPConnection } from "./connection";
import {
  getConnection,
  releaseConnectionWhenIdle,
  resolveProjectRoot,
} from "./connectionRegistry";
import { wireDocumentSync } from "./documentSync";
import {
  registerProviders,
  setDocumentConnection,
  clearDocumentConnection,
} from "./providers";

// ============================================================================
// Public entry point for the LSP module - this is the only thing language
// modules under editor/monaco/languages/*.ts import. Everything else
// (transport, connection lifecycle, document sync, providers, capability
// negotiation, request scheduling, Dev Tools logging) is an internal
// implementation detail split across the other files in this folder.
// See the other modules for what each piece owns:
//   protocol.ts          - JSON-RPC / LSP wire types
//   uri.ts                - path <-> file:// URI helpers
//   logger.ts             - Dev Tools / LSP Inspector event log
//   requestScheduler.ts   - priority + concurrency-limited request queue
//   capabilities.ts       - normalized ServerCapabilities
//   transport.ts          - WebSocket wire I/O
//   connection.ts         - per (language, root) orchestrator + crash recovery
//   documentSync.ts       - Monaco model changes -> LSP didChange deltas
//   providers.ts          - Monaco hover/completion/definition/reference providers
//   diagnostics.ts        - LSP Diagnostic -> Monaco marker mapping
//   connectionRegistry.ts - connection cache + project root resolution
// ============================================================================

/**
 * Wires a Monaco editor/model up to a language server: resolves which
 * project actually owns this file, opens the document on that project's
 * (shared, cached) connection, registers hover/completion/definition/
 * references providers for the language, and forwards diagnostics as
 * Monaco markers. Returns a cleanup function that closes just this
 * document - the underlying connection and server process stay alive for
 * other open files in the same project.
 */
export function openLSPDocument(
  _editor: monaco.editor.IStandaloneCodeEditor,
  model: monaco.editor.ITextModel,
  rootPath?: string,
  serverId?: string,
): () => void {
  const languageId = model.getLanguageId();
  const server = serverId ?? languageId;
  const uri = model.uri.toString();

  console.log(
    `[lsp] attach document uri=${uri} documentLanguage=${languageId} server=${server} requestedRoot=${rootPath ?? "(auto)"}`,
  );

  let disposed = false;
  let stopSync: (() => void) | null = null;
  let stopDiagnostics: (() => void) | null = null;
  let connection: LSPConnection | null = null;

  void resolveProjectRoot(server, model.uri.fsPath, rootPath ?? "")
    .then((root) => {
      if (disposed) return;

      const conn = getConnection(server, root);
      connection = conn;

      console.log(
        `[lsp] resolved document uri=${uri} documentLanguage=${languageId} server=${server} root=${root}`,
      );

      setDocumentConnection(uri, conn);
      registerProviders(languageId);
      stopSync = wireDocumentSync(conn, model, uri, languageId);
      stopDiagnostics = conn.onDiagnostics((diagUri, markers) => {
        if (diagUri !== uri) return;
        monaco.editor.setModelMarkers(model, `lsp-${languageId}`, markers);
      });
    })
    .catch((err) => {
      // Don't let a failure here (backend call rejecting, connection setup
      // throwing, etc.) become an unhandled rejection - that can surface
      // as a blocking dev-overlay "crash" even though it only affects this
      // one file's language features. The editor itself stays usable
      // either way; it just won't have hover/completion/diagnostics.
      console.warn(`[MervCode] LSP setup failed for ${uri}:`, err);
    });

  return () => {
    disposed = true;
    stopSync?.();
    stopDiagnostics?.();
    console.log(
      `[lsp] detach document uri=${uri} documentLanguage=${languageId} server=${server}`,
    );
    clearDocumentConnection(uri);
    const conn = connection;
    if (conn) {
      void conn.waitUntilReady().then(() => {
        conn.closeDocument(uri);
        releaseConnectionWhenIdle(conn);
      });
    }
    monaco.editor.setModelMarkers(model, `lsp-${languageId}`, []);
  };
}
