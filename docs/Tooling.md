# Tooling

This document lists the tools used to develop, build, validate, and run MervCode and its language integrations.

## Core development tools

| Tool | Purpose | Notes |
| --- | --- | --- |
| Go 1.23+ | Backend, Wails bindings, native services | Run from repository root. |
| Wails v2 | Desktop app framework | Do not run `wails dev` automatically. |
| pnpm | Frontend package manager for Wails hooks | Configured in `wails.json`. |
| npm | Optional one-off frontend command runner | Useful as `npm --prefix frontend ...`. |
| TypeScript | Frontend static typing | `npm --prefix frontend run typecheck`. |
| React | UI framework | React 18. |
| Vite | Frontend build/dev server | Used by Wails hooks. |
| Tailwind CSS 4 | Styling | Via `@tailwindcss/vite`. |
| Biome | Frontend lint/format checking | `npm --prefix frontend run lint`. |
| Monaco Editor | Code editor | Direct dependency. |
| xterm.js | Integrated terminal UI | Backend is ConPTY. |

## Frontend dependencies

See `frontend/package.json`. Important packages:

- `monaco-editor`
- `@monaco-editor/react`
- `@xterm/xterm`
- xterm addons: fit, search, unicode11, web-links, clipboard, webgl
- `react`, `react-dom`, `react-router-dom`
- `tailwindcss`, `@tailwindcss/vite`
- `motion`
- `bootstrap-icons`
- `lucide-react`
- `material-icon-theme`
- `material-symbols`
- `@biomejs/biome`
- `typescript`
- `vite`
- `vite-plugin-svgr`

## Wails frontend hooks

`wails.json` defines:

```json
{
  "frontend:install": "pnpm install",
  "frontend:build": "pnpm run build",
  "frontend:dev:watcher": "pnpm run dev --force",
  "frontend:dev:serverUrl": "auto"
}
```

Use pnpm for Wails workflows. npm is acceptable for targeted validation:

```sh
npm --prefix frontend run typecheck
npm --prefix frontend run lint
```

## Validation commands

From `mervcode/`:

```sh
go test ./...
npm --prefix frontend run typecheck
npm --prefix frontend run lint
pnpm --dir frontend run typecheck
pnpm --dir frontend run lint
```

Format Go files:

```sh
gofmt -w file.go another.go
```

Build frontend:

```sh
pnpm --dir frontend run build
npm --prefix frontend run build
```

Build app:

```sh
wails build
```

Do not run `wails dev` automatically while the desktop app is active.

## External language tools

Language tools are declared in `toolchain.go`. MervCode checks availability with `toolchain_manager.go` and can present install prompts.

| Language | Runtime | LSP | Formatter | Linter |
| --- | --- | --- | --- | --- |
| Go | `go` | `gopls` | `gofmt` | `golangci-lint` |
| TypeScript family | `node` | `typescript-language-server` + `typescript` | `prettier` | `eslint` |
| Java | `java` / bundled JDTLS | bundled JDTLS | google-java-format | Checkstyle |
| Kotlin | bundled Kotlin runtime/JBR | JetBrains Kotlin LSP | ktfmt | ktlint |

## Tool availability and install flow

- `CheckLanguageTools(lang)` returns runtime/tool availability.
- `InstallTools(lang)` attempts configured installers in `toolchain.go`.
- Manual fallback hints are provided when automation is not configured.
- GUI apps can inherit limited PATH values, so `findToolBinary` checks PATH plus common Go bin locations and bundled runtime directories.

## TypeScript server fallback

`typescript-language-server` needs `typescript/lib/tsserver.js`. Plain JS/JSX projects may not install TypeScript locally. `typescript_lsp.go` provides a fallback to MervCode's own frontend TypeScript install or global npm TypeScript so `.js`/`.jsx` still get LSP features.

## Biome notes

`npm --prefix frontend run lint` may report broad existing formatting/config issues. Do not mass-format unrelated files unless explicitly requested. For focused work, run TypeScript checks and diagnostics for touched files and report broad lint failures separately.

## Generated Wails bindings

Go methods exposed to the frontend are generated under `frontend/wailsjs` by Wails. If adding/removing/changing exported `App` methods, regenerate bindings through the normal Wails workflow and restart the app.
