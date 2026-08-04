# Language Support

MervCode language support is split across backend toolchains and frontend Monaco language modules.

## Support matrix

| Files | Monaco language ID | Backend toolchain | Syntax | LSP | Formatter | Linter |
| --- | --- | --- | :---: | :---: | :---: | :---: |
| `.go` | `go` | `go` | ✅ | `gopls` | `gofmt` | `golangci-lint` |
| `.ts`, `.mts`, `.cts` | `typescript` | `typescript` | ✅ | `typescript-language-server` | Prettier | ESLint |
| `.tsx` | `typescriptreact` | `typescript` | ✅ | `typescript-language-server` | Prettier | ESLint |
| `.js`, `.mjs`, `.cjs` | `javascript` | `typescript` | ✅ | `typescript-language-server` | Prettier | ESLint |
| `.jsx` | `javascriptreact` | `typescript` | ✅ | `typescript-language-server` | Prettier | ESLint |
| `.java` | `java` | `java` | ✅ | bundled JDTLS | google-java-format | Checkstyle |
| `.kt`, `.kts` | `kotlin` | `kotlin` | ✅ | bundled Kotlin LSP | ktfmt | ktlint |

## Detection

File detection lives in `frontend/src/editor/detectLang.ts`.

The TypeScript family is intentionally split into concrete Monaco IDs:

- `typescript`
- `typescriptreact`
- `javascript`
- `javascriptreact`

This preserves grammar/tokenization and correct `didOpen.languageId` values.

## Backend toolchain aliases

The backend toolchain registry has one TypeScript-family entry: `typescript`. The aliases are normalized by:

- `frontend/src/editor/languageIds.ts`
- backend `canonicalToolchainLang()` in `toolchain.go`

This prevents `.jsx` from asking the backend for a nonexistent `javascriptreact` toolchain while still letting Monaco treat the document as JSX.

## Frontend language modules

Language modules live in `frontend/src/editor/monaco/languages/`:

- `go.ts`
- `typescriptFamily.ts`
- `java.ts`
- `kotlin.ts`

Each module implements the `MonacoLanguage` interface:

```ts
interface MonacoLanguage {
  id: string;
  setup?(): void;
  formatter?(model): Promise<TextEdit[]>;
  diagnostics?(model): void;
  linter?(model): (() => void) | void;
  lsp?(editor, model, rootPath?: string): (() => void) | void;
}
```

Language modules are registered in `frontend/src/editor/monaco/registry.ts`.

## Backend toolchain registry

Toolchains are registered in `toolchain.go` with:

- LSP command/args or resolver.
- Formatter command/args or resolver.
- Linter command/args/parser or resolver.
- Project root markers.
- Runtime binary.
- Installers and manual hints.

Formatter execution is centralized in `FormatDocument`. Linter execution is centralized in `LintDocument`.

## Project root markers

| Toolchain | Markers |
| --- | --- |
| Go | `go.mod` |
| TypeScript | `tsconfig.json`, `jsconfig.json`, `package.json` |
| Java | `pom.xml`, `build.gradle`, `build.gradle.kts`, `settings.gradle`, `settings.gradle.kts`, `kpm.json`, `kpm.lock`, `kpm.run` |
| Kotlin | `build.gradle.kts`, `build.gradle`, `settings.gradle.kts`, `settings.gradle`, `kpm.json`, `kpm.lock`, `kpm.run` |

`workspace.go` resolves the nearest marker for every file before opening its LSP connection.

## Active-tab feature lifecycle

`Editor.tsx` attaches LSP/linter/format features only for active tabs. Hidden tabs retain their Monaco models but do not keep LSP documents open or spawn duplicate servers. This avoids duplicate Java/Kotlin server processes for the same root and prevents bundled workspace directory conflicts.

## Formatters

- Go uses `gofmt` over stdin.
- TS/JS/TSX/JSX uses Prettier with `--stdin-filepath <file>` so parser/config resolution matches the file extension and project config.
- Java uses google-java-format.
- Kotlin uses ktfmt.

Monaco format providers are registered once per concrete language ID and route the model to the correct backend formatter.

## Linters

- Go: `golangci-lint`; no stdin mode for `run`, so it reflects last-saved disk contents.
- TS family: ESLint with `--stdin --stdin-filename <file> --format json`.
- Java: Checkstyle.
- Kotlin: ktlint.

The frontend linter runner is generic and debounced. It calls `LintDocument(lang, filePath, content)` and maps normalized diagnostics to Monaco markers.

## Adding a language

1. Add backend `LanguageToolchain` entry in `toolchain.go`.
2. Add any formatter/linter parser helper files if needed.
3. Add frontend language module in `frontend/src/editor/monaco/languages/`.
4. Register it in `frontend/src/editor/monaco/registry.ts`.
5. Add extension mapping in `frontend/src/editor/detectLang.ts`.
6. Add settings if needed.
7. Update this document and `FeatureMatrix.md`.
8. Validate syntax, LSP, formatter, linter, missing-tool prompt, and project-root resolution.
