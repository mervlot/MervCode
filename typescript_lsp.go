package main

import (
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

// ============================================================================
// TypeScript Language Server helpers.
//
// typescript-language-server is only the LSP wrapper; it still needs a real
// TypeScript install (`typescript/lib/tsserver.js`) for language intelligence.
// Many JS/JSX-only projects do not list `typescript` in their own package.json,
// so the server exits during initialize with:
//   Could not find a valid TypeScript installation ... tsserver.path
//
// MervCode itself already depends on TypeScript for its frontend build, so we
// provide that tsserver.js as a fallback. Workspace-local TypeScript still wins
// when present; this only keeps plain JS/JSX projects from having zero hover /
// completion support.
// ============================================================================

func typescriptInitializationOptions() map[string]any {
	path, ok := findFallbackTSServerPath()
	if !ok {
		log.Printf("[typescript-lsp] no fallback tsserver.js found; workspace must provide typescript")
		return nil
	}

	log.Printf("[typescript-lsp] using fallback tsserver.path=%q", path)
	return map[string]any{
		"tsserver": map[string]any{
			"path": path,
		},
		// These mirror the Monaco compiler defaults for the TS family and help
		// JavaScript/JSX-only workspaces behave like a React editor even when they
		// do not ship a tsconfig/jsconfig yet.
		"preferences": map[string]any{
			"includePackageJsonAutoImports": "auto",
		},
	}
}

func findFallbackTSServerPath() (string, bool) {
	candidates := candidateTSServerPaths()
	seen := make(map[string]struct{}, len(candidates))

	for _, candidate := range candidates {
		candidate = filepath.Clean(candidate)
		if _, duplicate := seen[strings.ToLower(candidate)]; duplicate {
			continue
		}
		seen[strings.ToLower(candidate)] = struct{}{}

		if info, err := os.Stat(candidate); err == nil && !info.IsDir() {
			return candidate, true
		}
	}

	return "", false
}

func candidateTSServerPaths() []string {
	var roots []string
	if wd, err := os.Getwd(); err == nil {
		roots = append(roots, wd)
	}
	if exe, err := os.Executable(); err == nil {
		roots = append(roots, filepath.Dir(exe))
	}

	var candidates []string
	for _, root := range roots {
		// Source/dev layout: <repo>/frontend/node_modules/typescript/...
		candidates = append(candidates, filepath.Join(root, "frontend", "node_modules", "typescript", "lib", tsserverFileName()))
		// Production or package-manager layout: <root>/node_modules/typescript/...
		candidates = append(candidates, filepath.Join(root, "node_modules", "typescript", "lib", tsserverFileName()))
		if parent := filepath.Dir(root); parent != root {
			candidates = append(candidates, filepath.Join(parent, "frontend", "node_modules", "typescript", "lib", tsserverFileName()))
			candidates = append(candidates, filepath.Join(parent, "node_modules", "typescript", "lib", tsserverFileName()))
		}
	}

	if npmRoot, ok := globalNPMRoot(); ok {
		candidates = append(candidates, filepath.Join(npmRoot, "typescript", "lib", tsserverFileName()))
	}

	return candidates
}

func tsserverFileName() string {
	if runtime.GOOS == "windows" {
		// typescript-language-server's tsserver.path expects the JS entrypoint,
		// not the tsserver.cmd shim.
		return "tsserver.js"
	}
	return "tsserver.js"
}

func globalNPMRoot() (string, bool) {
	npm, err := findToolBinary("npm")
	if err != nil {
		return "", false
	}
	cmd := exec.Command(npm, "root", "-g")
	out, err := cmd.Output()
	if err != nil {
		return "", false
	}
	root := strings.TrimSpace(string(out))
	return root, root != ""
}
