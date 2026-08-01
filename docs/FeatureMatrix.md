# Feature Matrix: MervCode vs. VS Code

Tracks LSP/editor feature parity. Update this when a feature moves state -
it's the roadmap.

## LSP protocol features

| Feature                     | VS Code | MervCode | Status  | Notes |
| ---------------------------- | :-----: | :------: | ------- | ----- |
| Hover                        | ✅ | ✅ | Done    | Capability-gated, cancellable, superseded on retype |
| Completion                   | ✅ | ✅ | Done    | Capability-gated, cancellable, superseded on retype |
| Completion Resolve           | ✅ | ❌ | Todo    | Items are used as returned; no lazy detail fetch on highlight |
| Definition                   | ✅ | ✅ | Done    | |
| References                   | ✅ | ✅ | Done    | |
| Diagnostics (publish)        | ✅ | ✅ | Done    | Rendered as Monaco markers; visible in Inspector |
| Document sync                | ✅ | ✅ | Done    | Incremental when the server supports it, full-text fallback otherwise |
| Capability negotiation       | ✅ | ✅ | Done    | Providers no longer fire requests a server never declared support for |
| Cancellation (`$/cancelRequest`) | ✅ | ✅ | Done | Wired to Monaco's `CancellationToken` + same-kind request supersession |
| Request prioritization        | ✅ | ✅ | Done    | interactive > navigation > bulk, 6-concurrent cap per connection |
| Crash recovery / restart      | ✅ | ✅ | Done    | Backoff reconnect, replay open docs, disable + manual restart after 5 failures |
| Multi-root workspaces         | ✅ | ✅ | Done    | Per-file nearest-project resolution (`findNearestMarker`), not just multi-folder UI |
| Semantic Tokens               | ✅ | ❌ | Todo    | |
| Rename                        | ✅ | ❌ | Todo    | Needs `WorkspaceEdit` application across models |
| Code Actions                  | ✅ | ❌ | Todo    | Needs `WorkspaceEdit`/`Command` application |
| Signature Help                | ✅ | ❌ | Todo    | |
| Inlay Hints                   | ✅ | ❌ | Todo    | |
| Folding Ranges                 | ✅ | ❌ | Todo    | Monaco's indentation-based folding only, no LSP folding provider |
| Document Symbols (outline)     | ✅ | ❌ | Todo    | |
| Workspace Symbols (`Ctrl+T`)    | ✅ | ❌ | Todo    | Needs a workspace index (see below) |
| Formatting (document/range)     | ✅ | Partial | Partial | Whole-document formatting via external formatter binary (`gofmt`, etc.), not LSP `textDocument/formatting`; no range/on-type formatting |
| Snippets in completions         | ✅ | ❌ | Todo    | `insertTextFormat: Snippet` not parsed |
| Dynamic capability registration | ✅ | ❌ | Todo    | `client/registerCapability` acknowledged generically, not acted on |
| Progress (`$/progress`)          | ✅ | ❌ | Todo    | No UI for long-running server work (indexing, etc.) |

## Developer/platform features

| Feature                       | VS Code | MervCode | Status  | Notes |
| ------------------------------- | :-----: | :------: | ------- | ----- |
| LSP Inspector / dev tools panel | ✅ | ✅ | Done | Servers, documents, capabilities, requests, notifications, diagnostics, performance, logs |
| Performance metrics             | ✅ | ✅ | Done | Per-method count/avg/max/error/cancel, in the Inspector's Performance tab |
| Local telemetry                  | ✅ | Partial | Partial | Covered by the Inspector; no persisted history across restarts |
| Language profiles                | ✅ | Partial | Partial | `toolchain.go` + `InitializationOptions`/`Env`; no standalone `registerProfile()` API yet |
| Transport abstraction (TCP/pipe) | ✅ | ❌ | Todo | `Transport` interface exists; only `WebSocketTransport` implemented |
| Plugin API                        | ✅ | ❌ | Todo | Languages/commands are still registered by editing source, not a runtime registry |
| Workspace index (files/symbols)   | ✅ | ❌ | Todo | `Ctrl+P` uses the file tree; no fuzzy symbol index |
| Background job manager             | ✅ | ❌ | Todo | LSP requests are scheduled (`RequestScheduler`); indexing/git/search are not unified |
| File cache layer                   | ✅ | ❌ | Todo | Reads go straight to disk |
| Session persistence (full)          | ✅ | Partial | Partial | Tabs/active file/root path persist; cursor/scroll/folding/splits/terminal don't |
| Test infra (mock LSP servers)        | ✅ | ❌ | Todo | |
| Architecture docs                    | ✅ | ✅ | Done | `docs/LSP-Architecture.md` |

## Priority order for the next pass

1. **Completion Resolve** - cheap, high-value, unblocks richer completion
   docs without slowing down the initial list.
2. **Signature Help** - small, high perceived-quality win, same provider
   pattern as hover.
3. **Rename** + **Code Actions** - share the same `WorkspaceEdit`
   application code, worth doing together.
4. **Document Symbols** (outline/breadcrumbs) as a stepping stone to
   **Workspace Symbols**, which then justifies a real workspace index.
5. **Semantic Tokens** - highest visual impact, but the most work (token
   legend negotiation, delta decoding, theme mapping).
