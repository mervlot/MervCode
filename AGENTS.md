# MervCode Project Guidelines

These instructions apply to this repository. They override any more general personal instructions when they conflict.

## Project identity

MervCode is a native desktop IDE, not a web app. It is built with Wails v2, a Go backend, a React/TypeScript frontend, Monaco Editor, and an xterm/ConPTY integrated terminal.

## Tools and package managers

Use these tools and assume they are part of the project workflow:

- **Go** 1.23+
- **Wails v2**
- **pnpm** for Wails frontend install/build/dev hooks
- **npm** may be used for one-off frontend validation with `npm --prefix frontend ...`
- **TypeScript**
- **React**
- **Vite**
- **Tailwind CSS 4**
- **Biome** for frontend lint/format checks
- **Monaco Editor**
- **xterm.js**
- **motion/react**
- **Bootstrap Icons**
- **lucide-react**
- **material-icon-theme**

External language tools used by MervCode:

- Go: `gopls`, `gofmt`, `golangci-lint`
- TypeScript/JavaScript/TSX/JSX: `typescript-language-server`, `typescript`, `prettier`, `eslint`
- Java: bundled JDTLS, `google-java-format`, Checkstyle
- Kotlin: bundled JetBrains Kotlin LSP, `ktfmt`, `ktlint`

## Do not run

- **Never run `wails dev` automatically.** It disrupts the running desktop app. Ask first if a dev server/app session is truly needed.
- Do not start long-running watchers or servers unless explicitly requested.
- Do not commit changes or create branches unless requested.

## Preferred validation commands

From `mervcode/`:

```sh
go test ./...
npm --prefix frontend run typecheck
npm --prefix frontend run lint
pnpm --dir frontend run typecheck
pnpm --dir frontend run lint
```

Use `gofmt -w <files>` for Go files.

`npm --prefix frontend run lint` may currently surface broad pre-existing Biome/config/format issues. If it fails, report whether touched files are clean separately rather than applying unrelated mass formatting.

## Architecture

- **Backend**: Go + Wails bindings.
- **Frontend**: React + TypeScript + Monaco + Tailwind.
- **Desktop runtime**: Wails WebView2 on Windows.
- **LSP**: Frontend WebSocket transport -> Go `lsp_bridge.go` -> stdio language server.
- **Toolchains**: Central registry in `toolchain.go`.
- **Workspace root resolution**: `workspace.go` resolves nearest project marker per file/language.
- **Terminal**: `terminal.go` uses ConPTY; `TerminalPanel.tsx` uses xterm.
- **Settings**: `EditorSettings` in `frontend/src/types.ts`, defaults in `useEditorSettings.ts`, UI schema in `editor/settingsSchema.ts`, Monaco mapping in `editor/monaco/toMonacoOptions.ts`.

## Key source map

```text
main.go                              Wails app entrypoint
func.go                              File ops, search, git, watchers
terminal.go                          Integrated terminal backend
lsp_bridge.go                        WebSocket <-> stdio LSP bridge
toolchain.go                         Language toolchains, formatters, linters
toolchain_manager.go                 Tool availability/install helpers
workspace.go                         Project-root resolution
typescript_lsp.go                    TypeScript tsserver fallback path
frontend/src/pages/Home.tsx          Main IDE shell/state
frontend/src/pages/Editor.tsx        Monaco editor host + active-tab feature lifecycle
frontend/src/components/editor/      IDE UI components
frontend/src/editor/detectLang.ts    File extension -> Monaco language ID
frontend/src/editor/languageIds.ts   Monaco language -> backend toolchain mapping
frontend/src/editor/lsp/             LSP client internals
frontend/src/editor/lint/            Generic linter runner
frontend/src/editor/monaco/          Monaco setup/registry/language modules/options
frontend/src/hooks/                  Shared state hooks
frontend/src/lib/persistence.ts      Workspace localStorage persistence
```

## UI/UX philosophy

### Design language

- Modern but nostalgic IDE feel.
- Dark theme default: black canvas with crimson accent (`#DC143C`).
- Custom cursors where provided.
- Monaspace font with ligatures enabled by default.
- Tailwind spacing scale, minimal animation.

### Component patterns

- Left sidebar with tabbed panels: explorer, search, git, settings/dev tools.
- Center editor area with draggable tabs and context menus.
- Bottom status bar and integrated terminal.
- Sectioned settings panel using toggles, sliders, and dropdowns.
- Centered modal/dialog overlays with dark backdrop.

### Interaction patterns

Follow familiar VS Code/Sublime/Atom conventions:

- `Ctrl+Shift+P`: Command palette
- `Ctrl+S`: Save
- `Ctrl+W`: Close tab
- `Ctrl+``: Toggle terminal
- `Ctrl+B`: Toggle sidebar
- `Ctrl+Tab`: Next tab
- `Ctrl+,`: Settings
- `Ctrl+Shift+L`: LSP Inspector

## Performance rules

- Keep React components focused and avoid unnecessary state.
- Avoid expensive work for hidden tabs.
- LSP/lint features should attach to active editor tabs only; hidden tabs keep models but should not spawn duplicate servers.
- Cache LSP clients by `(language, resolved project root)`.
- Debounce file watcher events.
- Keep search result/file-size limits intact.
- Do not add dependencies unless they provide significant value.

## LSP and language support rules

### Current model

- `lsp_bridge.go` is the active backend LSP bridge. Do not reference the old `lsp_proxy.go` architecture.
- One frontend `LSPConnection` is cached per `(server/toolchain language, project root)`.
- `openLSPDocument()` resolves project root, gets a connection, syncs the model, and registers providers.
- Providers are global per Monaco language ID but route each request through the owning document connection.
- Request/notification traffic is logged for debugging.

### TypeScript family

Monaco language IDs:

- `typescript` (`.ts`, `.mts`, `.cts`)
- `typescriptreact` (`.tsx`)
- `javascript` (`.js`, `.mjs`, `.cjs`)
- `javascriptreact` (`.jsx`)

All four route to backend toolchain `typescript`. Keep this distinction: Monaco needs concrete IDs for grammar, backend tools are shared.

### Adding a new language

Update all relevant layers:

1. Backend `toolchain.go`
   - Add `LanguageToolchain` entry.
   - Configure LSP, formatter, linter, markers, runtime, installers, manual hints.
2. Frontend language module
   - Create `frontend/src/editor/monaco/languages/{lang}.ts`.
   - Implement `MonacoLanguage` with LSP/formatter/linter hooks as applicable.
3. Registry
   - Import/register in `frontend/src/editor/monaco/registry.ts`.
4. Detection
   - Map extensions in `frontend/src/editor/detectLang.ts`.
5. Settings if needed
   - `frontend/src/types.ts`
   - `frontend/src/hooks/useEditorSettings.ts`
   - `frontend/src/editor/settingsSchema.ts`
   - `frontend/src/editor/monaco/toMonacoOptions.ts`
6. Docs
   - Update `docs/LanguageSupport.md` and `docs/FeatureMatrix.md`.
7. Validate
   - Tool missing state prompts correctly.
   - LSP starts and hover/completion/definition work.
   - Formatter works.
   - Linter produces markers.
   - Syntax highlighting/detection works.

## Settings rules

When adding a setting:

1. Add it to `EditorSettings` in `frontend/src/types.ts`.
2. Add a default in `frontend/src/hooks/useEditorSettings.ts`.
3. Add UI schema in `frontend/src/editor/settingsSchema.ts`.
4. Apply it in `frontend/src/editor/monaco/toMonacoOptions.ts`, `Editor.tsx`, `EditorArea.tsx`, or another correct consumer.
5. Keep settings isolated: editor settings should not unintentionally affect terminal or unrelated app UI.
6. Ensure saved settings deep-merge with defaults so existing users receive new defaults.

## Terminal rules

- Backend terminal sessions live in `terminal.go` and use ConPTY.
- Frontend terminal tabs live in `TerminalPanel.tsx` and use xterm.
- Process exit should emit structured `terminal:exit:<id>` events with exit code.
- Do not treat post-exit input as a frontend crash; it can race with normal shell/CLI shutdown.
- Terminal settings are separate from editor settings: font family, font size, cursor blink, scrollback, height, default shell.

## Go backend style

- Prefer Go standard library where practical.
- Return descriptive errors with context.
- Avoid blocking the UI thread.
- Long-running work should run asynchronously where appropriate.
- Use `runtime.EventsEmit` for backend-to-frontend events.
- Stop watchers, LSP servers, and terminal sessions gracefully.
- Use `gofmt`.

## Frontend style

- Prefer strict TypeScript.
- Avoid `any` unless Wails bindings or third-party APIs force it.
- Keep components focused and composable.
- Separate business logic from UI where practical.
- Use custom hooks for shared state.
- Persist settings/workspace state through existing localStorage helpers.
- Do not let hidden editor tabs spawn duplicate language servers.

## Documentation rules

Keep docs current when changing architecture or workflows:

- `README.md` for project overview and quick-start.
- `docs/ProjectOverview.md` for technical architecture.
- `docs/Tooling.md` for tools/commands/dependencies.
- `docs/LanguageSupport.md` for toolchain/language matrix.
- `docs/LSP-Architecture.md` for protocol internals.
- `docs/SettingsAndTerminal.md` for settings and terminal behavior.
- `docs/Troubleshooting.md` for known failure modes.
- `docs/FeatureMatrix.md` for roadmap/status.

## Things to avoid

- Large-scale refactors without explicit permission.
- New abstractions with no immediate use.
- Duplicate toolchain/language mapping logic.
- Magic paths or hardcoded machine-local values.
- Ignoring async errors.
- Breaking keyboard shortcuts.
- Changing core layout (sidebar left, editor center, status/terminal bottom) without discussion.
- Removing familiar IDE features without replacement.
