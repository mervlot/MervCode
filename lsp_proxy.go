package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"

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
	defer a.lspMu.Unlock()

	if cl, ok := a.lspClients[lang]; ok {
		return cl, nil
	}

	cmdName, args := a.lspCommand(lang)
	if cmdName == "" {
		return nil, fmt.Errorf("no LSP server configured for %s", lang)
	}

	cmd := exec.Command(cmdName, args...)
	stdin, err := cmd.StdinPipe()
	if err != nil {
		return nil, fmt.Errorf("stdin pipe: %w", err)
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, fmt.Errorf("stdout pipe: %w", err)
	}

	if err := cmd.Start(); err != nil {
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

	a.lspClients[lang] = cl

	// Start background reader goroutine
	go cl.readLoop()

	// Resolve or create tsconfig for JSX support
	tsconfigDir := a.resolveTSConfig(lang, a.currentRoot)

	// Perform initialize handshake
	if err := cl.initialize(a.currentRoot, tsconfigDir); err != nil {
		cl.close()
		delete(a.lspClients, lang)
		return nil, fmt.Errorf("initialize %s: %w", lang, err)
	}

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

	resp := <-ch
	return resp, nil
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
		// The raw message has {"jsonrpc":"2.0","method":"...","params":{...}}
		// Extract params
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
				"language":    cl.lang,
				"diagnostics": params.Diagnostics,
			})
		}
	}
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

func (a *App) resolveTSConfig(lang, rootURI string) string {
	if rootURI == "" || (lang != "typescript" && lang != "javascript") {
		return ""
	}

	dir := strings.TrimPrefix(rootURI, "file://")
	if _, err := os.Stat(dir); err != nil {
		return ""
	}
	// Check for existing configs
	for _, name := range []string{"tsconfig.json", "jsconfig.json"} {
		if _, err := os.Stat(filepath.Join(dir, name)); err == nil {
			return "" // existing config is fine, server will pick it up
		}
	}

	tmpDir, err := os.MkdirTemp("", "mervcode-tsconfig-*")
	if err != nil {
		return ""
	}
	_ = os.WriteFile(filepath.Join(tmpDir, "tsconfig.json"), []byte(`{
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

	return tmpDir
}

func (cl *lspClient) initialize(rootURI string, tsconfigDir string) error {
	if rootURI == "" {
		rootURI = "file:///"
	} else {
		rootURI = "file://" + rootURI
	}

	initOpts := map[string]any{
		"hostInfo": "merv-code",
	}
	if tsconfigDir != "" {
		initOpts["tsconfigPath"] = filepath.Join(tsconfigDir, "tsconfig.json")
	}

	params := map[string]any{
		"processId":            nil,
		"rootUri":              rootURI,
		"initializationOptions": initOpts,
		"capabilities": map[string]any{
			"textDocument": map[string]any{
				"hover":            map[string]any{"contentFormat": []string{"markdown", "plaintext"}},
				"completion":       map[string]any{"completionItem": map[string]bool{"snippetSupport": true}},
				"definition":       map[string]any{},
				"references":       map[string]any{},
				"documentSymbol":   map[string]any{},
				"synchronization":  map[string]any{"didSave": true, "willSave": false},
				"diagnostics":      map[string]any{},
				"codeAction":       map[string]any{},
			},
			"workspace": map[string]any{
				"didChangeConfiguration": map[string]any{},
			},
		},
	}

	resp, err := cl.sendRequest("initialize", params)
	if err != nil {
		return err
	}
	_ = resp // consume but ignore result

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

func (a *App) lspOpenFile(lang, path, content string) error {
	cl, err := a.ensureLSPClient(lang)
	if err != nil {
		return err
	}

	uri := "file://" + path
	langID := lang
	if langID == "javascript" || langID == "typescript" {
		langID = langID
	}

	return cl.sendNotification("textDocument/didOpen", map[string]any{
		"textDocument": map[string]any{
			"uri":        uri,
			"languageId": langID,
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

	uri := "file://" + path
	return cl.sendNotification("textDocument/didChange", map[string]any{
		"textDocument": map[string]any{
			"uri":     uri,
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

	uri := "file://" + path
	return cl.sendNotification("textDocument/didClose", map[string]any{
		"textDocument": map[string]any{
			"uri": uri,
		},
	})
}

func (a *App) lspHover(lang, path string, line, col int) (*types.LSPHoverResult, error) {
	cl := a.getLSPClient(lang)
	if cl == nil {
		return nil, fmt.Errorf("LSP not initialized for %s", lang)
	}

	uri := "file://" + path
	resp, err := cl.sendRequest("textDocument/hover", map[string]any{
		"textDocument": map[string]any{"uri": uri},
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

	uri := "file://" + path
	resp, err := cl.sendRequest("textDocument/completion", map[string]any{
		"textDocument": map[string]any{"uri": uri},
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

	uri := "file://" + path
	resp, err := cl.sendRequest("textDocument/definition", map[string]any{
		"textDocument": map[string]any{"uri": uri},
		"position":     map[string]any{"line": line, "character": col},
	})
	if err != nil {
		return nil, err
	}
	if resp == nil {
		return nil, nil
	}

	// Definition can be a single location or an array
	var single types.LSPLocation
	if err := json.Unmarshal(resp, &single); err == nil && single.URI != "" {
		return &single, nil
	}

	var locations []types.LSPLocation
	if err := json.Unmarshal(resp, &locations); err != nil {
		return nil, err
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

	uri := "file://" + path
	resp, err := cl.sendRequest("textDocument/references", map[string]any{
		"textDocument": map[string]any{"uri": uri},
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
