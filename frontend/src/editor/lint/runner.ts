import * as monaco from "monaco-editor";
import { LintDocument } from "../../../wailsjs/go/main/App";
import { toMarker } from "./toMarker";

// ============================================================================
// Generic, language-agnostic lint runner. Mirrors the LSP module's split
// (transport/connection/diagnostics) at a much smaller scale: this file
// owns *when* to lint (debounced on content change) and how results become
// Monaco markers; it has zero knowledge of ESLint, Prettier, or any other
// specific tool - that all lives behind the single `LintDocument(lang,
// filePath, content)` Go call (toolchain.go + eslint.go), which returns
// already-normalized diagnostics regardless of which linter actually ran.
//
// Adding a linter for another language never touches this file: register
// it in toolchain.go's LanguageToolchain.Linter, then call
// `registerLinter("<lang>", model)` from that language's MonacoLanguage
// module (see languages/typescriptFamily.ts) - identical to how
// `openLSPDocument` is reused across languages that share one LSP server.
// ============================================================================

// Running an external linter process on every keystroke would be wasteful
// (and, for slower linters, would pile up overlapping runs) - debounce to
// the same rhythm as a typical "lint on idle" editor integration.
const LINT_DEBOUNCE_MS = 600;

const MARKER_OWNER_PREFIX = "lint-";

/**
 * Starts linting `model` against `lang`'s configured linter (see
 * toolchain.go): runs once immediately, then again after `LINT_DEBOUNCE_MS`
 * of no further edits. Returns a cleanup function that cancels any pending
 * run and clears this linter's markers - call it when the document is
 * closed or the language changes.
 *
 * Silently produces no markers (rather than surfacing an error to the
 * user) when the language has no linter configured, or when the linter
 * itself fails to run (missing binary, parse error, ...) - LSP diagnostics
 * remain the primary correctness signal; lint markers are a supplementary
 * style/quality layer that shouldn't be noisy when unavailable.
 */
export function registerLinter(
  lang: string,
  model: monaco.editor.ITextModel,
): () => void {
  const ownerId = `${MARKER_OWNER_PREFIX}${lang}`;
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let generation = 0;

  async function run() {
    const myGeneration = ++generation;
    const filePath = model.uri.fsPath;
    const content = model.getValue();

    let diagnostics: Awaited<ReturnType<typeof LintDocument>> = [];
    try {
      diagnostics = await LintDocument(lang, filePath, content);
    } catch {
      diagnostics = [];
    }

    // The model may have been disposed, or a newer run started, while the
    // Go call was in flight - never let a stale result clobber markers for
    // content the user has already moved past.
    if (disposed || myGeneration !== generation || model.isDisposed()) return;

    monaco.editor.setModelMarkers(
      model,
      ownerId,
      diagnostics.map((d) => toMarker(d, lang)),
    );
  }

  function scheduleRun() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void run(), LINT_DEBOUNCE_MS);
  }

  const changeSub = model.onDidChangeContent(scheduleRun);
  scheduleRun();

  return () => {
    disposed = true;
    if (timer) clearTimeout(timer);
    changeSub.dispose();
    if (!model.isDisposed()) monaco.editor.setModelMarkers(model, ownerId, []);
  };
}
