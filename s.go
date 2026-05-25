package main

import (
	"context"
	"fmt"
	"os"
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
func (a *App) Quit() {
    runtime.Quit(a.ctx)
}
