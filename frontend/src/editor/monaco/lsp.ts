import * as monaco from "monaco-editor";
import { EventsOn } from "../../../wailsjs/runtime/runtime";
import {
  LSPOpenFile,
  LSPChangeFile,
  LSPCloseFile,
  LSPHover,
  LSPCompletion,
  LSPDefinition,
} from "../../../wailsjs/go/main/App";

const enabled = new Set<string>();

function uriPath(uri: monaco.Uri): string {
  const p = uri.fsPath || uri.path || uri.toString();
  // Normalize backslashes to forward slashes for cross-platform matching
  return p.replace(/\\/g, "/");
}

function modelToRange(
  range: { start: { line: number; character: number }; end: { line: number; character: number } },
): monaco.IRange {
  return {
    startLineNumber: range.start.line + 1,
    startColumn: range.start.character + 1,
    endLineNumber: range.end.line + 1,
    endColumn: range.end.character + 1,
  };
}

function ensureEnabled(lang: string) {
  if (enabled.has(lang)) return;
  enabled.add(lang);

  monaco.languages.registerHoverProvider(lang, {
    provideHover: async (model, position) => {
      try {
        const result = await LSPHover(
          lang,
          uriPath(model.uri),
          position.lineNumber - 1,
          position.column - 1,
        );
        if (!result || !result.contents) return null;

        const contents = result.contents;
        const markdown: monaco.IMarkdownString[] = [];

        if (typeof contents === "string") {
          markdown.push({ value: contents });
        } else if (Array.isArray(contents)) {
          for (const item of contents) {
            if (typeof item === "string") {
              markdown.push({ value: item });
            } else if (item && typeof item.value === "string") {
              markdown.push({
                value: item.language
                  ? "```" + item.language + "\n" + item.value + "\n```"
                  : item.value,
              });
            }
          }
        } else if (contents && typeof contents.value === "string") {
          markdown.push({
            value: contents.language
              ? "```" + contents.language + "\n" + contents.value + "\n```"
              : contents.value,
          });
        }

        if (markdown.length === 0) return null;

        if (result.range) {
          return {
            contents: markdown,
            range: modelToRange(result.range),
          };
        }

        return { contents: markdown };
      } catch {
        return null;
      }
    },
  });

  monaco.languages.registerCompletionItemProvider(lang, {
    triggerCharacters: [".", "\"", "'", "(", "[", "<", ":", "@"],
    provideCompletionItems: async (model, position) => {
      try {
        const items = await LSPCompletion(
          lang,
          uriPath(model.uri),
          position.lineNumber - 1,
          position.column - 1,
        );
        if (!items || items.length === 0) return { suggestions: [] };

        const suggestions: monaco.languages.CompletionItem[] = items.map(
          (item) => {
            const kindMap: Record<number, monaco.languages.CompletionItemKind> = {
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
              11: monaco.languages.CompletionItemKind.Unit,
              12: monaco.languages.CompletionItemKind.Value,
              13: monaco.languages.CompletionItemKind.Enum,
              14: monaco.languages.CompletionItemKind.Keyword,
              15: monaco.languages.CompletionItemKind.Snippet,
              16: monaco.languages.CompletionItemKind.Color,
              17: monaco.languages.CompletionItemKind.File,
              18: monaco.languages.CompletionItemKind.Reference,
              19: monaco.languages.CompletionItemKind.Folder,
              20: monaco.languages.CompletionItemKind.EnumMember,
              21: monaco.languages.CompletionItemKind.Constant,
              22: monaco.languages.CompletionItemKind.Struct,
              23: monaco.languages.CompletionItemKind.Event,
              24: monaco.languages.CompletionItemKind.Operator,
              25: monaco.languages.CompletionItemKind.TypeParameter,
            };
            const range = item.textEdit?.range
              ? modelToRange(item.textEdit.range)
              : {
                  startLineNumber: position.lineNumber,
                  startColumn: position.column,
                  endLineNumber: position.lineNumber,
                  endColumn: position.column,
                };
            const base: monaco.languages.CompletionItem = {
              label: item.label,
              kind: kindMap[item.kind ?? 0] ?? monaco.languages.CompletionItemKind.Text,
              detail: item.detail ?? "",
              documentation: item.documentation ?? "",
              insertText: item.textEdit?.newText ?? item.insertText ?? item.label,
              range,
            };
            if (item.insertTextFormat === 2) {
              base.insertTextRules = monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet;
            }
            if (item.filterText != null) base.filterText = item.filterText;
            if (item.sortText != null) base.sortText = item.sortText;
            if (item.preselect != null) base.preselect = item.preselect;
            if (item.commitCharacters != null) base.commitCharacters = item.commitCharacters;
            if (item.tags?.includes(1)) base.tags = [1 as monaco.languages.CompletionItemTag];
            return base;
          },
        );

        return { suggestions };
      } catch {
        return { suggestions: [] };
      }
    },
  });

  monaco.languages.registerDefinitionProvider(lang, {
    provideDefinition: async (model, position) => {
      try {
        const result = await LSPDefinition(
          lang,
          uriPath(model.uri),
          position.lineNumber - 1,
          position.column - 1,
        );
        if (!result) return null;

        const uri = monaco.Uri.parse(result.uri);
        return {
          uri,
          range: modelToRange(result.range),
        };
      } catch {
        return null;
      }
    },
  });
}

export function openLSPDocument(editor: monaco.editor.IStandaloneCodeEditor) {
  const model = editor.getModel();
  if (!model) return;

  const lang = model.getLanguageId();
  const path = uriPath(model.uri);
  let docVersion = 1;

  ensureEnabled(lang);

  LSPOpenFile(lang, path, model.getValue()).catch(() => undefined);

  const changeSub = model.onDidChangeContent(() => {
    docVersion++;
    LSPChangeFile(lang, path, model.getValue(), docVersion).catch(
      () => undefined,
    );
  });

  const diagListener = EventsOn(
    "lsp:diagnostics",
    (data: { uri: string; path: string; language: string; diagnostics: any[] }) => {
      if (data.language !== lang) return;
      if (data.path !== path) return;

      const markers: monaco.editor.IMarkerData[] =
        data.diagnostics?.map((d: any) => {
          const severityMap: Record<number, monaco.MarkerSeverity> = {
            1: monaco.MarkerSeverity.Error,
            2: monaco.MarkerSeverity.Warning,
            3: monaco.MarkerSeverity.Info,
            4: monaco.MarkerSeverity.Hint,
          };
          const marker: monaco.editor.IMarkerData = {
            severity: severityMap[d.severity] ?? monaco.MarkerSeverity.Error,
            message: d.message,
            ...modelToRange(d.range),
            ...(typeof d.source === "string" ? { source: d.source } : {}),
            ...(d.code != null ? { code: d.code } : {}),
            ...(d.relatedInformation?.length ? {
              relatedInformation: d.relatedInformation.map(
                (ri: any) => ({
                  resource: monaco.Uri.parse(ri.location.uri),
                  message: ri.message,
                  ...modelToRange(ri.location.range),
                }),
              ),
            } : {}),
          };
          if (d.tags?.includes(1)) {
            marker.tags = [monaco.MarkerTag.Deprecated];
          } else if (d.tags?.includes(2)) {
            marker.tags = [monaco.MarkerTag.Unnecessary];
          }
          return marker;
        }) ?? [];

      monaco.editor.setModelMarkers(model, "lsp", markers);
    },
  );

  return () => {
    LSPCloseFile(lang, path).catch(() => undefined);
    changeSub.dispose();
    diagListener();
  };
}
