package main

import (
	"bufio"
	"context"
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"merv-code/types"

	"github.com/fsnotify/fsnotify"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx           context.Context
	watcher       *fsnotify.Watcher
	watcherCtx    context.Context
	watcherCancel context.CancelFunc
	watcherMu     sync.Mutex
	currentRoot   string

	lspMu      sync.Mutex
	lspClients map[string]*lspClient
}

func NewApp() *App {
	return &App{
		lspClients: make(map[string]*lspClient),
	}
}

func (a *App) Startup(ctx context.Context) {
	a.ctx = ctx
}

// StartWatcher sets up a recursive file watcher on the targeted workspace path
func (a *App) StartWatcher(rootPath string) error {
	a.watcherMu.Lock()
	defer a.watcherMu.Unlock()

	// Stop any existing watchers first
	a.stopWatcherInternal()

	// Shut down LSP clients from the previous workspace
	a.closeAllLSPClients()

	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return err
	}
	a.watcher = watcher
	a.currentRoot = rootPath
	a.watcherCtx, a.watcherCancel = context.WithCancel(a.ctx)

	// Recursively collect directories and register them
	err = filepath.Walk(rootPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil // Skip items with access noise instead of crashing
		}
		if info.IsDir() && !strings.Contains(path, ".git") && !strings.Contains(path, "node_modules") {
			_ = watcher.Add(path)
		}
		return nil
	})
	if err != nil {
		watcher.Close()
		return err
	}

	// Background listener thread loop
	go func() {
		var (
			timerMu sync.Mutex
			timer   *time.Timer
		)

		for {
			select {
			case <-a.watcherCtx.Done():
				watcher.Close()
				return
			case event, ok := <-watcher.Events:
				if !ok {
					return
				}

				// Skip standard noisy permission-only modifications or temp files
				if event.Has(fsnotify.Chmod) || strings.HasSuffix(event.Name, "~") {
					continue
				}

				// If a new directory layout pops up, subscribe recursively automatically
				if event.Has(fsnotify.Create) {
					if info, err := os.Stat(event.Name); err == nil && info.IsDir() {
						_ = watcher.Add(event.Name)
					}
				}

				// Debounce successive filesystem operations to prevent UI thread flooding
				timerMu.Lock()
				if timer != nil {
					timer.Stop()
				}
				timer = time.AfterFunc(200*time.Millisecond, func() {
					runtime.EventsEmit(a.ctx, "workspace-changed", map[string]string{
						"type": event.Op.String(),
						"path": event.Name,
					})
				})
				timerMu.Unlock()

			case <-watcher.Errors:
				// Recover silently from system signal errors
			}
		}
	}()

	return nil
}

func (a *App) FolderDialog() (string, error) {
	dir, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select a folder",
	})
	return dir, err
}

func (a *App) ReadDir(path string) ([]types.FileItem, error) {
	entries, err := os.ReadDir(path)
	if err != nil {
		return nil, err
	}

	var items []types.FileItem
	for _, entry := range entries {
		fullPath := filepath.Join(path, entry.Name())
		items = append(items, types.FileItem{
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

func (a *App) CreateFile(path string) error {
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	return f.Close()
}

func (a *App) CreateFolder(path string) error {
	return os.MkdirAll(path, 0o755)
}

func (a *App) DeletePath(path string) error {
	return os.RemoveAll(path)
}

func (a *App) RenamePath(oldPath, newPath string) error {
	return a.Rename(oldPath, newPath)
}

func (a *App) Delete(path string) error {
	return os.RemoveAll(path)
}

func (a *App) Rename(oldPath, newPath string) error {
	err := os.Rename(oldPath, newPath)
	if err == nil {
		return nil
	}

	info, err := os.Stat(oldPath)
	if err != nil {
		return err
	}

	if info.IsDir() {
		return moveDir(oldPath, newPath)
	}
	return moveFile(oldPath, newPath)
}

func moveFile(source, dest string) error {
	srcFile, err := os.Open(source)
	if err != nil {
		return err
	}
	defer srcFile.Close()

	if err := os.MkdirAll(filepath.Dir(dest), 0o755); err != nil {
		return err
	}

	destFile, err := os.Create(dest)
	if err != nil {
		return err
	}
	defer destFile.Close()

	if _, err = io.Copy(destFile, srcFile); err != nil {
		return err
	}

	_ = destFile.Sync()
	srcFile.Close()
	destFile.Close()

	return os.Remove(source)
}

func moveDir(source, dest string) error {
	err := filepath.Walk(source, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		rel, err := filepath.Rel(source, path)
		if err != nil {
			return err
		}
		targetPath := filepath.Join(dest, rel)

		if info.IsDir() {
			return os.MkdirAll(targetPath, 0o755)
		}
		return moveFile(path, targetPath)
	})
	if err != nil {
		return err
	}

	return os.RemoveAll(source)
}

func (a *App) StopWatcher() {
	a.watcherMu.Lock()
	defer a.watcherMu.Unlock()
	a.stopWatcherInternal()
}

func (a *App) stopWatcherInternal() {
	if a.watcherCancel != nil {
		a.watcherCancel()
		a.watcherCancel = nil
	}
	if a.watcher != nil {
		_ = a.watcher.Close()
		a.watcher = nil
	}
	a.currentRoot = ""
}

func (a *App) WriteFile(path string, content string) error {
	// 0644 gives read/write permissions to the owner, and read permissions to everyone else
	return os.WriteFile(path, []byte(content), 0o644)
}

func (a *App) ReadFileBytes(path string) ([]byte, error) {
	return os.ReadFile(path)
}

func (a *App) ReadImageFile(path string) (string, error) {
	bytes, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	// Safely encode direct binary bytes to base64 string
	return base64.StdEncoding.EncodeToString(bytes), nil
}

// InspectAndReadFile analyzes a file and safely prepares it for frontend consumption
func (a *App) InspectAndReadFile(path string) (*types.FileResponse, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	// 1. Read first 512 bytes for MIME header sniffing
	buffer := make([]byte, 512)
	n, err := file.Read(buffer)
	if err != nil && n == 0 {
		// Completely empty files default directly to the text editor
		return &types.FileResponse{Category: "editor", Content: ""}, nil
	}

	mimeType := http.DetectContentType(buffer[:n])
	ext := strings.ToLower(filepath.Ext(path))

	var category string

	// 2. Classify the file using both headers and standard extensions
	switch {
	case strings.HasPrefix(mimeType, "image/") || ext == ".svg" || ext == ".ico" || ext == ".webp":
		category = "image"
	case strings.HasPrefix(mimeType, "video/"):
		category = "video"
	case strings.HasPrefix(mimeType, "audio/"):
		category = "audio"
	case mimeType == "application/pdf" || ext == ".pdf":
		category = "pdf"
	case ext == ".csv" || ext == ".tsv" || ext == ".xlsx" || ext == ".xls":
		category = "spreadsheet"
	default:
		// Fallback structural check to safeguard text decoding
		isBinary := false
		for i := 0; i < n; i++ {
			if buffer[i] == 0x00 {
				isBinary = true
				break
			}
		}
		if !isBinary && utf8.Valid(buffer[:n]) {
			category = "editor"
		} else {
			category = "binary"
		}
	}

	// 3. Package the payload securely based on the determined viewer category
	if category == "editor" || category == "spreadsheet" {
		// Read the entire file as a normal text layout
		fullBytes, err := os.ReadFile(path)
		if err != nil {
			return nil, err
		}
		return &types.FileResponse{
			Category: category,
			Content:  string(fullBytes),
		}, nil
	}

	// For media canvases (images, videos, audio, or PDFs), encode the full file to base64
	fullBytes, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	// Normalize standard MIME types for file extensions that http.DetectContentType might overlook
	finalMime := mimeType
	switch ext {
	case ".svg":
		finalMime = "image/svg+xml"
	case ".pdf":
		finalMime = "application/pdf"
	}

	base64Str := base64.StdEncoding.EncodeToString(fullBytes)
	dataURL := fmt.Sprintf("data:%s;base64,%s", finalMime, base64Str)

	return &types.FileResponse{
		Category: category,
		Content:  dataURL,
	}, nil
}

// ============================================================
// SEARCH — workspace-wide text search, powers the Search sidebar panel
// ============================================================

const (
	maxSearchResults = 300
	maxSearchFileMB  = 4
)

var skippedSearchDirs = map[string]bool{
	".git":         true,
	"node_modules": true,
	"dist":         true,
	"build":        true,
	".next":        true,
	"vendor":       true,
}

// SearchInWorkspace walks rootPath and returns line-level matches for query.
// It skips common noisy/large directories and binary files, and stops early
// once maxSearchResults is reached so a huge repo can't hang the UI.
func (a *App) SearchInWorkspace(rootPath string, query string) ([]types.SearchMatch, error) {
	if strings.TrimSpace(query) == "" {
		return []types.SearchMatch{}, nil
	}

	lowerQuery := strings.ToLower(query)
	var results []types.SearchMatch

	err := filepath.Walk(rootPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil // skip unreadable entries instead of aborting the whole search
		}
		if len(results) >= maxSearchResults {
			return filepath.SkipDir
		}
		if info.IsDir() {
			if skippedSearchDirs[info.Name()] {
				return filepath.SkipDir
			}
			return nil
		}
		if info.Size() > maxSearchFileMB*1024*1024 {
			return nil
		}

		f, err := os.Open(path)
		if err != nil {
			return nil
		}
		defer f.Close()

		// Quick binary sniff on the first chunk before scanning the whole file
		head := make([]byte, 512)
		n, _ := f.Read(head)
		for i := 0; i < n; i++ {
			if head[i] == 0x00 {
				return nil
			}
		}
		_, _ = f.Seek(0, io.SeekStart)

		scanner := bufio.NewScanner(f)
		scanner.Buffer(make([]byte, 64*1024), 1024*1024)
		lineNum := 0
		for scanner.Scan() {
			lineNum++
			line := scanner.Text()
			idx := strings.Index(strings.ToLower(line), lowerQuery)
			if idx >= 0 {
				preview := strings.TrimSpace(line)
				if len(preview) > 200 {
					preview = preview[:200] + "…"
				}
				results = append(results, types.SearchMatch{
					Path:    path,
					Line:    lineNum,
					Column:  idx + 1,
					Preview: preview,
				})
				if len(results) >= maxSearchResults {
					return filepath.SkipDir
				}
			}
		}
		_ = scanner.Err()
		return nil
	})
	if err != nil {
		return results, err
	}
	return results, nil
}

// ============================================================
// SOURCE CONTROL — thin wrapper around the system `git` binary
// ============================================================

// GitStatus reports repo status for rootPath using `git status --porcelain`.
// If git isn't installed or rootPath isn't a repo, IsRepo is simply false —
// this never returns an error for that case so the panel can render a clean
// "not a repo" state instead of an error screen.
func (a *App) GitStatus(rootPath string) (*types.GitStatusResult, error) {
	result := &types.GitStatusResult{IsRepo: false, Files: []types.GitFileStatus{}}

	if _, err := exec.LookPath("git"); err != nil {
		return result, nil
	}

	checkCmd := exec.Command("git", "-C", rootPath, "rev-parse", "--is-inside-work-tree")
	if err := checkCmd.Run(); err != nil {
		return result, nil
	}
	result.IsRepo = true

	branchOut, err := exec.Command("git", "-C", rootPath, "branch", "--show-current").Output()
	if err == nil {
		result.Branch = strings.TrimSpace(string(branchOut))
	}

	statusOut, err := exec.Command("git", "-C", rootPath, "status", "--porcelain").Output()
	if err != nil {
		return result, nil
	}

	lines := strings.Split(string(statusOut), "\n")
	for _, line := range lines {
		if strings.TrimSpace(line) == "" || len(line) < 4 {
			continue
		}
		status := strings.TrimSpace(line[:2])
		rel := strings.TrimSpace(line[3:])
		result.Files = append(result.Files, types.GitFileStatus{
			Path:   filepath.Join(rootPath, rel),
			Rel:    rel,
			Status: status,
		})
	}

	return result, nil
}

// ============================================================
// LSP — Language Server Protocol proxy
// ============================================================

func (a *App) LSPOpenFile(lang, path, content string) error {
	return a.lspOpenFile(lang, path, content)
}

func (a *App) LSPChangeFile(lang, path, content string, version int) error {
	return a.lspChangeFile(lang, path, content, version)
}

func (a *App) LSPCloseFile(lang, path string) error {
	return a.lspCloseFile(lang, path)
}

func (a *App) LSPHover(lang, path string, line, col int) (*types.LSPHoverResult, error) {
	return a.lspHover(lang, path, line, col)
}

func (a *App) LSPCompletion(lang, path string, line, col int) ([]types.LSPCompletionItem, error) {
	return a.lspCompletion(lang, path, line, col)
}

func (a *App) LSPDefinition(lang, path string, line, col int) (*types.LSPLocation, error) {
	return a.lspDefinition(lang, path, line, col)
}

func (a *App) LSPReferences(lang, path string, line, col int) ([]types.LSPLocation, error) {
	return a.lspReferences(lang, path, line, col)
}
