package main

import (
	"os"
	"path/filepath"
	"strings"
	"sync"
)

// ============================================================================
// Minimal workspace intelligence: resolving which project "owns" a file.
//
// Every language server needs to be spawned with a working directory/rootUri
// that actually contains its project files (node_modules, go.sum, etc). Up
// until now the whole app passed a single global "workspace root" (whatever
// folder was opened in the explorer) to every LSP session, regardless of
// language. That breaks the moment a repo isn't itself a single package:
// a monorepo with `frontend/package.json` + `backend/go.mod` would spawn
// typescript-language-server rooted at the repo root, which has no
// package.json/node_modules of its own, so imports and interfaces never
// resolve.
//
// findNearestMarker walks up from a file's directory looking for the
// language's marker files (see `Markers` in toolchain.go) - the same
// technique VS Code, Zed and every serious LSP client use. This is what
// turns a single opened folder into a real multi-root workspace: a Go file
// and a TypeScript file in different subdirectories each get routed to
// their own server instance, rooted at their own nearest project - without
// any explicit "multi-root" configuration from the user.
// ============================================================================

type workspaceManager struct {
	mu    sync.RWMutex
	cache map[string]string // "<lang>::<dir>" -> resolved project root
}

var workspace = &workspaceManager{cache: make(map[string]string)}

// ResolveProjectRoot returns the nearest ancestor directory of filePath that
// contains one of lang's marker files. fallbackRoot (typically the folder
// open in the explorer) is used as both the search boundary and the final
// fallback when no marker is found, so resolution never escapes the
// workspace the user actually opened.
func (a *App) ResolveProjectRoot(lang, filePath, fallbackRoot string) (string, error) {
	return workspace.resolve(lang, filePath, fallbackRoot), nil
}

// InvalidateWorkspaceCache clears cached project-root lookups. Call this
// after operations that create/remove marker files (git checkout, `npm
// init`, `go mod init`, pulling a branch, ...) so newly-appeared projects
// are picked up without restarting MervCode.
func (a *App) InvalidateWorkspaceCache() {
	workspace.mu.Lock()
	defer workspace.mu.Unlock()
	workspace.cache = make(map[string]string)
}

func (w *workspaceManager) resolve(lang, filePath, fallbackRoot string) string {
	dir := filepath.Dir(filePath)

	tc := GetToolchain(lang)
	if tc == nil || len(tc.Markers) == 0 {
		return firstNonEmpty(fallbackRoot, dir)
	}

	key := lang + "::" + dir
	w.mu.RLock()
	if cached, ok := w.cache[key]; ok {
		w.mu.RUnlock()
		return cached
	}
	w.mu.RUnlock()

	root := findNearestMarker(dir, tc.Markers, fallbackRoot)

	w.mu.Lock()
	w.cache[key] = root
	w.mu.Unlock()

	return root
}

// findNearestMarker walks upward from dir, stopping at the first ancestor
// containing any of markers. The walk never goes above fallbackRoot (if
// given) so an unrelated marker file higher up the filesystem (e.g. in the
// user's home directory) can never be mistaken for the project root; if
// nothing is found by the time fallbackRoot itself has been checked, it
// walks all the way to the filesystem root to support single-file / no
// workspace-open sessions, same as VS Code's single-file mode.
func findNearestMarker(dir string, markers []string, fallbackRoot string) string {
	current := filepath.Clean(dir)
	boundary := ""
	if strings.TrimSpace(fallbackRoot) != "" {
		boundary = filepath.Clean(fallbackRoot)
	}

	for {
		for _, marker := range markers {
			if _, err := os.Stat(filepath.Join(current, marker)); err == nil {
				return current
			}
		}

		if boundary != "" && current == boundary {
			break
		}

		parent := filepath.Dir(current)
		if parent == current {
			break // reached filesystem root
		}
		current = parent
	}

	return firstNonEmpty(fallbackRoot, dir)
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}
