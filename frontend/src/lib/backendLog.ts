// ============================================================================
// Global backend-call tracer.
//
// Wails exposes every Go-bound App method on window.go.main.App; the
// generated wailsjs/go/main/App.js bindings are thin wrappers around that
// host object. installBackendTracing() wraps every method in place so that
// ANY frontend -> Go call - regardless of which component or library made
// it, without touching a single call site - is logged to the browser
// console with its arguments and result (or rejection).
//
// Call once from main.tsx before the app renders.
//
// Long document payloads are truncated in the log (via summarizeText) so
// keystroke-level traffic can't flood the console, but every call is
// visible: method name, args, outcome, and latency.
// ============================================================================

const MAX_TEXT_LOG = 300;

export function summarizeText(s: string): string {
  if (s.length <= MAX_TEXT_LOG) return s;
  return `${s.slice(0, MAX_TEXT_LOG)}...[${s.length - MAX_TEXT_LOG} more chars]`;
}

// Mirrors the summary logic used by the Go bridge (lsp_bridge.go) so the
// two consoles show the same picture of document payloads.
function summarizeArg(value: unknown, depth = 0): unknown {
  if (typeof value === "string") return summarizeText(value);
  if (value === null || value === undefined || typeof value !== "object") {
    return value;
  }
  if (depth > 2) return "[deep]";
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((v) => summarizeArg(v, depth + 1));
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = summarizeArg(v, depth + 1);
  }
  return out;
}

type WailsFn = (...args: unknown[]) => unknown;

export function installBackendTracing(): void {
  const host = (window as unknown as Record<string, unknown>)?.go as
    | { main?: { App?: Record<string, WailsFn> } }
    | undefined;
  const app = host?.main?.App;
  if (!app) {
    console.warn("[backend] window.go.main.App not found - tracing NOT installed");
    return;
  }

  let wrapped = 0;
  for (const key of Object.keys(app)) {
    const original = app[key];
    if (typeof original !== "function") continue;
    if ((original as unknown as { __mervTraced?: boolean }).__mervTraced) continue;

    const traced: WailsFn = function (this: unknown, ...args: unknown[]) {
      const started = performance.now();
      const safeArgs = args.map((a) => summarizeArg(a));

      let result: unknown;
      try {
        result = original.apply(this, args);
      } catch (err) {
        console.error(`[backend →] App.${key}(${JSON.stringify(safeArgs)}) THREW:`, err);
        throw err;
      }

      if (result && typeof (result as Promise<unknown>).then === "function") {
        (result as Promise<unknown>).then(
          (value) => {
            console.log(
              `[backend ←] App.${key} → ok (${(performance.now() - started).toFixed(1)}ms):`,
              summarizeArg(value),
            );
          },
          (reason) => {
            console.error(
              `[backend ←] App.${key} → FAILED (${(performance.now() - started).toFixed(1)}ms):`,
              reason,
            );
          },
        );
        return result;
      }

      console.log(
        `[backend ←] App.${key} → ${JSON.stringify(summarizeArg(result))} (${(performance.now() - started).toFixed(1)}ms)`,
      );
      return result;
    };
    (traced as unknown as { __mervTraced?: boolean }).__mervTraced = true;
    app[key] = traced;
    wrapped += 1;
  }

  console.log(`[backend] tracing installed on ${wrapped} App methods`);
}
