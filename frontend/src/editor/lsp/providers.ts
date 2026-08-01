import * as monaco from "monaco-editor";
import type { LSPConnection } from "./connection";
import type { LSPLocation, LSPRange } from "./protocol";

// ============================================================================
// Registers Monaco's hover/completion/definition/reference providers for a
// language, backed by an LSPConnection. Providers are registered once per
// language (shared across every open file of that language, matching
// Monaco's provider APIs being global per languageId) and gated on the
// server's negotiated capabilities so an unsupported feature never fires a doomed request.
//
// Cancellation: Monaco hands every provider a CancellationToken. It's wired
// straight to the underlying request's cancel() so moving the cursor away
// mid-hover (or typing past a completion trigger) sends `$/cancelRequest`
// and drops the response instead of letting stale results race the UI.
// ============================================================================

export function registerProviders(
  languageId: string,
  connection: LSPConnection,
): void {
  if (connection.markProvidersRegistered()) return;

  monaco.languages.registerHoverProvider(languageId, {
    async provideHover(model, position, token) {
      await connection.waitUntilReady();
      if (!connection.capabilities.hover) return null;

      const { promise, cancel } = connection.hoverRequest(
        model.uri.toString(),
        position,
      );
      token.onCancellationRequested(cancel);
      const result = await promise;
      if (token.isCancellationRequested || !result) return null;

      const contents = extractHoverContents(
        (result as { contents: unknown }).contents,
      );
      if (!contents.length) return null;

      const hoverRange = (result as { range?: LSPRange }).range;
      // Monaco's Hover type is exactOptionalPropertyTypes-strict, so the
      // `range` key is only included when there actually is one.
      return hoverRange
        ? { contents, range: toRange(hoverRange) }
        : { contents };
    },
  });

  monaco.languages.registerCompletionItemProvider(languageId, {
    triggerCharacters: [".", '"', "'", "/", "@", "<", ":"],
    async provideCompletionItems(model, position, _context, token) {
      await connection.waitUntilReady();
      if (!connection.capabilities.completion) return { suggestions: [] };

      const { promise, cancel } = connection.completionRequest(
        model.uri.toString(),
        position,
      );
      token.onCancellationRequested(cancel);
      const result = await promise;
      if (token.isCancellationRequested || !result) return { suggestions: [] };

      const items = Array.isArray(result)
        ? result
        : ((result as { items?: unknown[] }).items ?? []);
      const word = model.getWordUntilPosition(position);
      const range: monaco.IRange = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      return {
        suggestions: (items as Array<Record<string, unknown>>).map((item) =>
          buildSuggestion(item, range),
        ),
      };
    },
  });

  monaco.languages.registerDefinitionProvider(languageId, {
    async provideDefinition(model, position, token) {
      await connection.waitUntilReady();
      if (!connection.capabilities.definition) return null;

      const { promise, cancel } = connection.definitionRequest(
        model.uri.toString(),
        position,
      );
      token.onCancellationRequested(cancel);
      const result = await promise;
      if (token.isCancellationRequested) return null;
      return toLocations(result);
    },
  });

  monaco.languages.registerReferenceProvider(languageId, {
    async provideReferences(model, position, _context, token) {
      await connection.waitUntilReady();
      if (!connection.capabilities.references) return null;

      const { promise, cancel } = connection.referencesRequest(
        model.uri.toString(),
        position,
      );
      token.onCancellationRequested(cancel);
      const result = await promise;
      if (token.isCancellationRequested) return null;
      return toLocations(result);
    },
  });
}

function toRange(r: LSPRange): monaco.IRange {
  return {
    startLineNumber: r.start.line + 1,
    startColumn: r.start.character + 1,
    endLineNumber: r.end.line + 1,
    endColumn: r.end.character + 1,
  };
}

function extractHoverContents(contents: unknown): monaco.IMarkdownString[] {
  if (!contents) return [];

  if (typeof contents === "string") {
    return [{ value: contents }];
  }
  if (Array.isArray(contents)) {
    return contents.map((c) => {
      if (typeof c === "string") return { value: c };
      const marked = c as { language?: string; value?: string };
      if (marked.value !== undefined) {
        return marked.language
          ? { value: "```" + marked.language + "\n" + marked.value + "\n```" }
          : { value: marked.value };
      }
      return { value: String(c) };
    });
  }

  const c = contents as { kind?: string; value?: string; language?: string };
  if (c.value !== undefined) {
    return c.language
      ? [{ value: "```" + c.language + "\n" + c.value + "\n```" }]
      : [{ value: c.value }];
  }
  return [];
}

function extractDocumentation(
  documentation: unknown,
): string | monaco.IMarkdownString | undefined {
  if (!documentation) return undefined;
  if (typeof documentation === "string") return documentation;
  const d = documentation as { value?: string };
  return d.value !== undefined ? { value: d.value } : undefined;
}

/** Builds a Monaco completion item, only setting `detail`/`documentation`
 * when the server actually provided them - Monaco's CompletionItem type is
 * exactOptionalPropertyTypes-strict, so an explicit `undefined` for either
 * key is a type error, not just a no-op. */
function buildSuggestion(
  item: Record<string, unknown>,
  range: monaco.IRange,
): monaco.languages.CompletionItem {
  const suggestion: monaco.languages.CompletionItem = {
    label: String(item.label ?? ""),
    kind: mapCompletionKind(item.kind as number | undefined),
    insertText: String(item.insertText ?? item.label ?? ""),
    range,
  };

  const detail = item.detail as string | undefined;
  if (detail !== undefined) suggestion.detail = detail;

  const documentation = extractDocumentation(item.documentation);
  if (documentation !== undefined) suggestion.documentation = documentation;

  return suggestion;
}

function toLocations(result: unknown): monaco.languages.Location[] {
  if (!result) return [];
  const arr = Array.isArray(result) ? result : [result];
  return (arr as LSPLocation[]).map((loc) => ({
    uri: monaco.Uri.parse(loc.uri),
    range: toRange(loc.range),
  }));
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
