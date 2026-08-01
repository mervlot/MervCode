package main

import (
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"strconv"
	"strings"
)

// ============================================================================
// Resolves a textual reference found inside a file - an import/require
// specifier, a relative or absolute path, or a file:// URI - to a real file
// on disk, so the editor can offer Ctrl/Cmd+Click "open file" on import
// statements and file paths, the way VS Code does. See
// editor/monaco/linkProvider.ts for the Monaco LinkProvider that calls this.
// ============================================================================

// candidateExtensions covers the languages MervCode ships syntax/LSP
// support for, plus common config/doc formats developers reference from
// imports, "extends" fields, HTML/CSS, and Markdown links. Tried in order
// when ref has no extension of its own (mirroring Node/TS extension-less
// import resolution just enough for click-to-open).
var candidateExtensions = []string{
	".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
	".go", ".java", ".kt", ".kts",
	".json", ".jsonc", ".yaml", ".yml", ".toml",
	".css", ".scss", ".less", ".html",
	".md", ".mdx",
}

type ResolvedReference struct {
	// Kind is "file" (open in the editor), "url" (open in the system
	// browser), or "unresolved" (nothing on disk matched - the caller
	// should silently ignore it rather than error out on a false-positive
	// candidate string).
	Kind   string `json:"kind"`
	Target string `json:"target"`
	Line   int    `json:"line,omitempty"`
}

// ResolveFileReference resolves ref - found verbatim inside fromFile - to
// a file on disk. It mirrors just enough of Node/TS module resolution
// (extension-less imports, directory index files) and common stack-trace
// formatting ("path:line:col") to make Ctrl+Click work on typical import
// paths and file references without pulling in a full module resolver.
func (a *App) ResolveFileReference(fromFile, ref string) (*ResolvedReference, error) {
	ref = strings.TrimSpace(ref)
	if ref == "" {
		return &ResolvedReference{Kind: "unresolved"}, nil
	}

	if strings.HasPrefix(ref, "http://") || strings.HasPrefix(ref, "https://") || strings.HasPrefix(ref, "mailto:") {
		return &ResolvedReference{Kind: "url", Target: ref}, nil
	}

	if strings.HasPrefix(ref, "file://") {
		if p, err := filePathFromURI(ref); err == nil {
			ref = p
		}
	}

	path, line, _ := splitLineColSuffix(ref)
	if path == "" {
		return &ResolvedReference{Kind: "unresolved"}, nil
	}

	candidate := path
	if !filepath.IsAbs(candidate) {
		candidate = filepath.Join(filepath.Dir(fromFile), candidate)
	}
	candidate = filepath.Clean(candidate)

	if resolved, ok := resolveExistingFile(candidate); ok {
		return &ResolvedReference{Kind: "file", Target: resolved, Line: line}, nil
	}
	return &ResolvedReference{Kind: "unresolved"}, nil
}

// resolveExistingFile tries candidate as-is, then with each known
// extension appended, then (if candidate is itself a directory) an index
// file inside it.
func resolveExistingFile(candidate string) (string, bool) {
	if info, err := os.Stat(candidate); err == nil {
		if !info.IsDir() {
			return candidate, true
		}
		return resolveIndexFile(candidate)
	}

	for _, ext := range candidateExtensions {
		if info, err := os.Stat(candidate + ext); err == nil && !info.IsDir() {
			return candidate + ext, true
		}
	}

	return "", false
}

func resolveIndexFile(dir string) (string, bool) {
	for _, ext := range candidateExtensions {
		p := filepath.Join(dir, "index"+ext)
		if info, err := os.Stat(p); err == nil && !info.IsDir() {
			return p, true
		}
	}
	return "", false
}

var lineColSuffix = regexp.MustCompile(`:(\d+)(?::(\d+))?$`)

// splitLineColSuffix strips a trailing ":line" or ":line:col" suffix, as
// commonly seen in stack traces and terminal output (e.g.
// "src/app.ts:42:5"). Safe on Windows drive letters ("C:\foo") since the
// pattern only matches a colon immediately followed by digits at the very
// end of the string, which a drive letter's trailing backslash never is.
func splitLineColSuffix(ref string) (path string, line int, col int) {
	loc := lineColSuffix.FindStringSubmatchIndex(ref)
	if loc == nil {
		return ref, 0, 0
	}
	path = ref[:loc[0]]
	line, _ = strconv.Atoi(ref[loc[2]:loc[3]])
	if loc[4] != -1 {
		col, _ = strconv.Atoi(ref[loc[4]:loc[5]])
	}
	return path, line, col
}

// filePathFromURI converts a file:// URI back to an OS path - the inverse
// of the frontend's toFileUri in editor/lsp/uri.ts.
func filePathFromURI(uri string) (string, error) {
	parsed, err := url.Parse(uri)
	if err != nil {
		return "", err
	}
	p := parsed.Path
	if runtime.GOOS == "windows" && len(p) > 2 && p[0] == '/' && p[2] == ':' {
		p = p[1:]
	}
	return filepath.FromSlash(p), nil
}
