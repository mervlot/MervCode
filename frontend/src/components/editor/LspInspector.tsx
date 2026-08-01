import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ListLSPServers, KillLSPServer } from "../../../wailsjs/go/main/App";
import { EventsOn } from "../../../wailsjs/runtime/runtime";
import type { ConnectionSnapshot } from "../../editor/lsp/connection";
import {
  getConnectionByKey,
  listConnectionSnapshots,
} from "../../editor/lsp/connectionRegistry";
import {
  computeMethodStats,
  lspLogger,
  type LogEntry,
  type NotificationLogEntry,
  type RequestLogEntry,
} from "../../editor/lsp/logger";

// ============================================================================
// Developer > LSP Inspector - a hidden diagnostics panel for the LSP
// client itself: running servers, open documents, negotiated capabilities,
// every request/notification with timing, and raw server logs. Exists so
// debugging the client is "open this panel" instead of grepping through
// console.log output scattered across hover/completion/definition
// handlers.
// ============================================================================

interface GoLSPServerInfo {
  id: string;
  lang: string;
  root: string;
  command: string;
  pid: number;
  startedAt: string;
  status: string;
}

type Section =
  | "servers"
  | "documents"
  | "capabilities"
  | "requests"
  | "notifications"
  | "diagnostics"
  | "performance"
  | "logs";

const SECTIONS: { id: Section; label: string; icon: string }[] = [
  { id: "servers", label: "Running LSPs", icon: "hdd-network" },
  { id: "documents", label: "Open Documents", icon: "file-earmark-text" },
  { id: "capabilities", label: "Capabilities", icon: "list-check" },
  { id: "requests", label: "Requests", icon: "arrow-left-right" },
  { id: "notifications", label: "Notifications", icon: "bell" },
  { id: "diagnostics", label: "Diagnostics", icon: "exclamation-triangle" },
  { id: "performance", label: "Performance", icon: "speedometer2" },
  { id: "logs", label: "Logs", icon: "terminal" },
];

export default function LspInspector({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [section, setSection] = useState<Section>("servers");
  const [servers, setServers] = useState<GoLSPServerInfo[]>([]);
  const [connections, setConnections] = useState<ConnectionSnapshot[]>([]);

  const entries = useSyncExternalStore(
    (cb) => lspLogger.subscribe(cb),
    () => lspLogger.getEntries(),
  );

  // Lightweight poll for backend process + connection state while open -
  // simpler and just as effective as another bespoke pub/sub channel for
  // a panel that's only ever open while a developer is looking at it.
  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    const refresh = () => {
      ListLSPServers()
        .then(
          (list) =>
            !cancelled &&
            setServers((list ?? []) as unknown as GoLSPServerInfo[]),
        )
        .catch(() => undefined);
      setConnections(listConnectionSnapshots());
    };

    refresh();
    const interval = setInterval(refresh, 1000);
    const unsubStart = EventsOn("lsp:serverStarted", refresh);
    const unsubStop = EventsOn("lsp:serverStopped", refresh);
    return () => {
      cancelled = true;
      clearInterval(interval);
      unsubStart();
      unsubStop();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-[85vh] w-[92vw] max-w-6xl overflow-hidden rounded-lg border border-subtle-strong bg-surface shadow-app"
      >
        <nav className="flex w-52 shrink-0 flex-col border-r border-subtle bg-panel py-2">
          <div className="px-3 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-wider text-faint">
            Developer
          </div>
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={`mx-1.5 flex items-center gap-2 rounded px-2.5 py-1.5 text-left text-[12.5px] transition-colors ${
                section === s.id
                  ? "bg-accent-soft text-primary"
                  : "text-secondary hover:bg-hover hover:text-primary"
              }`}
            >
              <i className={`bi bi-${s.icon} w-4 text-center text-[13px]`} />
              {s.label}
            </button>
          ))}
          <div className="mt-auto px-3 pt-2 text-[10.5px] text-faint">
            {connections.length} connection{connections.length === 1 ? "" : "s"}{" "}
            · {servers.filter((s) => s.status === "running").length} running
          </div>
        </nav>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-10 shrink-0 items-center justify-between border-b border-subtle px-3">
            <span className="text-[13px] font-medium text-primary">
              {SECTIONS.find((s) => s.id === section)?.label}
            </span>
            <button
              onClick={onClose}
              className="flex h-6 w-6 items-center justify-center rounded text-tertiary hover:bg-hover hover:text-primary"
            >
              <i className="bi bi-x-lg text-[12px]" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden">
            {section === "servers" && (
              <ServersSection servers={servers} connections={connections} />
            )}
            {section === "documents" && (
              <DocumentsSection connections={connections} />
            )}
            {section === "capabilities" && (
              <CapabilitiesSection connections={connections} />
            )}
            {section === "requests" && (
              <RequestListSection
                entries={entries.filter(
                  (e): e is RequestLogEntry => e.kind === "request",
                )}
              />
            )}
            {section === "notifications" && (
              <NotificationListSection
                entries={entries.filter(
                  (e): e is NotificationLogEntry =>
                    e.kind === "notification" &&
                    e.method !== "textDocument/publishDiagnostics",
                )}
              />
            )}
            {section === "diagnostics" && (
              <NotificationListSection
                entries={entries.filter(
                  (e): e is NotificationLogEntry =>
                    e.kind === "notification" &&
                    e.method === "textDocument/publishDiagnostics",
                )}
              />
            )}
            {section === "performance" && (
              <PerformanceSection entries={entries} />
            )}
            {section === "logs" && <LogsSection entries={entries} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === "ready" || status === "running"
      ? "var(--success)"
      : status === "connecting" || status === "reconnecting"
        ? "var(--warning)"
        : status === "stopped" || status === "closed"
          ? "var(--text-faint)"
          : "var(--danger)"; // disabled, crashed, error
  return (
    <span
      className="inline-block h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: color }}
      title={status}
    />
  );
}

function ServersSection({
  servers,
  connections,
}: {
  servers: GoLSPServerInfo[];
  connections: ConnectionSnapshot[];
}) {
  if (servers.length === 0 && connections.length === 0) {
    return (
      <EmptyState
        icon="hdd-network"
        text="No language servers have been started yet."
      />
    );
  }

  // Join Go's process-level view with the frontend connection's protocol
  // view via the WebSocket session token both sides know as "id".
  const rows = connections.map((conn) => ({
    conn,
    server: servers.find((s) => s.id === conn.sessionId),
  }));

  return (
    <div className="h-full overflow-auto p-3">
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="border-b border-subtle text-left text-[10.5px] uppercase tracking-wider text-faint">
            <th className="py-1.5 pr-3 font-medium">Status</th>
            <th className="py-1.5 pr-3 font-medium">Language</th>
            <th className="py-1.5 pr-3 font-medium">Root</th>
            <th className="py-1.5 pr-3 font-medium">PID</th>
            <th className="py-1.5 pr-3 font-medium">Restarts</th>
            <th className="py-1.5 pr-3 font-medium">Started</th>
            <th className="py-1.5 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ conn, server }) => (
            <tr key={conn.key} className="border-b border-subtle/60">
              <td className="py-1.5 pr-3">
                <div className="flex items-center gap-1.5">
                  <StatusDot status={conn.status} />
                  <span className="text-secondary">{conn.status}</span>
                </div>
              </td>
              <td className="py-1.5 pr-3 text-primary">{conn.lang}</td>
              <td
                className="max-w-72 truncate py-1.5 pr-3 text-tertiary"
                title={conn.root}
              >
                {conn.root || "(no workspace)"}
              </td>
              <td className="py-1.5 pr-3 text-tertiary">
                {server?.pid ?? "-"}
              </td>
              <td className="py-1.5 pr-3 text-tertiary">{conn.restartCount}</td>
              <td className="py-1.5 pr-3 text-tertiary">
                {server ? new Date(server.startedAt).toLocaleTimeString() : "-"}
              </td>
              <td className="py-1.5">
                <div className="flex gap-1.5">
                  {conn.status === "disabled" ? (
                    <button
                      onClick={() => getConnectionByKey(conn.key)?.reconnect()}
                      className="rounded border border-subtle-strong px-2 py-0.5 text-[11px] text-secondary hover:bg-hover"
                    >
                      Restart
                    </button>
                  ) : server ? (
                    <button
                      onClick={() => void KillLSPServer(server.id)}
                      className="rounded border border-subtle-strong px-2 py-0.5 text-[11px] text-secondary hover:bg-hover"
                    >
                      Kill
                    </button>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DocumentsSection({
  connections,
}: {
  connections: ConnectionSnapshot[];
}) {
  const docs = connections.flatMap((conn) =>
    conn.openDocuments.map((uri) => ({ uri, conn })),
  );
  if (docs.length === 0) {
    return (
      <EmptyState
        icon="file-earmark-text"
        text="No documents are open on any LSP connection."
      />
    );
  }
  return (
    <div className="h-full overflow-auto p-3 text-[12px]">
      {docs.map(({ uri, conn }) => (
        <div
          key={`${conn.key}:${uri}`}
          className="flex items-center gap-2 border-b border-subtle/60 py-1.5"
        >
          <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[10.5px] text-accent">
            {conn.lang}
          </span>
          <span className="truncate text-secondary" title={uri}>
            {decodeURIComponent(uri.replace(/^file:\/\//, ""))}
          </span>
        </div>
      ))}
    </div>
  );
}

function CapabilitiesSection({
  connections,
}: {
  connections: ConnectionSnapshot[];
}) {
  if (connections.length === 0) {
    return (
      <EmptyState
        icon="list-check"
        text="No connections have negotiated capabilities yet."
      />
    );
  }
  return (
    <div className="h-full space-y-3 overflow-auto p-3">
      {connections.map((conn) => (
        <div key={conn.key} className="rounded border border-subtle p-2.5">
          <div className="mb-1.5 flex items-center gap-2 text-[12px] font-medium text-primary">
            <StatusDot status={conn.status} />
            {conn.lang} <span className="text-faint">·</span>{" "}
            <span className="text-tertiary">
              {conn.root || "(no workspace)"}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            {(
              [
                ["Hover", conn.capabilities.hover],
                ["Completion", conn.capabilities.completion],
                ["Completion Resolve", conn.capabilities.completionResolve],
                ["Definition", conn.capabilities.definition],
                ["References", conn.capabilities.references],
              ] as const
            ).map(([label, supported]) => (
              <span
                key={label}
                className={`rounded px-1.5 py-0.5 ${
                  supported
                    ? "bg-accent-soft text-accent"
                    : "bg-hover text-faint line-through"
                }`}
              >
                {label}
              </span>
            ))}
            <span className="rounded bg-hover px-1.5 py-0.5 text-tertiary">
              sync:{" "}
              {["none", "full", "incremental"][conn.capabilities.syncKind] ??
                "unknown"}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function RequestListSection({ entries }: { entries: RequestLogEntry[] }) {
  const [selected, setSelected] = useState<RequestLogEntry | null>(null);
  const ordered = useMemo(() => [...entries].reverse(), [entries]);
  const active =
    (selected && ordered.find((e) => e.seq === selected.seq)) ??
    ordered[0] ??
    null;

  if (ordered.length === 0) {
    return (
      <EmptyState
        icon="arrow-left-right"
        text="No LSP requests have been sent yet."
      />
    );
  }

  return (
    <div className="flex h-full min-h-0">
      <div className="w-80 shrink-0 overflow-auto border-r border-subtle">
        {ordered.map((entry) => (
          <button
            key={entry.seq}
            onClick={() => setSelected(entry)}
            className={`flex w-full flex-col gap-0.5 border-b border-subtle/60 px-2.5 py-1.5 text-left text-[11.5px] ${
              active?.seq === entry.seq ? "bg-accent-soft" : "hover:bg-hover"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-primary">{entry.method}</span>
              <StatusBadge status={entry.status} />
            </div>
            <div className="flex items-center gap-1.5 text-[10.5px] text-faint">
              <span>{entry.lang}</span>
              <span>·</span>
              <span>{entry.priority}</span>
              {entry.durationMs !== undefined && (
                <>
                  <span>·</span>
                  <span>{entry.durationMs}ms</span>
                </>
              )}
            </div>
          </button>
        ))}
      </div>
      <div className="min-w-0 flex-1 overflow-auto p-3">
        {active ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="text-[13px] font-medium text-primary">
                {active.method}
              </h3>
              <StatusBadge status={active.status} />
            </div>
            <JsonBlock label="Request" value={active.params} />
            {active.status === "resolved" && (
              <JsonBlock label="Response" value={active.result} />
            )}
            {active.errorMessage && (
              <JsonBlock label="Error" value={active.errorMessage} />
            )}
          </div>
        ) : (
          <EmptyState
            icon="arrow-left-right"
            text="Select a request to inspect it."
          />
        )}
      </div>
    </div>
  );
}

function NotificationListSection({
  entries,
}: {
  entries: NotificationLogEntry[];
}) {
  const [selected, setSelected] = useState<NotificationLogEntry | null>(null);
  const ordered = useMemo(() => [...entries].reverse(), [entries]);
  const active =
    (selected && ordered.find((e) => e.seq === selected.seq)) ??
    ordered[0] ??
    null;

  if (ordered.length === 0) {
    return <EmptyState icon="bell" text="No notifications recorded yet." />;
  }

  return (
    <div className="flex h-full min-h-0">
      <div className="w-80 shrink-0 overflow-auto border-r border-subtle">
        {ordered.map((entry) => (
          <button
            key={entry.seq}
            onClick={() => setSelected(entry)}
            className={`flex w-full flex-col gap-0.5 border-b border-subtle/60 px-2.5 py-1.5 text-left text-[11.5px] ${
              active?.seq === entry.seq ? "bg-accent-soft" : "hover:bg-hover"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-primary">{entry.method}</span>
              <i
                className={`bi bi-${entry.direction === "outgoing" ? "arrow-up-right" : "arrow-down-left"} text-[11px] text-faint`}
              />
            </div>
            <div className="text-[10.5px] text-faint">
              {entry.lang} · {new Date(entry.time).toLocaleTimeString()}
            </div>
          </button>
        ))}
      </div>
      <div className="min-w-0 flex-1 overflow-auto p-3">
        {active ? (
          <JsonBlock
            label={`${active.direction === "outgoing" ? "Sent" : "Received"}: ${active.method}`}
            value={active.params}
          />
        ) : (
          <EmptyState icon="bell" text="Select a notification to inspect it." />
        )}
      </div>
    </div>
  );
}

function PerformanceSection({ entries }: { entries: readonly LogEntry[] }) {
  const stats = useMemo(() => computeMethodStats(entries), [entries]);
  if (stats.length === 0) {
    return (
      <EmptyState
        icon="speedometer2"
        text="No timed requests yet - use the editor to generate some."
      />
    );
  }
  return (
    <div className="h-full overflow-auto p-3">
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="border-b border-subtle text-left text-[10.5px] uppercase tracking-wider text-faint">
            <th className="py-1.5 pr-3 font-medium">Method</th>
            <th className="py-1.5 pr-3 font-medium">Count</th>
            <th className="py-1.5 pr-3 font-medium">Avg</th>
            <th className="py-1.5 pr-3 font-medium">Max</th>
            <th className="py-1.5 pr-3 font-medium">Errors</th>
            <th className="py-1.5 font-medium">Cancelled</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s) => (
            <tr key={s.method} className="border-b border-subtle/60">
              <td className="py-1.5 pr-3 text-primary">{s.method}</td>
              <td className="py-1.5 pr-3 text-tertiary">{s.count}</td>
              <td className="py-1.5 pr-3 text-tertiary">{s.avgMs}ms</td>
              <td className="py-1.5 pr-3 text-tertiary">{s.maxMs}ms</td>
              <td
                className={`py-1.5 pr-3 ${s.errors ? "text-(--danger)" : "text-tertiary"}`}
              >
                {s.errors}
              </td>
              <td className="py-1.5 text-tertiary">{s.cancelled}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LogsSection({ entries }: { entries: readonly LogEntry[] }) {
  const logs = useMemo(
    () =>
      entries
        .filter(
          (e): e is LogEntry & { kind: "server-log" | "lifecycle" } =>
            e.kind === "server-log" || e.kind === "lifecycle",
        )
        .slice()
        .reverse(),
    [entries],
  );

  if (logs.length === 0) {
    return <EmptyState icon="terminal" text="No server logs yet." />;
  }

  return (
    <div className="h-full overflow-auto p-3 font-mono text-[11.5px]">
      {logs.map((entry) => {
        const severity = entry.kind === "lifecycle" ? entry.severity : "debug";
        const color =
          severity === "error"
            ? "var(--danger)"
            : severity === "warn"
              ? "var(--warning)"
              : "var(--text-tertiary)";
        const time =
          entry.kind === "lifecycle"
            ? new Date(entry.time).toLocaleTimeString()
            : new Date(entry.time).toLocaleTimeString();
        return (
          <div
            key={entry.seq}
            className="border-l-2 py-0.5 pl-2"
            style={{ borderColor: color }}
          >
            <span className="text-faint">{time}</span>{" "}
            <span className="text-accent">[{entry.lang}]</span>{" "}
            {entry.kind === "lifecycle" ? (
              <span style={{ color }}>
                {entry.event}
                {entry.detail ? ` - ${entry.detail}` : ""}
              </span>
            ) : (
              <span className="text-secondary">{entry.line}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "resolved"
      ? "var(--success)"
      : status === "pending"
        ? "var(--warning)"
        : status === "cancelled"
          ? "var(--text-faint)"
          : "var(--danger)"; // error, timed-out
  return (
    <span
      className="shrink-0 rounded px-1.5 py-0.5 text-[10px]"
      style={{
        color,
        backgroundColor: "color-mix(in srgb, currentColor 14%, transparent)",
      }}
    >
      {status}
    </span>
  );
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wider text-faint">
        {label}
      </div>
      <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-all rounded border border-subtle bg-panel-alt p-2.5 font-mono text-[11px] text-secondary">
        {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-tertiary">
      <i className={`bi bi-${icon} text-[24px] text-faint`} />
      <p className="text-[12px]">{text}</p>
    </div>
  );
}
