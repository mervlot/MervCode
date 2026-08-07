import { ResolveProjectRoot } from "../../../wailsjs/go/main/App";
import { LSPConnection, type ConnectionSnapshot } from "./connection";

// ============================================================================
// One LSPConnection per (language, resolved project root) - shared by every
// open file that belongs to that project, exactly like a real language
// server process. Kept as a tiny module-level cache (as it was before the
// lsp/ split) rather than a class, since the whole app only ever needs one
// registry.
// ============================================================================

const connections = new Map<string, LSPConnection>();
const idleTimers = new Map<string, ReturnType<typeof setTimeout>>();
const IDLE_DISPOSE_MS = 120_000;

export function getConnection(lang: string, root: string): LSPConnection {
  const key = `${lang}::${root}`;
  const idleTimer = idleTimers.get(key);
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimers.delete(key);
  }

  let conn = connections.get(key);
  if (!conn) {
    conn = new LSPConnection(lang, root);
    connections.set(key, conn);
  }
  return conn;
}

export function getConnectionByKey(key: string): LSPConnection | undefined {
  return connections.get(key);
}

export function listConnectionSnapshots(): ConnectionSnapshot[] {
  return Array.from(connections.values()).map((conn) => conn.snapshot());
}

export function releaseConnectionWhenIdle(conn: LSPConnection): void {
  const key = conn.connectionId;
  if (idleTimers.has(key)) return;

  const timer = setTimeout(() => {
    idleTimers.delete(key);
    if (conn.snapshot().openDocuments.length > 0) return;
    conn.dispose();
    connections.delete(key);
    console.log(`[lsp] disposed idle connection ${key}`);
  }, IDLE_DISPOSE_MS);

  idleTimers.set(key, timer);
}

export function disposeAllConnections(): void {
  for (const timer of idleTimers.values()) {
    clearTimeout(timer);
  }
  idleTimers.clear();

  for (const conn of connections.values()) {
    conn.dispose();
  }
  connections.clear();
}

/**
 * Resolves the nearest project root that owns filePath for the given
 * language (see workspace.go's findNearestMarker), falling back to the
 * document URI's own directory if the Go call fails. This prevents a relative
 * workspace value such as "." from becoming an LSP process root. This is what
 * turns a single opened folder
 * into a true multi-root workspace: a Go file and a TypeScript file living
 * in different subdirectories of the same repo each resolve to (and get
 * routed to a connection keyed on) their own project root.
 */
export async function resolveProjectRoot(
  lang: string,
  filePath: string,
  fallbackRoot: string,
): Promise<string> {
  try {
    return await ResolveProjectRoot(lang, filePath, fallbackRoot ?? "");
  } catch {
    return directoryFromFilePath(filePath);
  }
}

function directoryFromFilePath(filePath: string): string {
  const separator = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
  return separator > 0 ? filePath.slice(0, separator) : "";
}
