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
}

type FormatterConfig struct {
	Command string   `json:"command"`
	Args    []string `json:"args"`
	Stdin   bool     `json:"stdin"`
}

type LanguageToolchain struct {
	ID                 string            `json:"id"`
	Name               string            `json:"name"`
	LSP                *LSPConfig        `json:"lsp,omitempty"`
	Formatter          *FormatterConfig  `json:"formatter,omitempty"`
	Markers            []string          `json:"markers"`
	RuntimeBinary      string            `json:"runtimeBinary"`
	RuntimeInstallURL  string            `json:"runtimeInstallUrl"`
	ToolInstallMethods map[string]string `json:"toolInstallMethods"`
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
			ToolInstallMethods: map[string]string{
				"gopls": "go install golang.org/x/tools/gopls@latest",
				"gofmt": "Comes with Go runtime",
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
			ToolInstallMethods: map[string]string{
				"typescript-language-server": "npm install -g typescript typescript-language-server",
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
			ToolInstallMethods: map[string]string{
				"jdtls": "Homebrew: brew install jdtls | Scoop: scoop install jdtls | Manual: https://download.eclipse.org/jdtls/",
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
			ToolInstallMethods: map[string]string{
				"kotlin-language-server": "Homebrew: brew install kotlin-language-server | Scoop: scoop install kotlin-language-server | Manual: https://github.com/fwcd/kotlin-language-server/releases",
			},
		},
	}
}

func GetToolchain(lang string) *LanguageToolchain {
	return toolchains[lang]
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
