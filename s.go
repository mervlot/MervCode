package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx context.Context
}

type FileItem struct {
	Name     string     `json:"name"`
	Path     string     `json:"path"`
	IsDir    bool       `json:"isDir"`
	Children []FileItem `json:"children,omitempty"`
}

type Diagnostic struct {
	Line      int    `json:"line"`
	Column    int    `json:"column"`
	EndLine   int    `json:"endLine"`
	EndColumn int    `json:"endColumn"`
	Message   string `json:"message"`
	Severity  string `json:"severity"`
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

func (a *App) FolderDialog() (string, error) {
	dir, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select a folder",
	})

	return dir, err
}

func (a *App) ReadDir(path string) ([]FileItem, error) {
	entries, err := os.ReadDir(path)
	if err != nil {
		return nil, err
	}

	var items []FileItem

	for _, entry := range entries {
		fullPath := filepath.Join(path, entry.Name())

		items = append(items, FileItem{
			Name:  entry.Name(),
			Path:  fullPath,
			IsDir: entry.IsDir(),
		})
	}

	return items, nil
}

func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s 😎", name)
}

func (a *App) ReadFile(path string) (string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// =======================
// ESLINT BACKEND BRIDGE
// =======================
func (a *App) LintCode(code string) ([]Diagnostic, error) {
	fmt.Println("===== LINT START =====")

	cmd := exec.Command("node", "backend/eslint-runner.js")

	stdin, err := cmd.StdinPipe()
	if err != nil {
		fmt.Println("[ERROR] stdin pipe:", err)
		return nil, err
	}

	outPipe, err := cmd.StdoutPipe()
	if err != nil {
		fmt.Println("[ERROR] stdout pipe:", err)
		return nil, err
	}

	if err := cmd.Start(); err != nil {
		fmt.Println("[ERROR] start:", err)
		return nil, err
	}

	// write input
	_, err = stdin.Write([]byte(code))
	if err != nil {
		fmt.Println("[ERROR] write:", err)
		return nil, err
	}
	stdin.Close()

	// read output
	out, err := io.ReadAll(outPipe)
	if err != nil {
		fmt.Println("[ERROR] read stdout:", err)
		return nil, err
	}

	err = cmd.Wait()
	if err != nil {
		fmt.Println("[ERROR] process:", err)
		return nil, err
	}

	fmt.Println("RAW OUTPUT:")
	fmt.Println(string(out))

	var result []Diagnostic
	if err := json.Unmarshal(out, &result); err != nil {
		fmt.Println("[ERROR] json:", err)
		return nil, err
	}

	fmt.Println("===== LINT END =====")
	return result, nil
}
func (a *App) Quit() {
	runtime.Quit(a.ctx)
}