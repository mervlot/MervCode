package main

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// findToolBinary resolves name to an executable path. It checks PATH
// first (exec.LookPath), then falls back to common Go tool install
// locations: $GOBIN, $GOPATH/bin, and ~/go/bin. GUI-launched apps
// (especially on Windows/macOS when double-clicked rather than started
// from a terminal) often inherit a shorter PATH than a shell session
// would, so tools installed via `go install ...` — which land in one of
// these directories — can appear "missing" even though they work fine
// from a terminal.
func findToolBinary(name string) (string, error) {
	if p, err := exec.LookPath(name); err == nil {
		return p, nil
	}

	exeName := name
	if runtime.GOOS == "windows" && !strings.HasSuffix(strings.ToLower(exeName), ".exe") {
		exeName += ".exe"
	}

	var candidates []string
	if gobin := os.Getenv("GOBIN"); gobin != "" {
		candidates = append(candidates, filepath.Join(gobin, exeName))
	}
	if gopath := os.Getenv("GOPATH"); gopath != "" {
		candidates = append(candidates, filepath.Join(gopath, "bin", exeName))
	}
	if home, err := os.UserHomeDir(); err == nil {
		candidates = append(candidates, filepath.Join(home, "go", "bin", exeName))
	}

	for _, c := range candidates {
		if info, err := os.Stat(c); err == nil && !info.IsDir() {
			return c, nil
		}
	}

	return "", fmt.Errorf("%s not found in PATH or common Go bin directories", name)
}

type ToolStatus struct {
	LanguageInstalled bool     `json:"languageInstalled"`
	ToolsInstalled    bool     `json:"toolsInstalled"`
	MissingTools      []string `json:"missingTools"`
	LanguageBinary    string   `json:"languageBinary"`
	InstallCommand    string   `json:"installCommand"`
}

func (a *App) CheckLanguageTools(lang string) (*ToolStatus, error) {
	tc := GetToolchain(lang)
	if tc == nil {
		return nil, fmt.Errorf("no toolchain configured for %s", lang)
	}

	status := &ToolStatus{
		MissingTools: []string{},
	}

	// Check language runtime
	if tc.RuntimeBinary != "" {
		status.LanguageBinary = tc.RuntimeBinary
		if _, err := findToolBinary(tc.RuntimeBinary); err != nil {
			status.LanguageInstalled = false
			status.InstallCommand = installCommandFor(tc.RuntimeBinary)
			return status, nil
		}
		status.LanguageInstalled = true
	}

	// Check LSP tool
	if tc.LSP != nil {
		if _, err := findToolBinary(tc.LSP.Command); err != nil {
			status.MissingTools = append(status.MissingTools, tc.LSP.Command)
		}
	}

	// Check formatter tool
	if tc.Formatter != nil {
		if _, err := findToolBinary(tc.Formatter.Command); err != nil {
			status.MissingTools = append(status.MissingTools, tc.Formatter.Command)
		}
	}

	if len(status.MissingTools) == 0 {
		status.ToolsInstalled = true
	}

	return status, nil
}

func (a *App) InstallTools(lang string) error {
	tc := GetToolchain(lang)
	if tc == nil {
		return fmt.Errorf("no toolchain configured for %s", lang)
	}

	// Check language runtime first
	if tc.RuntimeBinary != "" {
		if _, err := findToolBinary(tc.RuntimeBinary); err != nil {
			return fmt.Errorf("%s runtime not installed. Please install %s from %s",
				tc.Name, tc.RuntimeBinary, tc.RuntimeInstallURL)
		}
	}

	var failures []string
	for _, tool := range missingTools(tc) {
		wailsRuntime.EventsEmit(a.ctx, "toolchain:installProgress", map[string]any{
			"tool":    tool,
			"status":  "installing",
			"message": fmt.Sprintf("Installing %s...", tool),
		})

		if err := installTool(tc, tool); err != nil {
			wailsRuntime.EventsEmit(a.ctx, "toolchain:installProgress", map[string]any{
				"tool":    tool,
				"status":  "error",
				"message": err.Error(),
			})
			failures = append(failures, err.Error())
			continue
		}

		wailsRuntime.EventsEmit(a.ctx, "toolchain:installProgress", map[string]any{
			"tool":    tool,
			"status":  "success",
			"message": fmt.Sprintf("%s installed successfully", tool),
		})
	}

	if len(failures) > 0 {
		return fmt.Errorf("%s", strings.Join(failures, "\n"))
	}
	return nil
}

// installTool runs the first candidate installer for tool whose own binary
// (go, npm, brew, scoop, ...) is actually resolvable on this machine, using
// the same PATH-tolerant findToolBinary lookup used for LSP/formatter
// discovery - a GUI-launched MervCode often inherits a shorter PATH than a
// terminal session, which would otherwise make an installed package manager
// look "missing" even when it works fine from a shell.
//
// If no candidate's binary is found (or the tool has no candidates at all),
// this returns a clear, actionable error instead of guessing at a shell
// command - previously InstallTools executed human-readable instruction
// strings like "Homebrew: brew install X | Scoop: ... | Manual: ..."
// directly as commands, which could never succeed.
func installTool(tc *LanguageToolchain, tool string) error {
	candidates := tc.ToolInstallers[tool]
	if len(candidates) == 0 {
		if hint, ok := tc.ManualInstallHints[tool]; ok {
			return fmt.Errorf("%s has no automatic installer available. %s", tool, hint)
		}
		return fmt.Errorf("no installation method configured for %s", tool)
	}

	var lastErr error
	for _, installer := range candidates {
		resolvedBinary, err := findToolBinary(installer.Binary)
		if err != nil {
			lastErr = fmt.Errorf("%s not found", installer.Binary)
			continue
		}

		cmd := exec.CommandContext(context.Background(), resolvedBinary, installer.Args...)
		output, err := cmd.CombinedOutput()
		if err != nil {
			return fmt.Errorf("install %s via %s: %w\n%s", tool, installer.Binary, err, string(output))
		}
		return nil
	}

	if hint, ok := tc.ManualInstallHints[tool]; ok {
		return fmt.Errorf("could not install %s automatically (%v). %s", tool, lastErr, hint)
	}
	return fmt.Errorf("could not install %s automatically: %v", tool, lastErr)
}

func missingTools(tc *LanguageToolchain) []string {
	var missing []string
	if tc.LSP != nil {
		if _, err := findToolBinary(tc.LSP.Command); err != nil {
			missing = append(missing, tc.LSP.Command)
		}
	}
	if tc.Formatter != nil {
		if _, err := findToolBinary(tc.Formatter.Command); err != nil {
			missing = append(missing, tc.Formatter.Command)
		}
	}
	return missing
}

func installCommandFor(binary string) string {
	switch binary {
	case "go":
		switch runtime.GOOS {
		case "windows":
			return "winget install GoLang.Go"
		case "darwin":
			return "brew install go"
		case "linux":
			return "sudo apt install golang-go"
		}
	}
	return "Visit the language's official download page"
}
