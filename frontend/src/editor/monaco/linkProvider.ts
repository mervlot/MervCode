import * as monaco from "monaco-editor";
import { ResolveFileReference } from "../../../wailsjs/go/main/App";
import { BrowserOpenURL } from "../../../wailsjs/runtime/runtime";
import type { main } from "../../../wailsjs/go/models";

// ============================================================================
// Ctrl/Cmd+Click "open file" for import specifiers, relative/absolute file
// paths, and file:// URIs found in any open document - the same gesture
// VS Code uses for import links. Plain http(s) URLs are also routed
// through the system browser instead of whatever Monaco's default (no-op
// in a plain embed) opener would otherwise do.
//
// Registered once, globally, across every language Monaco knows about
// (this is a text-pattern feature, not a language-semantic one - it works
// just as well in a JSON "extends" field or a Markdown link as it does in
// a TypeScript import). LSP-backed languages still separately get
// Ctrl+Click-to-definition via their own definitionProvider (see
// editor/lsp/providers.ts); this fills the gap for everything else,
// including files/config formats with no language server at all.
//
// provideLinks is debounced and cache-backed: Monaco can re-request links
// on every content change, and without this a large file with many quoted
// strings would fire a Go round-trip per candidate on every keystroke,
// which is exactly the kind of main-thread/IPC congestion that makes
// typing feel laggy. Debouncing + caching keeps the steady-state cost at
// effectively zero once a file's imports have been resolved once.
// ============================================================================

const MAX_SCAN_LENGTH = 2_000_000; // don't slow down editing huge files
const MAX_CANDIDATES = 300; // bound work for pathological files
const DEBOUNCE_MS = 250;

const QUOTED_STRING_RE = /(["'`])((?:\\.|(?!\1)[^\\\n])*)\1/g;
const FILE_URI_RE = /file:\/\/[^\s"'`)]+/g;
const KNOWN_EXTENSION_RE =
  /\.(ts|tsx|js|jsx|mjs|cjs|go|java|kt|kts|json|jsonc|ya?ml|toml|css|scss|less|html?|md|mdx)$/i;

interface Candidate {
  text: string;
  range: monaco.IRange;
}

function looksLikePath(s: string): boolean {
  if (!s || s.length > 400 || /\s/.test(s)) return false;
  if (s.startsWith("./") || s.startsWith("../") || s.startsWith("~/"))
    return true;
  if (/^[A-Za-z]:[\\/]/.test(s)) return true;
  if (s.startsWith("/") && s.length > 1) return true;
  return KNOWN_EXTENSION_RE.test(s) && /[\\/]/.test(s);
}

function collectCandidates(model: monaco.editor.ITextModel): Candidate[] {
  const text = model.getValue();
  if (text.length > MAX_SCAN_LENGTH) return [];

  const candidates: Candidate[] = [];
  const seen = new Set<string>();

  const addCandidate = (start: number, end: number, value: string) => {
    const key = `${start}:${end}`;
    if (seen.has(key) || candidates.length >= MAX_CANDIDATES) return;
    seen.add(key);
    const s = model.getPositionAt(start);
    const e = model.getPositionAt(end);
    candidates.push({
      text: value,
      range: {
        startLineNumber: s.lineNumber,
        startColumn: s.column,
        endLineNumber: e.lineNumber,
        endColumn: e.column,
      },
    });
  };

  QUOTED_STRING_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = QUOTED_STRING_RE.exec(text))) {
    const content = match[2] ?? "";
    if (!looksLikePath(content)) continue;
    const start = match.index + 1; // skip the opening quote
    addCandidate(start, start + content.length, content);
  }

  FILE_URI_RE.lastIndex = 0;
  while ((match = FILE_URI_RE.exec(text))) {
    addCandidate(match.index, match.index + match[0].length, match[0]);
  }

  return candidates;
}

function toFileOpenUri(path: string, line?: number): monaco.Uri {
  const uri = monaco.Uri.file(path);
  return line ? uri.with({ query: `line=${line}` }) : uri;
}

// Caches ResolveFileReference results by (fromFile, text) so re-scanning a
// file whose imports haven't changed - which happens on every keystroke
// elsewhere in the same file - never re-triggers a Go round-trip for
// candidates we've already resolved. Small and process-lifetime-scoped;
// stale entries (a file got deleted/created after being cached) just mean
// an occasional missed or stale link, never a wrong destination, since the
// cache key includes the exact literal text being resolved.
const resolutionCache = new Map<string, main.ResolvedReference>();

function cacheKey(fromFile: string, text: string): string {
  return `${fromFile}\u0000${text}`;
}

async function resolveCached(
  fromFile: string,
  text: string,
): Promise<main.ResolvedReference> {
  const key = cacheKey(fromFile, text);
  const cached = resolutionCache.get(key);
  if (cached) return cached;

  const resolved = await ResolveFileReference(fromFile, text);
  resolutionCache.set(key, resolved);
  return resolved;
}

async function resolveCandidate(
  { range, text }: Candidate,
  fromFile: string,
  token: monaco.CancellationToken,
): Promise<monaco.languages.ILink | null> {
  if (token.isCancellationRequested) return null;

  if (/^https?:\/\//i.test(text) || text.startsWith("mailto:")) {
    return { range, url: monaco.Uri.parse(text), tooltip: "Open in browser" };
  }
  if (!fromFile) return null;

  try {
    const resolved = await resolveCached(fromFile, text);
    if (token.isCancellationRequested) return null;

    if (resolved.kind === "file" && resolved.target) {
      return {
        range,
        url: toFileOpenUri(resolved.target, resolved.line || undefined),
        tooltip: "Ctrl+Click to open",
      };
    }
    if (resolved.kind === "url" && resolved.target) {
      return {
        range,
        url: monaco.Uri.parse(resolved.target),
        tooltip: "Open in browser",
      };
    }
  } catch {
    // Resolution failed - treat as "not actually a link" instead of
    // surfacing an error for what's likely just a plain string literal.
  }
  return null;
}

async function computeLinks(
  model: monaco.editor.ITextModel,
  token: monaco.CancellationToken,
): Promise<monaco.languages.ILinksList> {
  const candidates = collectCandidates(model);
  if (candidates.length === 0 || token.isCancellationRequested) {
    return { links: [] };
  }

  const fromFile = model.uri.scheme === "file" ? model.uri.fsPath : "";
  const resolved = await Promise.all(
    candidates.map((c) => resolveCandidate(c, fromFile, token)),
  );

  if (token.isCancellationRequested) return { links: [] };

  return {
    links: resolved.filter((l): l is monaco.languages.ILink => l !== null),
  };
}

function provideLinks(
  model: monaco.editor.ITextModel,
  token: monaco.CancellationToken,
): Promise<monaco.languages.ILinksList> {
  // Debounced: coalesces the burst of provideLinks calls Monaco fires
  // while the user is actively typing into a single scan+resolve pass
  // after things settle down, instead of doing the work on every
  // keystroke.
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (token.isCancellationRequested) {
        resolve({ links: [] });
        return;
      }
      computeLinks(model, token).then(resolve, () => resolve({ links: [] }));
    }, DEBOUNCE_MS);

    token.onCancellationRequested(() => {
      clearTimeout(timer);
      resolve({ links: [] });
    });
  });
}

let registered = false;

/** Wires up Ctrl/Cmd+Click "open file" for every language Monaco knows
 * about, plus a global opener that routes file:// links back into
 * MervCode's own tab system and http(s) links to the system browser.
 * Safe to call multiple times - only registers once. */
export function registerFileLinks(): void {
  if (registered) return;
  registered = true;

  const languageIds = monaco.languages.getLanguages().map((l) => l.id);
  monaco.languages.registerLinkProvider(languageIds, { provideLinks });

  monaco.editor.registerLinkOpener({
    open(resource): boolean {
      if (resource.scheme === "http" || resource.scheme === "https") {
        BrowserOpenURL(resource.toString(true));
        return true;
      }
      if (resource.scheme === "file") {
        const line = resource.query.startsWith("line=")
          ? Number(resource.query.slice("line=".length))
          : undefined;
        window.dispatchEvent(
          new CustomEvent("mervcode:open-file", {
            detail: { path: resource.fsPath, line },
          }),
        );
        return true;
      }
      return false;
    },
  });
}
