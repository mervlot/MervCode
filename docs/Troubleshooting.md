# Troubleshooting

## General debugging tools

- Browser/devtools console logs from the Wails WebView.
- LSP Inspector: `Ctrl+Shift+L` or Command Palette -> **Developer: Toggle LSP Inspector**.
- Backend logs from Wails stdout/stderr or `wails-out.log` / `wails-err.log` when present.
- Validation commands:

```sh
go test ./...
npm --prefix frontend run typecheck
npm --prefix frontend run lint
```

## LSP says loading forever

Check the LSP Inspector and console logs.

Common causes:

1. **Duplicate servers for one root**
   - Java/Kotlin can fail if multiple server processes use the same workspace data path.
   - MervCode should attach LSP/lint only for active tabs. Hidden tabs should not start LSP sessions.

2. **Missing external tool**
   - Run `CheckLanguageTools` through the UI prompt or inspect backend logs.
   - Make sure the runtime/LSP binary is available.

3. **Project root resolved incorrectly**
   - Look for `ResolveProjectRoot(...) -> root=...` logs.
   - Check marker files in `toolchain.go`.

4. **Server is slow to initialize**
   - Java and Kotlin are JVM/IntelliJ-based and can take longer on first load.
   - Their request timeout is higher than default in the frontend LSP client.

## TypeScript/JavaScript/JSX has no hover/completion

Look for this error:

```text
Could not find a valid TypeScript installation
```

`typescript-language-server` needs `typescript/lib/tsserver.js`. MervCode provides a fallback through `typescript_lsp.go`, but if it cannot find one:

- Install frontend dependencies in MervCode:

```sh
pnpm --dir frontend install
```

- Or install TypeScript globally:

```sh
npm install -g typescript typescript-language-server
```

Also verify `.jsx` is detected as `javascriptreact` and routed to backend toolchain `typescript`.

## ESLint says it cannot find `eslint.config.js`

ESLint v9+ expects flat config by default. Projects without an ESLint config may show:

```text
ESLint couldn't find an eslint.config.(js|mjs|cjs) file
```

Fix by adding an ESLint config to the target project or installing/configuring a compatible ESLint version/config. MervCode only runs ESLint; it does not invent project lint rules.

## Java LSP Gradle download errors

JDTLS/Buildship may log:

```text
Could not load Gradle version information
UnknownHostException: services.gradle.org
```

This means JDTLS tried to reach Gradle services and network/DNS failed. It is often non-fatal but can limit Gradle project import. Check network access or configure Gradle caches/wrapper locally.

## Java package mismatch diagnostics

Example:

```text
The declared package "com.example" does not match the expected package ""
```

This is a real Java project/source-root issue reported by JDTLS. Ensure package declarations match directory/source-root layout and build files define source sets correctly.

## Kotlin workspace path already in use

Kotlin LSP may log:

```text
The specified workspace data path is already in use
```

This usually means duplicate Kotlin LSP processes were started for the same project root. Ensure the frontend is using active-tab-only LSP lifecycle and old app instances are restarted after code changes.

## Formatter not working

Check:

- Is the language module registering `formatter`?
- Is backend `toolchain.go` configured with `Formatter`?
- Is the formatter binary available?
- Does `FormatDocument(lang, filePath, content)` log an error?

For TypeScript-family files, Prettier is called with `--stdin-filepath <file>` so parser/config should match `.ts`, `.tsx`, `.js`, and `.jsx`.

## Linter not working

Check:

- Is the language module registering `linter(model)`?
- Is backend `toolchain.go` configured with `Linter`?
- Is the linter binary/config available?
- Does `LintDocument` produce parseable output?

Notes:

- Go `golangci-lint` reflects last-saved disk content.
- ESLint may require project config.
- Checkstyle/ktlint need their bundled/configured runtime files.

## Terminal Ctrl+C appears to hang

The terminal backend should wait for process exit and emit `terminal:exit:<id>`. If it still appears stuck:

- Restart the app to ensure the latest backend is running.
- Confirm `terminal:exit:<id>` is emitted in logs.
- Remember: interrupted commands may legitimately exit with non-zero codes.
- Input after exit should be ignored and should not crash the frontend.

## Wails frontend bindings are stale

If you add or change exported Go `App` methods, Wails bindings under `frontend/wailsjs` may need regeneration. Run the normal Wails generation/build workflow intentionally and restart the app.

## Broad Biome lint failures

`npm --prefix frontend run lint` may report broad existing formatting/config issues. Do not mass-format unrelated files unless explicitly requested. For focused validation, check TypeScript and touched-file diagnostics.

## Last workspace/tabs are wrong

Workspace state lives in:

```js
localStorage.getItem("mervcode.workspace-state")
```

To reset:

```js
localStorage.removeItem("mervcode.workspace-state")
```

Settings and theme use separate keys and are not affected.
