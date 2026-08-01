package main

import (
	"bytes"
	"fmt"
	"os/exec"
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
}

type FormatterConfig struct {
	Command string   `json:"command"`
	Args    []string `json:"args"`
	Stdin   bool     `json:"stdin"`
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
			Markers:           []string{"go.mod"},
			RuntimeBinary:     "go",
			RuntimeInstallURL: "https://go.dev/dl/",
			ToolInstallers: map[string][]ToolInstaller{
				"gopls": {
					{Binary: "go", Args: []string{"install", "golang.org/x/tools/gopls@latest"}},
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
			},
		},
		"java": {
			ID:   "java",
			Name: "Java",
			LSP: &LSPConfig{
				// Eclipse JDT Language Server. Most distributions
				// (Homebrew, Scoop, the official download) install a
				// `jdtls` wrapper script that already resolves its own
				// -configuration/-data paths, so no extra args are
				// required here.
				Command: "jdtls",
				Args:    []string{},
			},
			Markers:           []string{"pom.xml", "build.gradle", "build.gradle.kts", "settings.gradle", "settings.gradle.kts"},
			RuntimeBinary:     "java",
			RuntimeInstallURL: "https://adoptium.net/",
			// There's no single cross-platform package manager for jdtls, so
			// try the ones that might already be present in order, and fall
			// back to a manual hint if neither is installed.
			ToolInstallers: map[string][]ToolInstaller{
				"jdtls": {
					{Binary: "brew", Args: []string{"install", "jdtls"}},
					{Binary: "scoop", Args: []string{"install", "jdtls"}},
				},
			},
			ManualInstallHints: map[string]string{
				"jdtls": "No Homebrew or Scoop found. Install manually from https://download.eclipse.org/jdtls/, or install Homebrew/Scoop first and try again.",
			},
		},
		"kotlin": {
			ID:   "kotlin",
			Name: "Kotlin",
			LSP: &LSPConfig{
				// fwcd/kotlin-language-server. Ships as a wrapper script
				// (kotlin-language-server / .bat on Windows).
				Command: "kotlin-language-server",
				Args:    []string{},
			},
			Markers:           []string{"build.gradle.kts", "build.gradle", "settings.gradle.kts", "settings.gradle"},
			RuntimeBinary:     "java",
			RuntimeInstallURL: "https://adoptium.net/",
			// Same story as jdtls - no single cross-platform command exists.
			ToolInstallers: map[string][]ToolInstaller{
				"kotlin-language-server": {
					{Binary: "brew", Args: []string{"install", "kotlin-language-server"}},
					{Binary: "scoop", Args: []string{"install", "kotlin-language-server"}},
				},
			},
			ManualInstallHints: map[string]string{
				"kotlin-language-server": "No Homebrew or Scoop found. Install manually from https://github.com/fwcd/kotlin-language-server/releases, or install Homebrew/Scoop first and try again.",
			},
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
	resolvedCmd, err := findToolBinary(f.Command)
	if err != nil {
		return "", fmt.Errorf("locate %s: %w", f.Command, err)
	}
	cmd := exec.Command(resolvedCmd, f.Args...)

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
