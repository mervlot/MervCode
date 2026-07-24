package main

import (
	"bytes"
	"fmt"
	"os/exec"
	"strings"
)

type LSPConfig struct {
	Command   string   `json:"command"`
	Args      []string `json:"args"`
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
			Markers:            []string{"go.mod"},
			RuntimeBinary:      "go",
			RuntimeInstallURL:  "https://go.dev/dl/",
			ToolInstallMethods: map[string]string{
				"gopls": "go install golang.org/x/tools/gopls@latest",
				"gofmt": "Comes with Go runtime",
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
	cmd := exec.Command(f.Command, f.Args...)

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
