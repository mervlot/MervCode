# Feature Matrix

Roadmap and current feature parity for the main IDE systems. Update this whenever a feature changes status.

## Editor and shell

| Feature | Status | Notes |
| --- | --- | --- |
| File explorer | Done | Backend `ReadDir`, file watcher integration. |
| File tabs | Done | Draggable tabs, context menu, dirty indicators. |
| Monaco editor host | Done | Per-file models and active-tab feature lifecycle. |
| Syntax highlighting | Done | Monaco language detection/registry. |
| Settings panel | Done | Schema-driven controls, search, reset defaults. |
| Persistent settings | Done | `mervcode:editorSettings`, deep-merged defaults. |
| Workspace restore | Partial | Restores root/tabs/active path; not cursor/scroll/splits/terminal layout history. |
| Theme persistence | Done | `mervcode:theme`. |
| Command palette | Done | IDE commands and shortcuts. |
| Git panel/status | Partial | Basic status integration. |
| Search panel | Partial | File/content search with limits. |
| Image/PDF/media viewers | Partial | Category-specific viewers exist. |

## LSP protocol features

| Feature | Status | Notes |
| --- | --- | --- |
| Hover | Done | Capability-gated, cancellable, active-document routed. |
| Completion | Done | Capability-gated, cancellable, trigger-character support. |
| Definition | Done | Monaco definition provider. |
| References | Done | Monaco references provider. |
| Diagnostics | Done | `publishDiagnostics` -> Monaco markers. |
| Incremental document sync | Done | Falls back to full sync when required. |
| Capability negotiation | Done | Parsed in `capabilities.ts`. |
| Request cancellation | Done | `$/cancelRequest`, stale cancellation responses handled. |
| Request scheduling | Done | Priority queue with concurrency cap. |
| Crash recovery | Done | Backoff reconnect, disabled after repeated failures. |
| Multi-root resolution | Done | Per-file nearest project marker. |
| Active-tab lifecycle | Done | Hidden tabs do not spawn duplicate LSP/lint sessions. |
| Completion resolve | Todo | Needed for lazy completion details/docs. |
| Signature help | Todo | Add Monaco signature provider. |
| Rename | Todo | Needs `WorkspaceEdit` application. |
| Code actions | Todo | Needs command/workspace edit execution. |
| Semantic tokens | Todo | Need token legend/delta decode + theme mapping. |
| Inlay hints provider | Todo | Monaco provider integration needed. |
| Folding range provider | Todo | Monaco currently uses built-in folding. |
| Document symbols | Todo | Needed for outline/breadcrumbs. |
| Workspace symbols | Todo | Needs index/provider. |
| Dynamic capability registration | Todo | Currently acknowledged generically only. |
| Progress UI | Todo | No UI for `$/progress` yet. |

## Language support

| Language | LSP | Formatter | Linter | Status |
| --- | --- | --- | --- | --- |
| Go | `gopls` | `gofmt` | `golangci-lint` | Supported |
| TypeScript | `typescript-language-server` | Prettier | ESLint | Supported |
| TSX | `typescript-language-server` | Prettier | ESLint | Supported |
| JavaScript | `typescript-language-server` | Prettier | ESLint | Supported |
| JSX | `typescript-language-server` | Prettier | ESLint | Supported |
| Java | bundled JDTLS | google-java-format | Checkstyle | Supported |
| Kotlin | bundled Kotlin LSP | ktfmt | ktlint | Supported |

## Terminal

| Feature | Status | Notes |
| --- | --- | --- |
| Integrated terminal panel | Done | xterm frontend + ConPTY backend. |
| Multiple terminal tabs | Done | Each tab has a backend session id. |
| Shell selection | Done | Default shell setting for new tabs. |
| Resize handling | Done | xterm fit addon + backend resize. |
| Structured exit events | Done | `terminal:exit:<id>` includes exit code. |
| Post-exit input handling | Done | Ignored/no-op to avoid race crashes. |
| Terminal settings | Done | Font, blink, scrollback, panel height. |
| Persistent terminal sessions | Todo | Sessions do not survive app restart. |
| Non-Windows PTY | Todo | Current backend uses Windows ConPTY. |

## Settings

| Feature | Status | Notes |
| --- | --- | --- |
| Schema-driven settings UI | Done | `settingsSchema.ts`. |
| Search settings | Done | Searches labels/descriptions/keywords. |
| Reset defaults | Done | Settings panel button. |
| Deep merge defaults | Done | New nested settings appear for old users. |
| Monaco option mapping | Done | `toMonacoOptions.ts`, `toModelOptions`. |
| Auto-save modes | Done | Off, afterDelay, focus change, window change. |
| Isolated terminal settings | Done | Terminal settings do not alter Monaco. |
| Per-language settings | Todo | No language-specific settings layer yet. |
| Settings export/import | Todo | Not implemented. |

## Developer tooling

| Feature | Status | Notes |
| --- | --- | --- |
| LSP Inspector | Done | Servers, docs, capabilities, requests, notifications, diagnostics, perf, logs. |
| Backend call tracing | Done | `frontend/src/lib/backendLog.ts`. |
| Protocol traffic logs | Done | Request/response/notification JSON summarized. |
| Tool availability prompts | Done | `CheckLanguageTools`, `ToolchainPrompt`. |
| Automatic tool install | Partial | Configured where reliable; manual hints otherwise. |
| Mock LSP tests | Todo | Not implemented. |
| E2E desktop tests | Todo | Not implemented. |

## Priority roadmap

1. Signature help.
2. Completion resolve.
3. Workspace edit application for rename/code actions.
4. Document symbols and outline UI.
5. Semantic token application.
6. Progress UI for Java/Kotlin/TypeScript indexing.
7. Per-language settings.
8. Terminal session persistence.
