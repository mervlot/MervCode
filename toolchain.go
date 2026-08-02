package main

import (
	"bytes"
	"context"
	"fmt"
	"os/exec"
	"path/filepath"
	"strings"
)

type LSPConfig struct {
	Command string   `json:"command"`
	Args    []string `json:"args"`

	// InitializationOptions is forwarded verbatim into the initialize
	// request's initializationOptions field by the frontend LSP client.
	// Most servers (gopls, tsserver, rust-analyzer, ...) use this for
	// server-specific settings that don't fit the standard LSP
	// capabilities negotiation. Optional - nil means "send nothing".
	InitializationOptions map[string]any `json:"initializationOptions,omitempty"`

	// Env holds extra "KEY=VALUE" environment variables to set on the
	// spawned server process, appended to the current process's
	// environment (e.g. JAVA_HOME overrides for jdtls).
	Env []string `json:"env,omitempty"`

	// IsAvailable, if set, is a cheap (no network, no process spawn)
	// check for whether this server can actually be launched right now.
	// Used instead of the plain findToolBinary(Command) check for
	// servers whose "is it installed" question is more involved than
	// one binary on PATH (e.g. a bundled runtime with several required
	// files). Optional - nil falls back to the plain PATH/GOPATH lookup.
	IsAvailable func() bool `json:"-"`

	// Resolve, if set, computes the actual command, arguments, and any
	// extra "KEY=VALUE" environment variables to launch for this specific
	// project, overriding Command/Args/Env entirely. Used for servers
	// that need per-invocation values - e.g. jdtls's -data workspace
	// directory (must be project-specific), or the bundled Kotlin LSP's
	// JAVA_HOME (must point at its own bundled JBR, not the system Java,
	// and that path is only known once the bundled runtime is located).
	// Optional - nil falls back to findToolBinary(Command) + Args + Env
	// as static values.
	Resolve func(ctx context.Context, projectRoot string) (command string, args []string, env []string, err error) `json:"-"`
}

type FormatterConfig struct {
	Command string   `json:"command"`
	Args    []string `json:"args"`
	Stdin   bool     `json:"stdin"`

	// DynamicArgs, if set, computes extra arguments to append after Args
	// for this specific file - e.g. Prettier's `--stdin-filepath <path>`,
	// which it needs (instead of a real file extension) to pick the right
	// parser for .ts vs .tsx vs .jsx when the content itself is piped in
	// over stdin rather than read from disk. Optional - nil means no extra
	// arguments beyond the static Args.
	DynamicArgs func(filePath string) []string `json:"-"`

	// Resolve, if set, computes the actual command and arguments to invoke
	// for this specific file, overriding Command/Args/DynamicArgs entirely.
	// Used for formatters that aren't a single named binary on PATH - e.g.
	// google-java-format/ktfmt, which are launched as `java -jar <bundled
	// jar>`, where both the java executable and the jar path are resolved
	// from MervCode's own bundled runtime directories (see
	// google_java_format.go/ktfmt.go). Optional - nil falls back to
	// findToolBinary(Command) + Args/DynamicArgs as before.
	Resolve func(filePath string) (command string, args []string, err error) `json:"-"`

	// IsAvailable mirrors LSPConfig.IsAvailable for formatters whose "is it
	// installed" check needs to be more involved than a plain PATH lookup
	// (e.g. a bundled jar plus a bundled JBR to run it with). Optional -
	// nil falls back to findToolBinary(Command).
	IsAvailable func() bool `json:"-"`
}

// LinterConfig configures a pluggable linter for a language, mirroring
// FormatterConfig's shape and DynamicArgs convention. Every linter has its
// own CLI conventions and output format, so Parse is what actually
// understands a specific linter's stdout - adding a new language's linter
// (Python's ruff, Go's golangci-lint, ...) never requires touching
// LintDocument itself, only supplying a new LinterConfig with its own
// DynamicArgs/Parse (see eslint.go for the "typescript" entry's).
type LinterConfig struct {
	Command string   `json:"command"`
	Args    []string `json:"args"`
	Stdin   bool     `json:"stdin"`

	// DynamicArgs mirrors FormatterConfig.DynamicArgs - extra arguments
	// computed per-file, e.g. ESLint's `--stdin-filename <path>` (needed
	// both to resolve the right config/parser and to report a meaningful
	// file name even though content is piped in over stdin).
	DynamicArgs func(filePath string) []string `json:"-"`

	// Resolve mirrors FormatterConfig.Resolve - computes the actual command
	// and arguments to invoke for this specific file, overriding
	// Command/Args/DynamicArgs entirely. Used for linters that aren't a
	// single named binary on PATH (e.g. checkstyle/ktlint - see
	// checkstyle.go/ktlint.go). Optional - nil falls back to
	// findToolBinary(Command) + Args/DynamicArgs as before.
	Resolve func(filePath string) (command string, args []string, err error) `json:"-"`

	// Parse converts this linter's raw stdout into normalized
	// LintDiagnostics. filePath is passed through so a linter whose output
	// can span multiple files (golangci-lint analyzes a whole package
	// directory - see golangci-lint.go) can filter results down to just
	// the file actually being linted. Required - LintDocument has no
	// fallback parsing.
	Parse func(output []byte, filePath string) ([]LintDiagnostic, error) `json:"-"`

	// IsAvailable mirrors LSPConfig.IsAvailable for linters whose "is it
	// installed" check needs to be more involved than a plain PATH lookup.
	// Optional - nil falls back to findToolBinary(Command).
	IsAvailable func() bool `json:"-"`
}

// LintDiagnostic is one normalized finding from a language's linter,
// independent of whatever output format that linter actually emits - the
// frontend maps these directly onto Monaco markers, the same way LSP
// publishDiagnostics notifications are (see editor/lsp/diagnostics.ts).
type LintDiagnostic struct {
	Severity  string `json:"severity"` // "error" | "warning" | "info"
	Message   string `json:"message"`
	RuleID    string `json:"ruleId,omitempty"`
	Line      int    `json:"line"`
	Column    int    `json:"column"`
	EndLine   int    `json:"endLine,omitempty"`
	EndColumn int    `json:"endColumn,omitempty"`
}

// ToolInstaller is one concrete, automatable way to install a tool: run
// Binary with Args. Binary is resolved via findToolBinary before running
// (not exec.LookPath directly), so the same PATH quirks that would hide
// an already-installed LSP server from a GUI-launched app don't also hide
// the package manager needed to install one.
type ToolInstaller struct {
	Binary string
	Args   []string
}

type LanguageToolchain struct {
	ID                string           `json:"id"`
	Name              string           `json:"name"`
	LSP               *LSPConfig       `json:"lsp,omitempty"`
	Formatter         *FormatterConfig `json:"formatter,omitempty"`
	Linter            *LinterConfig    `json:"-"`
	Markers           []string         `json:"markers"`
	RuntimeBinary     string           `json:"runtimeBinary"`
	RuntimeInstallURL string           `json:"runtimeInstallUrl"`

	// ToolInstallers maps a tool's binary name (e.g. "gopls") to one or
	// more candidate installers, tried in order until one whose own Binary
	// (e.g. "brew", "scoop") is actually found on this machine. A tool with
	// no entry here - or where none of its candidates' Binary is found -
	// has no automatable install path on this system; InstallTools reports
	// that plainly via ManualInstallHints instead of guessing at a shell
	// command that would just fail.
	ToolInstallers map[string][]ToolInstaller

	// ManualInstallHints is surfaced to the user when a tool couldn't be
	// installed automatically - platform package manager commands to try
	// by hand plus a fallback download URL.
	ManualInstallHints map[string]string
}

var toolchains map[string]*LanguageToolchain

func init() {
	toolchains = map[string]*LanguageToolchain{
		"go": {
			ID:   "go",
			Name: "Go",
			LSP: &LSPConfig{
				Command: "gopls",
				Args:    []string{"-mode=stdio"},
			},
			Formatter: &FormatterConfig{
				Command: "gofmt",
				Stdin:   true,
			},
			// golangci-lint has no stdin mode for `run` (only its separate
			// `fmt` command supports --stdin), so this always lints the
			// file's last-saved contents on disk - see golangci-lint.go.
			Linter: &LinterConfig{
				Command:     "golangci-lint",
				DynamicArgs: golangciLintArgs,
				Parse:       parseGolangciLintJSON,
			},
			Markers:           []string{"go.mod"},
			RuntimeBinary:     "go",
			RuntimeInstallURL: "https://go.dev/dl/",
			ToolInstallers: map[string][]ToolInstaller{
				"gopls": {
					{Binary: "go", Args: []string{"install", "golang.org/x/tools/gopls@latest"}},
				},
				"golangci-lint": {
					{Binary: "go", Args: []string{"install", "github.com/golangci/golangci-lint/cmd/golangci-lint@latest"}},
				},
			},
			// gofmt ships inside the Go distribution itself (same bin dir as
			// `go`) - there's nothing to install. If it's ever reported
			// missing, the Go installation itself is incomplete/broken.
			ManualInstallHints: map[string]string{
				"gofmt": "gofmt ships with the Go toolchain - reinstall Go from https://go.dev/dl/ and make sure its bin directory is on PATH.",
			},
		},
		"typescript": {
			ID:   "typescript",
			Name: "TypeScript / JavaScript",
			LSP: &LSPConfig{
				Command: "typescript-language-server",
				Args:    []string{"--stdio"},
			},
			// Prettier reads the file's content from stdin and is told the
			// real path via --stdin-filepath purely so it can pick the right
			// parser (plain TS vs TSX vs JSX) - it never touches the file on
			// disk itself.
			Formatter: &FormatterConfig{
				Command: "prettier",
				Stdin:   true,
				DynamicArgs: func(filePath string) []string {
					return []string{"--stdin-filepath", filePath}
				},
			},
			// See eslint.go for eslintArgs/parseESLintJSON - this is the only
			// language wired to a linter so far, but LintDocument itself
			// (toolchain.go) has no ESLint-specific knowledge at all.
			Linter: &LinterConfig{
				Command:     "eslint",
				Stdin:       true,
				DynamicArgs: eslintArgs,
				Parse:       parseESLintJSON,
			},
			Markers: []string{
				"tsconfig.json",
				"jsconfig.json",
				"package.json",
			},
			RuntimeBinary:     "node",
			RuntimeInstallURL: "https://nodejs.org/",
			// npm ships alongside node but is a separate binary (npm.cmd on
			// Windows) - it must be resolved and invoked directly, not assumed
			// to be the RuntimeBinary ("node").
			ToolInstallers: map[string][]ToolInstaller{
				"typescript-language-server": {
					{Binary: "npm", Args: []string{"install", "-g", "typescript", "typescript-language-server"}},
				},
				"prettier": {
					{Binary: "npm", Args: []string{"install", "-g", "prettier"}},
				},
				"eslint": {
					{Binary: "npm", Args: []string{"install", "-g", "eslint"}},
				},
			},
		},
		"java": {
			ID:   "java",
			Name: "Java",
			LSP: &LSPConfig{
				// JDTLS is bundled with MervCode under runtime/java (see
				// jdtls.go) and launched directly via `java -jar
				// <equinox launcher>`, not through the jdtls/jdtls.bat
				// wrapper scripts. Command/Args are placeholders -
				// Resolve computes the real invocation per project.
				Command:     "java",
				Args:        nil,
				IsAvailable: jdtlsAvailable,
				Resolve:     ResolveJDTLS,
			},
			// google-java-format has no configurability, so there's no
			// config file to manage - see google_java_format.go.
			Formatter: &FormatterConfig{
				Command:     "google-java-format",
				Stdin:       true,
				IsAvailable: googleJavaFormatAvailable,
				Resolve:     ResolveGoogleJavaFormat,
			},
			// Checkstyle has no stdin mode, so this always lints the file's
			// last-saved contents on disk - see checkstyle.go.
			Linter: &LinterConfig{
				Command:     "checkstyle",
				IsAvailable: checkstyleAvailable,
				Resolve:     ResolveCheckstyle,
				Parse:       parseCheckstyleXML,
			},
			Markers: []string{
				"pom.xml",
				"build.gradle",
				"build.gradle.kts",
				"settings.gradle",
				"settings.gradle.kts",
				"kpm.json",
				"kpm.lock",
				"kpm.run"},
			RuntimeBinary:     "java",
			RuntimeInstallURL: "https://adoptium.net/",
			ManualInstallHints: map[string]string{
				"java": "JDTLS is bundled with MervCode, but it needs a JDK to run. Install one from https://adoptium.net/ and make sure `java` is on PATH.",
			},
		},
		"kotlin": {
			ID:   "kotlin",
			Name: "Kotlin",
			LSP: &LSPConfig{
				Command:     "kotlin-lsp",
				Args:        nil,
				IsAvailable: kotlinLSAvailable,
				Resolve:     ResolveKotlinLS,
			},
			// Runs on the Kotlin LSP's own bundled JBR, not a system JDK -
			// see ktfmt.go.
			Formatter: &FormatterConfig{
				Command:     "ktfmt",
				Stdin:       true,
				IsAvailable: ktfmtAvailable,
				Resolve:     ResolveKtfmt,
			},
			// ktlint can autoformat too, but ktfmt is the designated
			// formatter here - ktlint is used purely for lint diagnostics.
			// See ktlint.go.
			Linter: &LinterConfig{
				Command:     "ktlint",
				Stdin:       true,
				IsAvailable: ktlintAvailable,
				Resolve:     ResolveKtlint,
				Parse:       parseKtlintJSON,
			},
			Markers: []string{
				"build.gradle.kts",
				"build.gradle",
				"settings.gradle.kts",
				"settings.gradle",
				"kpm.json",
				"kpm.lock",
				"kpm.run",
			},
			RuntimeBinary: "intellij-server",
		},
	}
}

func GetToolchain(lang string) *LanguageToolchain {
	return toolchains[lang]
}

// LanguageProfile is the subset of a LanguageToolchain the frontend needs
// in order to speak LSP correctly to a given language's server - it can't
// see toolchain.go directly since it only talks to Go through Wails
// bindings. Adding a new language server's `initializationOptions` (e.g.
// rust-analyzer's `cargo`/`checkOnSave` settings) never requires touching
// any TypeScript: register it once here and every client picks it up.
type LanguageProfile struct {
	ID                    string         `json:"id"`
	Markers               []string       `json:"markers"`
	InitializationOptions map[string]any `json:"initializationOptions,omitempty"`
}

// GetLanguageProfile exposes a language's static LSP configuration to the
// frontend, fetched once when a connection is first opened.
func (a *App) GetLanguageProfile(lang string) (*LanguageProfile, error) {
	tc := GetToolchain(lang)
	if tc == nil {
		return nil, fmt.Errorf("no toolchain configured for %s", lang)
	}

	profile := &LanguageProfile{ID: tc.ID, Markers: tc.Markers}
	if tc.LSP != nil {
		profile.InitializationOptions = tc.LSP.InitializationOptions
	}
	return profile, nil
}

func (a *App) FormatDocument(lang, filePath, content string) (string, error) {
	tc := GetToolchain(lang)
	if tc == nil || tc.Formatter == nil {
		return "", fmt.Errorf("no formatter configured for %s", lang)
	}

	f := tc.Formatter
	if f.IsAvailable != nil && !f.IsAvailable() {
		return "", fmt.Errorf("%s is not available", f.Command)
	}

	var resolvedCmd string
	var args []string
	var err error
	if f.Resolve != nil {
		resolvedCmd, args, err = f.Resolve(filePath)
		if err != nil {
			return "", fmt.Errorf("resolve %s: %w", f.Command, err)
		}
	} else {
		resolvedCmd, err = findToolBinary(f.Command)
		if err != nil {
			return "", fmt.Errorf("locate %s: %w", f.Command, err)
		}
		args = f.Args
		if f.DynamicArgs != nil {
			args = append(append([]string{}, f.Args...), f.DynamicArgs(filePath)...)
		}
	}
	cmd := exec.Command(resolvedCmd, args...)

	if f.Stdin {
		cmd.Stdin = strings.NewReader(content)
	}

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("format %s: %w\n%s", lang, err, stderr.String())
	}

	return stdout.String(), nil
}

// LintDocument runs lang's configured linter against content (treated as
// filePath's current, possibly-unsaved contents) and returns normalized
// diagnostics. Mirrors FormatDocument's shape and error handling - the only
// thing linter-specific is LinterConfig.Parse (see eslint.go).
func (a *App) LintDocument(lang, filePath, content string) ([]LintDiagnostic, error) {
	tc := GetToolchain(lang)
	if tc == nil || tc.Linter == nil {
		return nil, fmt.Errorf("no linter configured for %s", lang)
	}

	l := tc.Linter
	if l.IsAvailable != nil && !l.IsAvailable() {
		return nil, fmt.Errorf("%s is not available", l.Command)
	}

	var resolvedCmd string
	var args []string
	var err error
	if l.Resolve != nil {
		resolvedCmd, args, err = l.Resolve(filePath)
		if err != nil {
			return nil, fmt.Errorf("resolve %s: %w", l.Command, err)
		}
	} else {
		resolvedCmd, err = findToolBinary(l.Command)
		if err != nil {
			return nil, fmt.Errorf("locate %s: %w", l.Command, err)
		}
		args = l.Args
		if l.DynamicArgs != nil {
			args = append(append([]string{}, l.Args...), l.DynamicArgs(filePath)...)
		}
	}
	cmd := exec.Command(resolvedCmd, args...)
	// Run from filePath's own directory rather than MervCode's own process
	// directory - needed for linters that operate on real files/packages
	// instead of stdin content (golangci-lint's "." target below only makes
	// sense relative to this), and harmless for stdin-based linters like
	// ESLint, which are already given filePath as an absolute path.
	cmd.Dir = filepath.Dir(filePath)

	if l.Stdin {
		cmd.Stdin = strings.NewReader(content)
	}

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	// Linters conventionally exit non-zero the moment they find any issue
	// at all (e.g. one error-severity finding) - that's normal operation,
	// not a failure to run, so a non-zero exit only becomes a real error
	// when there's no parseable output to fall back on.
	runErr := cmd.Run()
	diagnostics, parseErr := l.Parse(stdout.Bytes(), filePath)
	if parseErr != nil {
		if runErr != nil {
			return nil, fmt.Errorf("lint %s: %w\n%s", lang, runErr, stderr.String())
		}
		return nil, fmt.Errorf("parse %s lint output: %w", lang, parseErr)
	}

	return diagnostics, nil
}
