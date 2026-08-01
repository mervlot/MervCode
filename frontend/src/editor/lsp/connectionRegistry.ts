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

export function getConnection(lang: string, root: string): LSPConnection {
  const key = `${lang}::${root}`;
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

/**
 * Resolves the nearest project root that owns filePath for the given
 * language (see workspace.go's findNearestMarker), falling back to the
 * workspace's opened folder - and to filePath's own directory - if the Go
 * call fails for any reason. This is what turns a single opened folder
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
    return fallbackRoot ?? "";
  }
}
