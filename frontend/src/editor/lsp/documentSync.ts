import type * as monaco from "monaco-editor";
import type { LSPConnection } from "./connection";
import { TextDocumentSyncKind, type ContentChange } from "./protocol";

// ============================================================================
// Bridges Monaco's own change-tracking to LSP's `didChange` notifications.
//
// Monaco already computes exact edit ranges for every keystroke via
// `onDidChangeModelContent` - `event.changes` gives ranges ordered so they
// can be applied sequentially without adjusting for earlier edits in the
// same batch, which is exactly what LSP's incremental
// `TextDocumentContentChangeEvent[]` expects. So incremental sync here is
// just a coordinate-space conversion (Monaco is 1-based, LSP is 0-based),
// not a diffing algorithm.
//
// Falls back to whole-document sync automatically for servers that only
// declared `TextDocumentSyncKind.Full` (or omitted it) during capability
// negotiation.
// ============================================================================

export function wireDocumentSync(
  connection: LSPConnection,
  model: monaco.editor.ITextModel,
  uri: string,
  languageId: string,
): () => void {
  connection.openDocument(uri, languageId, model);

  const subscription = model.onDidChangeContent((event) => {
    connection.changeDocument(uri, toContentChanges(connection, model, event));
  });

  return () => subscription.dispose();
}

function toContentChanges(
  connection: LSPConnection,
  model: monaco.editor.ITextModel,
  event: monaco.editor.IModelContentChangedEvent,
): ContentChange[] {
  if (connection.capabilities.syncKind !== TextDocumentSyncKind.Incremental) {
    return [{ text: model.getValue() }];
  }

  return event.changes.map((change) => ({
    range: {
      start: {
        line: change.range.startLineNumber - 1,
        character: change.range.startColumn - 1,
      },
      end: {
        line: change.range.endLineNumber - 1,
        character: change.range.endColumn - 1,
      },
    },
    rangeLength: change.rangeLength,
    text: change.text,
  }));
}
