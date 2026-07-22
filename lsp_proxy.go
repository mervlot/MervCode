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

func (a *App) lspCommand(lang string) (string, []string) {
	switch lang {
	case "typescript", "javascript":
		return "typescript-language-server", []string{"--stdio"}
	case "go":
		return "gopls", []string{"-mode=stdio"}
	default:
		return "", nil
	}
}

func (a *App) getLSPClient(lang string) *lspClient {
	a.lspMu.Lock()
	defer a.lspMu.Unlock()
	return a.lspClients[lang]
}

func (a *App) ensureLSPClient(lang string) (*lspClient, error) {
	a.lspMu.Lock()

	if cl, ok := a.lspClients[lang]; ok {
		a.lspMu.Unlock()
		return cl, nil
	}

	cmdName, args := a.lspCommand(lang)
	if cmdName == "" {
		a.lspMu.Unlock()
		return nil, fmt.Errorf("no LSP server configured for %s", lang)
	}

	cmd := exec.Command(cmdName, args...)
	if a.currentRoot != "" {
		cmd.Dir = a.currentRoot
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

	// Ensure tsconfig exists for JSX support in .tsx/.jsx files
	a.ensureTSConfig(a.currentRoot)

	// Perform initialize handshake
	if err := cl.initialize(a.currentRoot); err != nil {
		a.lspMu.Unlock()
		cl.close()
		return nil, fmt.Errorf("initialize %s: %w", lang, err)
	}

	// Send workspace/didChangeConfiguration after init so server applies settings
	_ = cl.sendNotification("workspace/didChangeConfiguration", map[string]any{
		"settings": map[string]any{
			"typescript": map[string]any{
				"validate": map[string]any{"enable": true},
				"suggestions": map[string]any{
					"completeFunctionCalls":   true,
					"includeAutomaticOptionalChainCompletions": true,
				},
				"format": map[string]any{
					"enable":           true,
					"insertSpaceAfterCommaDelimiter": true,
					"insertSpaceAfterSemicolonInForStatements": true,
					"insertSpaceBeforeAndAfterBinaryOperators": true,
					"insertSpaceAfterKeywordsInControlFlowStatements": true,
					"insertSpaceAfterFunctionKeywordForAnonymousFunctions": true,
					"insertSpaceAfterOpeningAndBeforeClosingNonemptyParenthesis": false,
					"placeOpenBraceOnNewLineForFunctions": false,
					"placeOpenBraceOnNewLineForControlBlocks": false,
				},
			},
			"javascript": map[string]any{
				"validate": map[string]any{"enable": true},
				"suggestions": map[string]any{
					"completeFunctionCalls":   true,
					"includeAutomaticOptionalChainCompletions": true,
				},
			},
		},
	})

	a.lspClients[lang] = cl
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
			ID     int64          `json:"id,omitempty"`
			Method string         `json:"method,omitempty"`
			Result json.RawMessage `json:"result,omitempty"`
			Error  *struct {
				Code    int    `json:"code"`
				Message string `json:"message"`
			} `json:"error,omitempty"`
		}

		if err := json.Unmarshal(msg, &base); err != nil {
			continue
		}

		if base.ID != 0 {
			// This is a response to a request
			cl.mu.Lock()
			ch, ok := cl.pending[base.ID]
			if ok {
				delete(cl.pending, base.ID)
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
		} else if base.Method != "" {
			// This is a server notification
			cl.handleNotification(base.Method, msg)
		}
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

func (a *App) ensureTSConfig(rootURI string) {
	if rootURI == "" {
		return
	}
	dir := rootURI
	if _, err := os.Stat(dir); err != nil {
		return
	}

	// Check existing config files — if one has jsx or exists but is unparseable, leave it alone
	for _, name := range []string{"tsconfig.json", "jsconfig.json"} {
		path := filepath.Join(dir, name)
		data, err := os.ReadFile(path)
		if err != nil {
			continue // file doesn't exist
		}
		// File exists — try to parse. If unparseable (comments, trailing commas),
		// leave it alone rather than overwriting.
		var cfg map[string]any
		if err := json.Unmarshal(data, &cfg); err != nil {
			return
		}
		opts, _ := cfg["compilerOptions"].(map[string]any)
		if opts != nil {
			if _, has := opts["jsx"]; has {
				return // already has jsx
			}
		} else {
			opts = make(map[string]any)
			cfg["compilerOptions"] = opts
		}
		// config exists but has no jsx — inject it
		opts["jsx"] = "react-jsx"
		if patched, err := json.MarshalIndent(cfg, "", "  "); err == nil {
			_ = os.WriteFile(path, patched, 0o644)
		}
		return
	}

	// No config at all — create one
	_ = os.WriteFile(filepath.Join(dir, "tsconfig.json"), []byte(`{
  "compilerOptions": {
    "jsx": "react-jsx",
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "exclude": ["node_modules"]
}
`), 0o644)
}

// toURI converts an absolute filesystem path to a valid percent-encoded file:// URI.
// On Windows, C:\foo becomes file:///C:/foo (space→%20, etc.).
// On Unix, /home/foo becomes file:///home/foo.
func toURI(path string) string {
	if path == "" {
		return "file:///"
	}
	u := &url.URL{
		Scheme: "file",
		Path:   strings.ReplaceAll(path, "\\", "/"),
	}
	// url.URL.String() produces file:///C:/... when Path starts with /
	// If Path doesn't start with / (e.g., Windows C:...), prepend /
	if len(u.Path) > 0 && u.Path[0] != '/' {
		u.Path = "/" + u.Path
	}
	return u.String()
}

// lspLangForFile returns the LSP languageId for a given file path.
func lspLangForFile(path string) string {
	ext := strings.ToLower(filepath.Ext(path))
	switch ext {
	case ".tsx":
		return "typescriptreact"
	case ".ts", ".mts", ".cts":
		return "typescript"
	case ".jsx":
		return "javascriptreact"
	case ".js", ".mjs", ".cjs":
		return "javascript"
	default:
		return ""
	}
}

func (cl *lspClient) initialize(rootURI string) error {
	params := map[string]any{
		"processId": nil,
		"rootUri":   toURI(rootURI),
		"capabilities": map[string]any{
			"textDocument": map[string]any{
				"hover":          map[string]any{"contentFormat": []string{"markdown", "plaintext"}},
				"completion":     map[string]any{"completionItem": map[string]any{"snippetSupport": true, "commitCharactersSupport": true, "documentationFormat": []string{"markdown", "plaintext"}, "deprecatedSupport": true, "preselectSupport": true, "tagSupport": map[string]any{"valueSet": []int{1, 2}}}},
				"definition":     map[string]any{},
				"references":     map[string]any{},
				"documentSymbol": map[string]any{},
				"codeAction":     map[string]any{},
				"signatureHelp":  map[string]any{},
				"rename":         map[string]any{},
				"foldingRange":   map[string]any{},
				"inlayHint":      map[string]any{},
				"semanticTokens": map[string]any{"requests": map[string]any{"full": map[string]any{"delta": true}, "range": true}},
				"synchronization": map[string]any{"didSave": true, "willSave": false},
				"diagnostics":    map[string]any{},
			},
			"workspace": map[string]any{
				"symbol":                map[string]any{},
				"didChangeConfiguration": map[string]any{},
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

// findProjectRoot walks up from filePath to find the project root directory.
// It looks for node_modules or tsconfig.json or package.json as markers.
func findProjectRoot(filePath string) string {
	dir := filepath.Dir(filePath)
	for {
		// Check if this directory contains project markers
		for _, marker := range []string{"node_modules", "tsconfig.json", "jsconfig.json", "package.json"} {
			if _, err := os.Stat(filepath.Join(dir, marker)); err == nil {
				return dir
			}
		}
		// Walk up
		parent := filepath.Dir(dir)
		if parent == dir {
			// Reached filesystem root
			return filepath.Dir(filePath)
		}
		dir = parent
	}
}

func (a *App) lspOpenFile(lang, path, content string) error {
	// Infer workspace root from file if no workspace folder was opened
	if a.currentRoot == "" {
		root := findProjectRoot(path)
		a.watcherMu.Lock()
		a.currentRoot = root
		a.watcherMu.Unlock()
	}

	cl, err := a.ensureLSPClient(lang)
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
	cl := a.getLSPClient(lang)
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
	cl := a.getLSPClient(lang)
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
	cl := a.getLSPClient(lang)
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
	cl := a.getLSPClient(lang)
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
	cl := a.getLSPClient(lang)
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
			TargetURI string       `json:"targetUri"`
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
	cl := a.getLSPClient(lang)
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
