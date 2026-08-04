# MervCode Documentation

This directory documents MervCode from architecture to tooling, language support, settings, terminal behavior, persistence, and troubleshooting.

## Start here

1. [`ProjectOverview.md`](ProjectOverview.md) - complete technical overview and module map.
2. [`Tooling.md`](Tooling.md) - package managers, commands, dependencies, external tools.
3. [`LanguageSupport.md`](LanguageSupport.md) - language/toolchain matrix and add-language guide.
4. [`LSP-Architecture.md`](LSP-Architecture.md) - detailed LSP client/bridge/server architecture.
5. [`SettingsAndTerminal.md`](SettingsAndTerminal.md) - settings model and terminal lifecycle.
6. [`WorkspaceState.md`](WorkspaceState.md) - localStorage persistence details.
7. [`Troubleshooting.md`](Troubleshooting.md) - common failures and how to diagnose them.
8. [`FeatureMatrix.md`](FeatureMatrix.md) - current feature status and roadmap.

## Key concepts

- MervCode is a Wails desktop IDE, not a web app.
- Go owns native/backend operations.
- React/TypeScript owns the IDE UI and Monaco integration.
- LSP flows through `frontend/src/editor/lsp` -> WebSocket -> `lsp_bridge.go` -> stdio server.
- Language toolchains are centralized in `toolchain.go`.
- Monaco language IDs and backend toolchain IDs are intentionally distinct for the TypeScript family.
- LSP/lint features attach to active editor tabs only to prevent duplicate server sessions.
- Settings are schema-driven and persisted in localStorage.
- Terminal sessions use xterm in the frontend and ConPTY in the backend.

## Keeping docs current

Update docs whenever you change:

- Architecture or lifecycle behavior.
- Language support or toolchain configuration.
- Required tools, package managers, or commands.
- Settings shape/defaults/UI behavior.
- Terminal lifecycle or event payloads.
- LSP protocol handling, providers, diagnostics, or logging.
