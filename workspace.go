package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

// workspaceManager caches resolved project roots per language and source
// directory. Project roots are always absolute directories so they can safely
// be used as both an LSP process working directory and an initialize rootUri.
type workspaceManager struct {
	mu    sync.RWMutex
	cache map[string]string // "<lang>::<file dir>::<fallback root>" -> project root
}

var workspace = &workspaceManager{cache: make(map[string]string)}

// ResolveProjectRoot returns the nearest ancestor of filePath containing a
// language marker. The search continues to the filesystem root so nested
// workspaces and projects opened through a subdirectory are detected. If no
// marker exists, it uses the absolute opened-workspace directory when one was
// supplied; otherwise it uses the document's own directory.
func (a *App) ResolveProjectRoot(lang, filePath, fallbackRoot string) (string, error) {
	return workspace.resolve(lang, filePath, fallbackRoot)
}

// InvalidateWorkspaceCache clears cached project-root lookups. Call this
// after operations that create/remove marker files (git checkout, `npm init`,
// `go mod init`, pulling a branch, ...) so newly-appeared projects are picked
// up without restarting MervCode.
func (a *App) InvalidateWorkspaceCache() {
	workspace.mu.Lock()
	defer workspace.mu.Unlock()
	workspace.cache = make(map[string]string)
}

func (w *workspaceManager) resolve(lang, filePath, fallbackRoot string) (string, error) {
	filePath, err := absolutePath(filePath)
	if err != nil {
		return "", fmt.Errorf("resolve LSP document path: %w", err)
	}
	dir := filepath.Dir(filePath)

	fallback := dir
	// A relative fallback (especially ".", which is the desktop app's own
	// process directory rather than anything the user opened) is not usable
	// as a project root, so the document's own directory is kept as the
	// fallback in that case. Any other non-empty value is the folder the
	// user actually opened in the IDE and always wins over the file's own
	// directory once no marker is found - this is the case single-file
	// nested source trees like KPM/src/main/kotlin/... rely on.
	if trimmed := strings.TrimSpace(fallbackRoot); trimmed != "" && filepath.Clean(trimmed) != "." {
		if workspaceDir, err := absoluteDirectory(trimmed); err == nil {
			fallback = workspaceDir
		}
	}

	tc := GetToolchain(lang)
	if tc == nil {
		return "", fmt.Errorf("no toolchain configured for %s", lang)
	}
	if len(tc.Markers) == 0 {
		return fallback, nil
	}

	key := lang + "::" + dir + "::" + fallback
	w.mu.RLock()
	if cached, ok := w.cache[key]; ok {
		w.mu.RUnlock()
		return cached, nil
	}
	w.mu.RUnlock()

	root := findNearestMarker(dir, tc.Markers)
	if root == "" {
		root = fallback
	}

	w.mu.Lock()
	w.cache[key] = root
	w.mu.Unlock()
	return root, nil
}

// absolutePath canonicalizes a document URI filesystem path without requiring
// the file to exist (new/unsaved documents are valid LSP inputs).
func absolutePath(path string) (string, error) {
	if path == "" {
		return "", fmt.Errorf("document path is empty")
	}
	absolute, err := filepath.Abs(path)
	if err != nil {
		return "", err
	}
	return filepath.Clean(absolute), nil
}

// absoluteDirectory validates an existing workspace directory before it is
// used as an LSP working directory.
func absoluteDirectory(path string) (string, error) {
	absolute, err := absolutePath(path)
	if err != nil {
		return "", err
	}
	info, err := os.Stat(absolute)
	if err != nil {
		return "", err
	}
	if !info.IsDir() {
		return "", fmt.Errorf("%s is not a directory", absolute)
	}
	return absolute, nil
}

func findNearestMarker(dir string, markers []string) string {
	current := filepath.Clean(dir)
	for {
		for _, marker := range markers {
			markerPath := filepath.Join(current, marker)
			if info, err := os.Stat(markerPath); err == nil && !info.IsDir() {
				return current
			}
		}

		parent := filepath.Dir(current)
		if parent == current {
			return ""
		}
		current = parent
	}
}
