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
let docVersion = 1;

function uriPath(uri: monaco.Uri): string {
  return uri.path || uri.toString();
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
            range: new monaco.Range(
              result.range.start.line + 1,
              result.range.start.character + 1,
              result.range.end.line + 1,
              result.range.end.character + 1,
            ),
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
            const kindMap: Record<
              number,
              monaco.languages.CompletionItemKind
            > = {
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
            return {
              label: item.label,
              kind:
                kindMap[item.kind] ??
                monaco.languages.CompletionItemKind.Text,
              detail: item.detail ?? "",
              documentation: item.documentation ?? "",
              insertText: item.insertText || item.label,
              range: {
                startLineNumber: position.lineNumber,
                startColumn: 1,
                endLineNumber: position.lineNumber,
                endColumn: position.column,
              },
            };
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
          range: new monaco.Range(
            result.range.start.line + 1,
            result.range.start.character + 1,
            result.range.end.line + 1,
            result.range.end.character + 1,
          ),
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
    (data: { uri: string; language: string; diagnostics: any[] }) => {
      if (data.language !== lang) return;
      if (data.uri !== path) return;

      const markers: monaco.editor.IMarkerData[] =
        data.diagnostics?.map((d: any) => {
          const severityMap: Record<number, monaco.MarkerSeverity> = {
            1: monaco.MarkerSeverity.Error,
            2: monaco.MarkerSeverity.Warning,
            3: monaco.MarkerSeverity.Info,
            4: monaco.MarkerSeverity.Hint,
          };
          return {
            severity:
              severityMap[d.severity] ?? monaco.MarkerSeverity.Error,
            message: d.message,
            startLineNumber: d.range.start.line + 1,
            startColumn: d.range.start.character + 1,
            endLineNumber: d.range.end.line + 1,
            endColumn: d.range.end.character + 1,
          };
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
