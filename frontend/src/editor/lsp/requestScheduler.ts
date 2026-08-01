// ============================================================================
// Client-side priority scheduler for outgoing LSP requests.
//
// Two problems this solves:
//  1. Interactive requests (hover/completion) must never sit behind a slow
//     bulk request (formatting, workspace symbols) that happened to be
//     fired a moment earlier - they're reordered by priority, not FIFO.
//  2. Some servers get slow or unstable when flooded with too many
//     concurrent requests. A concurrency cap queues the overflow instead
//     of firing everything at once.
//
// This only governs *when* a request's underlying work function runs, not
// the JSON-RPC framing itself - see connection.ts for that.
// ============================================================================

export type RequestPriority = "interactive" | "navigation" | "bulk";

const PRIORITY_RANK: Record<RequestPriority, number> = {
  interactive: 0,
  navigation: 1,
  bulk: 2,
};

interface QueueItem {
  priority: RequestPriority;
  enqueuedAt: number;
  run: () => void;
  cancelled: boolean;
}

export class RequestScheduler {
  private queue: QueueItem[] = [];
  private active = 0;

  constructor(private readonly maxConcurrent = 6) {}

  /**
   * Schedules `task` to run once fewer than maxConcurrent requests are
   * in-flight, ordered by priority (ties broken by arrival order).
   * Returns the task's result promise plus a `cancelQueued` function that,
   * if called before the task starts running, prevents it from running at
   * all (used when a caller cancels a request that's still waiting behind
   * others).
   */
  schedule<T>(
    priority: RequestPriority,
    task: () => Promise<T>,
  ): { result: Promise<T>; cancelQueued: () => boolean } {
    let item: QueueItem;
    const result = new Promise<T>((resolve, reject) => {
      item = {
        priority,
        enqueuedAt: performance.now(),
        cancelled: false,
        run: () => {
          this.active++;
          task()
            .then(resolve, reject)
            .finally(() => {
              this.active--;
              this.drain();
            });
        },
      };
      this.queue.push(item);
      this.queue.sort(
        (a, b) =>
          PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
          a.enqueuedAt - b.enqueuedAt,
      );
      this.drain();
    });

    return {
      result,
      cancelQueued: () => {
        const idx = this.queue.indexOf(item);
        if (idx === -1) return false;
        this.queue.splice(idx, 1);
        item.cancelled = true;
        return true;
      },
    };
  }

  private drain() {
    while (this.active < this.maxConcurrent && this.queue.length > 0) {
      const next = this.queue.shift();
      if (next && !next.cancelled) next.run();
    }
  }

  get pendingCount(): number {
    return this.queue.length;
  }

  get activeCount(): number {
    return this.active;
  }
}

/** Static priority for each well-known LSP method; anything unlisted
 * defaults to "navigation". Kept here (not scattered at call sites) so the
 * whole ordering policy is visible in one place. */
export function priorityForMethod(method: string): RequestPriority {
  switch (method) {
    case "textDocument/hover":
    case "textDocument/completion":
    case "completionItem/resolve":
    case "textDocument/signatureHelp":
      return "interactive";
    case "textDocument/formatting":
    case "textDocument/rangeFormatting":
    case "textDocument/codeAction":
    case "workspace/symbol":
    case "textDocument/documentSymbol":
      return "bulk";
    default:
      return "navigation";
  }
}
