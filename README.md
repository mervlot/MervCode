# MervCode

MervCode is a native desktop IDE built with **Wails v2**, a **Go backend**, a **React/TypeScript frontend**, and **Monaco Editor**. It is desktop-first, frameless, dark by default, and focused on practical IDE features: tabs, workspace explorer, search, Git status, integrated terminal, settings, LSP-powered editing, formatting, linting, and developer diagnostics.

> Important for contributors: do **not** run `wails dev` if an app instance is already running. It can disrupt the active desktop app. Use the validation commands below unless you intentionally want to start a fresh dev session.

## Highlights

- Native desktop app via Wails v2.
- React 18 + TypeScript frontend.
- Monaco Editor with custom language registry.
- LSP bridge over local WebSockets to stdio language servers.
- Supported language families:
  - Go
  - TypeScript / JavaScript / TSX / JSX
  - Java
  - Kotlin
- External formatters and linters wired through backend toolchains.
- Integrated xterm terminal powered by Windows ConPTY.
- Persistent workspace state, theme, and editor/terminal settings.
- Developer LSP Inspector for protocol traffic, lifecycle, diagnostics, latency, and server logs.

## Tech stack

| Layer | Technology |
| --- | --- |
| Desktop shell | Wails v2 |
| Backend | Go 1.23 |
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS 4, Bootstrap Icons, custom theme tokens |
| Animation | `motion` / `motion/react` |
| Editor | Monaco Editor |
| Terminal | `@xterm/xterm`, ConPTY backend |
| LSP transport | Frontend WebSocket -> Go bridge -> stdio language server |
| Formatting/linting | Toolchain registry in `toolchain.go` |
| Package manager | `pnpm` for Wails frontend hooks; npm scripts also work via `npm --prefix frontend ...` |
| Frontend checks | TypeScript, Biome |

## Repository layout

```text
.
├── main.go                         # Wails app entrypoint
├── func.go                         # Core file ops, search, git, watcher helpers
├── terminal.go                     # Integrated terminal backend (ConPTY)
├── lsp_bridge.go                   # WebSocket <-> stdio LSP bridge
├── toolchain.go                    # Language toolchain registry
├── toolchain_manager.go            # Tool availability/install checks
├── workspace.go                    # Per-file project-root resolution
├── typescript_lsp.go               # TypeScript server fallback tsserver path
├── eslint.go                       # ESLint parser/args integration
├── golangci-lint.go                # Go linter integration
├── checkstyle.go                   # Java linter integration
├── google_java_format.go           # Java formatter integration
├── kotlin.go                       # Kotlin LSP runtime resolver
├── ktfmt.go                        # Kotlin formatter integration
├── ktlint.go                       # Kotlin linter integration
├── docs/                           # Project documentation
├── frontend/
│   ├── package.json                # Frontend scripts/dependencies
│   ├── biome.json                  # Frontend lint/format config
│   └── src/
│       ├── pages/Home.tsx          # Main IDE layout/state composition
│       ├── pages/Editor.tsx        # Monaco editor host and feature lifecycle
│       ├── components/editor/      # Header/sidebar/tabs/settings/terminal/etc.
│       ├── hooks/                  # useTabManager/useFileOps/useEditorSettings
│       ├── editor/
│       │   ├── detectLang.ts       # File extension -> Monaco language ID
│       │   ├── languageIds.ts      # Concrete language -> backend toolchain mapping
│       │   ├── lint/               # Debounced generic linter runner
│       │   ├── lsp/                # LSP client, transport, providers, logger
│       │   └── monaco/             # Monaco setup/registry/language modules/options
│       └── lib/                    # Persistence and backend tracing helpers
├── runtime/                        # Bundled Java/Kotlin runtimes/tools
├── types/                          # Shared Go types package
└── wails.json                      # Wails config and frontend commands
```

## Development commands

Run commands from the repository root (`mervcode`) unless noted.

### Backend

```sh
go test ./...
gofmt -w <files>
```

### Frontend

Wails is configured to use `pnpm`:

```json
"frontend:install": "pnpm install",
"frontend:build": "pnpm run build",
"frontend:dev:watcher": "pnpm run dev --force"
```

Useful checks:

```sh
pnpm --dir frontend install
pnpm --dir frontend run typecheck
pnpm --dir frontend run lint
pnpm --dir frontend run build
```

Equivalent npm commands also work when pnpm is unavailable:

```sh
npm --prefix frontend run typecheck
npm --prefix frontend run lint
npm --prefix frontend run build
```

### Wails

```sh
wails build
```

Avoid `wails dev` while another app instance is running. If Go method signatures change and Wails bindings must be regenerated, run the appropriate Wails generation/build workflow intentionally and restart the app.

## Documentation

Start with:

- [`docs/ProjectOverview.md`](docs/ProjectOverview.md) - full architecture and data flow overview.
- [`docs/Tooling.md`](docs/Tooling.md) - tools, package managers, commands, external binaries.
- [`docs/LanguageSupport.md`](docs/LanguageSupport.md) - language matrix and how LSP/format/lint is wired.
- [`docs/LSP-Architecture.md`](docs/LSP-Architecture.md) - detailed protocol architecture.
- [`docs/SettingsAndTerminal.md`](docs/SettingsAndTerminal.md) - settings persistence and terminal lifecycle.
- [`docs/WorkspaceState.md`](docs/WorkspaceState.md) - localStorage workspace/theme/settings persistence.
- [`docs/Troubleshooting.md`](docs/Troubleshooting.md) - common runtime/LSP/linter problems.
- [`docs/FeatureMatrix.md`](docs/FeatureMatrix.md) - feature parity and roadmap.

## Language support summary

| Monaco IDs | Backend toolchain | LSP | Formatter | Linter |
| --- | --- | --- | --- | --- |
| `go` | `go` | `gopls` | `gofmt` | `golangci-lint` |
| `typescript`, `typescriptreact`, `javascript`, `javascriptreact` | `typescript` | `typescript-language-server` | `prettier` | `eslint` |
| `java` | `java` | bundled JDTLS | bundled/google Java Format | Checkstyle |
| `kotlin` | `kotlin` | bundled JetBrains Kotlin LSP | ktfmt | ktlint |

TS/JS/TSX/JSX intentionally keep distinct Monaco language IDs for grammar/tokenization while sharing the backend `typescript` toolchain.

## Settings persistence

- Theme: `localStorage["mervcode:theme"]`
- Editor/terminal settings: `localStorage["mervcode:editorSettings"]`
- Workspace state: `localStorage["mervcode.workspace-state"]`

Settings are defined in:

- `frontend/src/types.ts`
- `frontend/src/hooks/useEditorSettings.ts`
- `frontend/src/editor/settingsSchema.ts`
- `frontend/src/editor/monaco/toMonacoOptions.ts`
- `frontend/src/components/editor/SettingsPanel.tsx`

## LSP diagnostics/debugging

Use **Developer: Toggle LSP Inspector** (`Ctrl+Shift+L`) to inspect:

- Running server processes
- Open LSP documents
- Server capabilities
- Requests/responses
- Notifications
- Diagnostics
- Latency/error/cancel stats
- Server stderr logs

Frontend logs use prefixes such as `[lsp]`, `[lsp ↑]`, `[lsp ↓]`, `[lsp-sync]`, `[lint]`, `[monaco]`, and `[backend]`.

## Notes for contributors

- Keep changes minimal and consistent with current architecture.
- Do not start duplicate LSP servers for hidden tabs; LSP/lint features attach to active editor tabs.
- Avoid new dependencies unless they replace significant custom complexity or are already standard for the stack.
- Update docs, settings defaults, and language registries when adding behavior.
- Never hardcode secrets or machine-local paths.
