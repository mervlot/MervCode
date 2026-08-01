import type { JSONValue } from "./protocol";

// ============================================================================
// In-memory, ring-buffered log of everything the LSP client does: requests
// (with timing), notifications, server stderr lines, and connection
// lifecycle events. This exists so debugging the client is "open the
// Developer > LSP Inspector panel" instead of sprinkling console.log
// through hover/completion/definition handlers.
//
// Kept dependency-free and framework-agnostic (plain subscribe/notify) so
// both the LSP internals and the React Inspector panel can use it without
// coupling either to the other.
// ============================================================================

export type LogSeverity = "debug" | "info" | "warn" | "error";

export type RequestStatus =
  "pending" | "resolved" | "error" | "cancelled" | "timed-out";

export interface RequestLogEntry {
  kind: "request";
  seq: number;
  connectionId: string;
  lang: string;
  method: string;
  params: JSONValue;
  result?: JSONValue;
  errorMessage?: string | undefined;
  status: RequestStatus;
  priority: string;
  startedAt: number;
  durationMs?: number;
}

export interface NotificationLogEntry {
  kind: "notification";
  seq: number;
  connectionId: string;
  lang: string;
  direction: "outgoing" | "incoming";
  method: string;
  params: JSONValue;
  time: number;
}

export interface ServerLogEntry {
  kind: "server-log";
  seq: number;
  connectionId: string;
  lang: string;
  line: string;
  time: number;
}

export interface LifecycleLogEntry {
  kind: "lifecycle";
  seq: number;
  connectionId: string;
  lang: string;
  root: string;
  event: string;
  detail?: string | undefined;
  severity: LogSeverity;
  time: number;
}

export type LogEntry =
  RequestLogEntry | NotificationLogEntry | ServerLogEntry | LifecycleLogEntry;

const MAX_ENTRIES = 1000;

type Listener = () => void;

class LspLogger {
  private entries: LogEntry[] = [];
  private listeners = new Set<Listener>();
  private seq = 0;
  private requestIndex = new Map<string, RequestLogEntry>(); // `${connectionId}:${requestSeq}`

  private push(entry: LogEntry) {
    this.entries.push(entry);
    if (this.entries.length > MAX_ENTRIES) {
      this.entries.splice(0, this.entries.length - MAX_ENTRIES);
    }
    this.notify();
  }

  private notify() {
    this.listeners.forEach((fn) => fn());
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  getEntries(): readonly LogEntry[] {
    return this.entries;
  }

  clear() {
    this.entries = [];
    this.requestIndex.clear();
    this.notify();
  }

  /** Records a new outgoing request; returns its log key for later updates. */
  beginRequest(
    connectionId: string,
    lang: string,
    method: string,
    params: JSONValue,
    priority: string,
  ): string {
    const seq = ++this.seq;
    const key = `${connectionId}:${seq}`;
    const entry: RequestLogEntry = {
      kind: "request",
      seq,
      connectionId,
      lang,
      method,
      params,
      priority,
      status: "pending",
      startedAt: Date.now(),
    };
    this.requestIndex.set(key, entry);
    this.push(entry);
    return key;
  }

  endRequest(
    key: string,
    status: RequestStatus,
    result?: JSONValue,
    errorMessage?: string,
  ) {
    const entry = this.requestIndex.get(key);
    if (!entry) return;
    entry.status = status;
    entry.result = result;
    entry.errorMessage = errorMessage;
    entry.durationMs = Date.now() - entry.startedAt;
    this.notify();
  }

  notification(
    connectionId: string,
    lang: string,
    direction: "outgoing" | "incoming",
    method: string,
    params: JSONValue,
  ) {
    this.push({
      kind: "notification",
      seq: ++this.seq,
      connectionId,
      lang,
      direction,
      method,
      params,
      time: Date.now(),
    });
  }

  serverLog(connectionId: string, lang: string, line: string, time?: number) {
    this.push({
      kind: "server-log",
      seq: ++this.seq,
      connectionId,
      lang,
      line,
      time: time ?? Date.now(),
    });
  }

  lifecycle(
    connectionId: string,
    lang: string,
    root: string,
    event: string,
    severity: LogSeverity = "info",
    detail?: string,
  ) {
    this.push({
      kind: "lifecycle",
      seq: ++this.seq,
      connectionId,
      lang,
      root,
      event,
      detail,
      severity,
      time: Date.now(),
    });
  }
}

/** Singleton - every LSPConnection and the Inspector panel share this log. */
export const lspLogger = new LspLogger();

/** Rolling per-method latency stats, derived from the request log, for the
 * Inspector's Performance tab. */
export function computeMethodStats(entries: readonly LogEntry[]) {
  const stats = new Map<
    string,
    {
      count: number;
      totalMs: number;
      maxMs: number;
      errors: number;
      cancelled: number;
    }
  >();

  for (const entry of entries) {
    if (entry.kind !== "request" || entry.durationMs === undefined) continue;
    const s = stats.get(entry.method) ?? {
      count: 0,
      totalMs: 0,
      maxMs: 0,
      errors: 0,
      cancelled: 0,
    };
    s.count += 1;
    s.totalMs += entry.durationMs;
    s.maxMs = Math.max(s.maxMs, entry.durationMs);
    if (entry.status === "error" || entry.status === "timed-out") s.errors += 1;
    if (entry.status === "cancelled") s.cancelled += 1;
    stats.set(entry.method, s);
  }

  return Array.from(stats.entries()).map(([method, s]) => ({
    method,
    count: s.count,
    avgMs: s.count ? Math.round((s.totalMs / s.count) * 10) / 10 : 0,
    maxMs: s.maxMs,
    errors: s.errors,
    cancelled: s.cancelled,
  }));
}
