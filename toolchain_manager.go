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

	// Install missing tools
	for _, tool := range missingTools(tc) {
		wailsRuntime.EventsEmit(a.ctx, "toolchain:installProgress", map[string]any{
			"tool":    tool,
			"status":  "installing",
			"message": fmt.Sprintf("Installing %s...", tool),
		})

		installCmd, ok := tc.ToolInstallMethods[tool]
		if !ok {
			wailsRuntime.EventsEmit(a.ctx, "toolchain:installProgress", map[string]any{
				"tool":    tool,
				"status":  "error",
				"message": fmt.Sprintf("No installation method for %s", tool),
			})
			continue
		}

		cmd := exec.CommandContext(context.Background(), tc.RuntimeBinary, parseArgs(installCmd)...)
		if output, err := cmd.CombinedOutput(); err != nil {
			wailsRuntime.EventsEmit(a.ctx, "toolchain:installProgress", map[string]any{
				"tool":    tool,
				"status":  "error",
				"message": fmt.Sprintf("Failed to install %s: %v\n%s", tool, err, string(output)),
			})
			return fmt.Errorf("install %s: %w\n%s", tool, err, string(output))
		}

		wailsRuntime.EventsEmit(a.ctx, "toolchain:installProgress", map[string]any{
			"tool":    tool,
			"status":  "success",
			"message": fmt.Sprintf("%s installed successfully", tool),
		})
	}

	return nil
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
	return fmt.Sprintf("Visit the language's official download page")
}

// parseArgs splits an install command string like "go install pkg@latest"
// into its parts for exec.CommandContext.
func parseArgs(cmd string) []string {
	parts := splitCmd(cmd)
	if len(parts) <= 1 {
		return nil
	}
	return parts[1:]
}

func splitCmd(cmd string) []string {
	var args []string
	var current []byte
	inQuote := false
	for i := 0; i < len(cmd); i++ {
		c := cmd[i]
		if c == '"' || c == '\'' {
			inQuote = !inQuote
			continue
		}
		if c == ' ' && !inQuote {
			if len(current) > 0 {
				args = append(args, string(current))
				current = nil
			}
			continue
		}
		current = append(current, c)
	}
	if len(current) > 0 {
		args = append(args, string(current))
	}
	return args
}