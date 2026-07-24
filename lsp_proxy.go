package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"merv-code/types"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type lspClient struct {
	mu      sync.Mutex
	cmd     *exec.Cmd
	stdin   io.WriteCloser
	stdout  io.ReadCloser
	reader  *bufio.Reader
	seq     int64
	pending map[int64]chan<- json.RawMessage
	done    chan struct{}
	lang    string
	appCtx  *App
	rootURI string
}

// lspServerGroup returns the group key for an LSP server instance.
// Currently each language gets its own server.
func lspServerGroup(lang string) string {
	return lang
}

func (a *App) lspCommand(lang string) (string, []string) {
	tc := GetToolchain(lang)
	if tc == nil || tc.LSP == nil {
		return "", nil
	}
	return tc.LSP.Command, tc.LSP.Args
}

func (a *App) getLSPClient(lang string) *lspClient {
	a.lspMu.Lock()
	defer a.lspMu.Unlock()
	return a.lspClients[lspServerGroup(lang)]
}

// getLSPClientForFile returns the running LSP client that serves lang
// (there is one per server group for the whole workspace — see
// lspServerGroup — not one per file or per sub-project; the server itself
// resolves each file's nearest tsconfig.json/go.mod internally).
func (a *App) getLSPClientForFile(lang, path string) *lspClient {
	return a.getLSPClient(lang)
}

func (a *App) ensureLSPClient(lang, root string) (*lspClient, error) {
	key := lspServerGroup(lang)

	a.lspMu.Lock()

	if cl, ok := a.lspClients[key]; ok {
		a.lspMu.Unlock()
		return cl, nil
	}

	cmdName, args := a.lspCommand(lang)
	if cmdName == "" {
		a.lspMu.Unlock()
		return nil, fmt.Errorf("no LSP server configured for %s", lang)
	}

	// Check if tools are installed before attempting to start LSP
	toolStatus, err := a.CheckLanguageTools(lang)
	if err != nil {
		a.lspMu.Unlock()
		return nil, fmt.Errorf("tool check failed: %w", err)
	}

	if !toolStatus.LanguageInstalled {
		runtime.EventsEmit(a.ctx, "toolchain:languageMissing", map[string]any{
			"language":       lang,
			"installCommand": toolStatus.InstallCommand,
		})
		a.lspMu.Unlock()
		return nil, fmt.Errorf("%s runtime not installed", lang)
	}

	if !toolStatus.ToolsInstalled {
		runtime.EventsEmit(a.ctx, "toolchain:toolsMissing", map[string]any{
			"language":     lang,
			"missingTools": toolStatus.MissingTools,
		})
		a.lspMu.Unlock()
		return nil, fmt.Errorf("missing tools: %v", toolStatus.MissingTools)
	}

	cmd := exec.Command(cmdName, args...)
	if root != "" {
		cmd.Dir = root
	}
	stdin, err := cmd.StdinPipe()
	if err != nil {
		a.lspMu.Unlock()
		return nil, fmt.Errorf("stdin pipe: %w", err)
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		a.lspMu.Unlock()
		return nil, fmt.Errorf("stdout pipe: %w", err)
	}

	if err := cmd.Start(); err != nil {
		a.lspMu.Unlock()
		return nil, fmt.Errorf("start %s: %w", cmdName, err)
	}

	cl := &lspClient{
		cmd:     cmd,
		stdin:   stdin,
		stdout:  stdout,
		reader:  bufio.NewReader(stdout),
		seq:     0,
		pending: make(map[int64]chan<- json.RawMessage),
		done:    make(chan struct{}),
		lang:    lang,
		appCtx:  a,
	}

	go cl.readLoop()

	// Perform initialize handshake. rootUri/workspaceFolders is the
	// actual folder the user opened — exactly like VS Code and other
	// editors. Servers resolve each opened file's own nearest project
	// config internally and can serve multiple nested projects from this
	// single instance without issue.
	if err := cl.initialize(root); err != nil {
		a.lspMu.Unlock()
		cl.close()
		return nil, fmt.Errorf("initialize %s: %w", lang, err)
	}

	a.lspClients[key] = cl
	a.lspMu.Unlock()
	return cl, nil
}

func (cl *lspClient) sendMessage(msg []byte) error {
	cl.mu.Lock()
	defer cl.mu.Unlock()

	_, err := fmt.Fprintf(cl.stdin, "Content-Length: %d\r\n\r\n%s", len(msg), msg)
	return err
}

func (cl *lspClient) sendRequest(method string, params any) (json.RawMessage, error) {
	cl.mu.Lock()
	cl.seq++
	id := cl.seq
	ch := make(chan json.RawMessage, 1)
	cl.pending[id] = ch
	cl.mu.Unlock()

	msg := map[string]any{
		"jsonrpc": "2.0",
		"id":      id,
		"method":  method,
		"params":  params,
	}

	body, err := json.Marshal(msg)
	if err != nil {
		return nil, err
	}

	if err := cl.sendMessage(body); err != nil {
		return nil, err
	}

	select {
	case resp := <-ch:
		return resp, nil
	case <-time.After(10 * time.Second):
		cl.mu.Lock()
		delete(cl.pending, id)
		cl.mu.Unlock()
		return nil, fmt.Errorf("request %s (%d) timed out", method, id)
	}
}

func (cl *lspClient) sendNotification(method string, params any) error {
	msg := map[string]any{
		"jsonrpc": "2.0",
		"method":  method,
		"params":  params,
	}

	body, err := json.Marshal(msg)
	if err != nil {
		return err
	}

	return cl.sendMessage(body)
}

func (cl *lspClient) readLoop() {
	defer close(cl.done)

	for {
		msg, err := cl.readMessage()
		if err != nil {
			return
		}

		var base struct {
			ID     json.RawMessage `json:"id,omitempty"`
			Method string          `json:"method,omitempty"`
			Result json.RawMessage `json:"result,omitempty"`
			Error  *struct {
				Code    int    `json:"code"`
				Message string `json:"message"`
			} `json:"error,omitempty"`
		}

		if err := json.Unmarshal(msg, &base); err != nil {
			continue
		}

		switch {
		case len(base.ID) > 0 && base.Method != "":
			// A message with BOTH id and method is a request *from the
			// server to us* (e.g. workspace/configuration,
			// client/registerCapability, window/workDoneProgress/create),
			// not a response to one of our own requests. If we don't
			// reply, servers like typescript-language-server can stall
			// waiting on the answer (e.g. pulling config right after
			// initialize), which shows up as the workspace never being
			// fully understood.
			cl.handleServerRequest(base.Method, base.ID, msg)

		case len(base.ID) > 0:
			// A response to one of our own requests.
			var idNum int64
			if err := json.Unmarshal(base.ID, &idNum); err != nil {
				continue
			}
			cl.mu.Lock()
			ch, ok := cl.pending[idNum]
			if ok {
				delete(cl.pending, idNum)
			}
			cl.mu.Unlock()

			if ok && ch != nil {
				if base.Error != nil {
					ch <- nil
				} else {
					ch <- base.Result
				}
				close(ch)
			}

		case base.Method != "":
			// A notification from the server.
			cl.handleNotification(base.Method, msg)
		}
	}
}

// handleServerRequest answers requests initiated by the server itself.
// Every request the server sends MUST get a response (even a generic
// null/success one) or well-behaved servers will block waiting for it.
func (cl *lspClient) handleServerRequest(method string, id json.RawMessage, raw json.RawMessage) {
	respond := func(result any) {
		msg := map[string]any{
			"jsonrpc": "2.0",
			"id":      json.RawMessage(id),
			"result":  result,
		}
		body, err := json.Marshal(msg)
		if err != nil {
			return
		}
		_ = cl.sendMessage(body)
	}

	switch method {
	case "workspace/configuration":
		// tsserver/gopls pull settings via this after initialize. Answer
		// with one entry per requested item so it can finish applying
		// the project configuration instead of stalling.
		var wrapper struct {
			Params struct {
				Items []map[string]any `json:"items"`
			} `json:"params"`
		}
		_ = json.Unmarshal(raw, &wrapper)
		results := make([]any, len(wrapper.Params.Items))
		for i := range results {
			// Empty object is a safe "use your defaults" answer for any
			// section we don't have specific overrides for.
			results[i] = map[string]any{}
		}
		respond(results)

	case "client/registerCapability", "client/unregisterCapability",
		"window/workDoneProgress/create":
		respond(nil)

	default:
		// Unknown server request: still must be answered so the server
		// doesn't block waiting on us.
		respond(nil)
	}
}

func (cl *lspClient) handleNotification(method string, raw json.RawMessage) {
	switch method {
	case "textDocument/publishDiagnostics":
		var params types.LSPPublishDiagnosticsParams
		var wrapper struct {
			Params json.RawMessage `json:"params"`
		}
		if err := json.Unmarshal(raw, &wrapper); err != nil {
			return
		}
		if err := json.Unmarshal(wrapper.Params, &params); err != nil {
			return
		}
		if cl.appCtx != nil && cl.appCtx.ctx != nil {
			runtime.EventsEmit(cl.appCtx.ctx, "lsp:diagnostics", map[string]any{
				"uri":         params.URI,
				"path":        uriToPath(params.URI),
				"language":    cl.lang,
				"diagnostics": params.Diagnostics,
			})
		}
	}
}

// uriToPath converts a file:// URI back to a local filesystem path.
func uriToPath(uri string) string {
	if !strings.HasPrefix(uri, "file://") {
		return uri
	}
	u, err := url.Parse(uri)
	if err != nil {
		return strings.TrimPrefix(uri, "file://")
	}
	path := u.Path
	// On Windows: file:///C:/foo → /C:/foo → strip leading /
	if len(path) > 2 && path[0] == '/' && path[2] == ':' {
		path = path[1:]
	}
	return path
}

func (cl *lspClient) readMessage() ([]byte, error) {
	for {
		line, err := cl.reader.ReadString('\n')
		if err != nil {
			return nil, err
		}
		line = strings.TrimRight(line, "\r\n")
		if line == "" {
			continue
		}
		if !strings.HasPrefix(line, "Content-Length:") {
			continue
		}

		n, err := strconv.Atoi(strings.TrimSpace(line[15:]))
		if err != nil {
			continue
		}

		// Read the empty line after header
		for {
			empty, err := cl.reader.ReadString('\n')
			if err != nil {
				return nil, err
			}
			if strings.TrimRight(empty, "\r\n") == "" {
				break
			}
		}

		body := make([]byte, n)
		_, err = io.ReadFull(cl.reader, body)
		if err != nil {
			return nil, err
		}

		return body, nil
	}
}



// toURI converts an absolute filesystem path to a valid percent-encoded file:// URI.
// On Windows, C:\foo becomes file:///C:/foo (space→%20, etc.).
// On Unix, /home/foo becomes file:///home/foo.
func toURI(path string) string {
	if path == "" {
		return "file:///"
	}
	p := strings.ReplaceAll(path, "\\", "/")
	// VS Code (and therefore the servers tested against it, notably
	// typescript-language-server) always lowercases the Windows drive
	// letter in file:// URIs. A client that sends an uppercase drive
	// letter produces URIs that don't match tsserver's own internally
	// normalized paths, which silently breaks cross-file resolution
	// (go-to-definition, hover types resolved from another file, etc.)
	// while leaving purely-local/syntactic results (like recognizing an
	// import binding) working — see
	// https://github.com/sublimelsp/LSP-vue/issues/83.
	if len(p) >= 2 && p[1] == ':' && ((p[0] >= 'A' && p[0] <= 'Z') || (p[0] >= 'a' && p[0] <= 'z')) {
		p = strings.ToLower(p[:1]) + p[1:]
	}
	u := &url.URL{
		Scheme: "file",
		Path:   p,
	}
	// url.URL.String() produces file:///c:/... when Path starts with /
	// If Path doesn't start with / (e.g., Windows c:...), prepend /
	if len(u.Path) > 0 && u.Path[0] != '/' {
		u.Path = "/" + u.Path
	}
	return u.String()
}

// lspLangForFile returns the LSP languageId for a given file path.
func lspLangForFile(path string) string {
	ext := strings.ToLower(filepath.Ext(path))
	switch ext {
	case ".go":
		return "go"
	default:
		return ""
	}
}

func (cl *lspClient) initialize(rootURI string) error {
	uri := toURI(rootURI)
	params := map[string]any{
		"processId": nil,
		"rootUri":   uri,
		// workspaceFolders is the modern (LSP 3.17) way of telling the
		// server the actual project boundary; rootUri alone is
		// deprecated and some servers only fully load project config
		// (vs. a lone single-file "inferred project") when this is set.
		"workspaceFolders": []map[string]any{
			{"uri": uri, "name": filepath.Base(rootURI)},
		},
		"capabilities": map[string]any{
			"textDocument": map[string]any{
				"hover":           map[string]any{"contentFormat": []string{"markdown", "plaintext"}},
				"completion":      map[string]any{"completionItem": map[string]any{"snippetSupport": true, "commitCharactersSupport": true, "documentationFormat": []string{"markdown", "plaintext"}, "deprecatedSupport": true, "preselectSupport": true, "tagSupport": map[string]any{"valueSet": []int{1, 2}}}},
				"definition":      map[string]any{},
				"references":      map[string]any{},
				"documentSymbol":  map[string]any{},
				"codeAction":      map[string]any{},
				"signatureHelp":   map[string]any{},
				"rename":          map[string]any{},
				"foldingRange":    map[string]any{},
				"inlayHint":       map[string]any{},
				"semanticTokens":  map[string]any{"requests": map[string]any{"full": map[string]any{"delta": true}, "range": true}},
				"synchronization": map[string]any{"didSave": true, "willSave": false},
				"diagnostics":     map[string]any{},
			},
			"workspace": map[string]any{
				"symbol":                 map[string]any{},
				"didChangeConfiguration": map[string]any{},
				"workspaceFolders":       true,
				"configuration":          true,
			},
		},
	}

	resp, err := cl.sendRequest("initialize", params)
	if err != nil {
		return err
	}
	if cl.appCtx != nil && cl.appCtx.ctx != nil {
		runtime.LogPrintf(cl.appCtx.ctx, "LSP %s initialized, capabilities: %s", cl.lang, string(resp))
	} else {
		log.Printf("LSP %s initialized, capabilities: %s", cl.lang, string(resp))
	}

	// Send initialized notification
	return cl.sendNotification("initialized", map[string]any{})
}

func (cl *lspClient) close() {
	_ = cl.sendNotification("shutdown", nil)
	_ = cl.sendNotification("exit", nil)
	if cl.cmd != nil && cl.cmd.Process != nil {
		_ = cl.cmd.Process.Kill()
	}
}

func (a *App) closeAllLSPClients() {
	a.lspMu.Lock()
	defer a.lspMu.Unlock()
	for lang, cl := range a.lspClients {
		cl.close()
		delete(a.lspClients, lang)
	}
}

// projectMarkersForLang returns the marker filenames that identify a
// language's own project root, in priority order (first match wins).
func projectMarkersForLang(lang string) []string {
	tc := GetToolchain(lang)
	if tc != nil {
		return tc.Markers
	}
	return nil
}

// findProjectRootForLang walks up from filePath looking for the markers
// appropriate to lang, so each language server is rooted at its *own*
// project folder (e.g. frontend/ for TypeScript, even if the user opened
// the parent repo folder as their workspace) rather than a shared,
// possibly-too-broad workspace root.
func findProjectRootForLang(lang, filePath string) string {
	markers := projectMarkersForLang(lang)
	dir := filepath.Dir(filePath)
	for {
		for _, marker := range markers {
			if _, err := os.Stat(filepath.Join(dir, marker)); err == nil {
				return dir
			}
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			// Reached filesystem root without finding a marker.
			return filepath.Dir(filePath)
		}
		dir = parent
	}
}

// resolveLangRoot returns the correct project root to hand to a given
// language's LSP for the file being opened — i.e. the closest enclosing
// tsconfig.json/jsconfig.json/package.json (or go.mod for Go) to that
// specific file, not a single root shared across the whole language. This
// matters for workspaces containing more than one project of the same
// language (e.g. a parent folder with two separate React/TS apps, each
// with its own tsconfig.json) — each file should resolve to *its own*
// closest project, not whichever project's root happened to be found
// first.
//
// The result is cached per (lang, containing directory) so repeated opens
// of files in the same folder don't re-walk the filesystem, while files
// from a different folder are resolved independently.
func (a *App) resolveLangRoot(lang, path string) string {
	dirKey := lang + "::" + filepath.Dir(path)

	a.lspMu.Lock()
	if root, ok := a.lspRoots[dirKey]; ok {
		a.lspMu.Unlock()
		return root
	}
	a.lspMu.Unlock()

	root := findProjectRootForLang(lang, path)

	a.lspMu.Lock()
	a.lspRoots[dirKey] = root
	a.lspMu.Unlock()

	return root
}

func (a *App) lspOpenFile(lang, path, content string) error {
	// Root the server at the actual opened workspace folder, exactly like
	// VS Code and other editors do. Each server resolves individual
	// files' own nearest project config internally, and a single instance
	// can serve multiple nested projects within one workspace. We only
	// need a per-file fallback for the edge case where no workspace
	// folder has been opened at all yet (a lone file opened standalone).
	root := a.currentRoot
	if root == "" {
		root = a.resolveLangRoot(lang, path)
	}

	cl, err := a.ensureLSPClient(lang, root)
	if err != nil {
		return err
	}

	return cl.sendNotification("textDocument/didOpen", map[string]any{
		"textDocument": map[string]any{
			"uri":        toURI(path),
			"languageId": lspLangForFile(path),
			"version":    1,
			"text":       content,
		},
	})
}

func (a *App) lspChangeFile(lang, path, content string, version int) error {
	cl := a.getLSPClientForFile(lang, path)
	if cl == nil {
		return fmt.Errorf("LSP not initialized for %s", lang)
	}

	return cl.sendNotification("textDocument/didChange", map[string]any{
		"textDocument": map[string]any{
			"uri":     toURI(path),
			"version": version,
		},
		"contentChanges": []map[string]any{
			{"text": content},
		},
	})
}

func (a *App) lspCloseFile(lang, path string) error {
	cl := a.getLSPClientForFile(lang, path)
	if cl == nil {
		return nil
	}

	return cl.sendNotification("textDocument/didClose", map[string]any{
		"textDocument": map[string]any{
			"uri": toURI(path),
		},
	})
}

func (a *App) lspHover(lang, path string, line, col int) (*types.LSPHoverResult, error) {
	cl := a.getLSPClientForFile(lang, path)
	if cl == nil {
		return nil, fmt.Errorf("LSP not initialized for %s", lang)
	}

	resp, err := cl.sendRequest("textDocument/hover", map[string]any{
		"textDocument": map[string]any{"uri": toURI(path)},
		"position":     map[string]any{"line": line, "character": col},
	})
	if err != nil {
		return nil, err
	}
	if resp == nil {
		return nil, nil
	}

	var result types.LSPHoverResult
	if err := json.Unmarshal(resp, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

func (a *App) lspCompletion(lang, path string, line, col int) ([]types.LSPCompletionItem, error) {
	cl := a.getLSPClientForFile(lang, path)
	if cl == nil {
		return nil, fmt.Errorf("LSP not initialized for %s", lang)
	}

	resp, err := cl.sendRequest("textDocument/completion", map[string]any{
		"textDocument": map[string]any{"uri": toURI(path)},
		"position":     map[string]any{"line": line, "character": col},
	})
	if err != nil {
		return nil, err
	}
	if resp == nil {
		return nil, nil
	}

	// Completion can be either a list or CompletionList
	var list struct {
		Items []types.LSPCompletionItem `json:"items"`
	}
	if err := json.Unmarshal(resp, &list); err == nil && list.Items != nil {
		return list.Items, nil
	}

	var items []types.LSPCompletionItem
	if err := json.Unmarshal(resp, &items); err != nil {
		return nil, err
	}
	return items, nil
}

func (a *App) lspDefinition(lang, path string, line, col int) (*types.LSPLocation, error) {
	cl := a.getLSPClientForFile(lang, path)
	if cl == nil {
		return nil, fmt.Errorf("LSP not initialized for %s", lang)
	}

	resp, err := cl.sendRequest("textDocument/definition", map[string]any{
		"textDocument": map[string]any{"uri": toURI(path)},
		"position":     map[string]any{"line": line, "character": col},
	})
	if err != nil {
		return nil, err
	}
	if resp == nil {
		return nil, nil
	}

	// Definition can be a single location or an array of locations or LocationLinks
	var single types.LSPLocation
	if err := json.Unmarshal(resp, &single); err == nil && single.URI != "" {
		return &single, nil
	}

	var locations []types.LSPLocation
	if err := json.Unmarshal(resp, &locations); err != nil {
		// Try LocationLink format: [{originSelectionRange, targetUri, targetRange, targetSelectionRange}]
		var links []struct {
			TargetURI   string         `json:"targetUri"`
			TargetRange types.LSPRange `json:"targetRange"`
		}
		if err2 := json.Unmarshal(resp, &links); err2 != nil {
			return nil, err
		}
		if len(links) > 0 {
			return &types.LSPLocation{URI: links[0].TargetURI, Range: links[0].TargetRange}, nil
		}
		return nil, nil
	}
	if len(locations) > 0 {
		return &locations[0], nil
	}
	return nil, nil
}

func (a *App) lspReferences(lang, path string, line, col int) ([]types.LSPLocation, error) {
	cl := a.getLSPClientForFile(lang, path)
	if cl == nil {
		return nil, fmt.Errorf("LSP not initialized for %s", lang)
	}

	resp, err := cl.sendRequest("textDocument/references", map[string]any{
		"textDocument": map[string]any{"uri": toURI(path)},
		"position":     map[string]any{"line": line, "character": col},
		"context":      map[string]bool{"includeDeclaration": true},
	})
	if err != nil {
		return nil, err
	}
	if resp == nil {
		return nil, nil
	}

	var locations []types.LSPLocation
	if err := json.Unmarshal(resp, &locations); err != nil {
		return nil, err
	}
	return locations, nil
}