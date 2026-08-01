package main

import (
	"bufio"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os/exec"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// ============================================================================
// Generic, language-agnostic LSP-over-WebSocket bridge.
//
// Monaco/the browser can't speak stdin/stdout, and language servers only
// speak LSP's Content-Length-framed protocol over stdio. This bridge is
// the translation layer: it runs a small local WebSocket server, and for
// every connection it spawns the requested language's server process
// (looked up from the `toolchains` registry in toolchain.go — the SAME
// registry formatters use) and shuttles bytes between the two, converting
// framing in both directions.
//
// To add a new language server, you don't touch this file at all — just
// add an entry to `toolchains` in toolchain.go with its LSP command/args.
// ============================================================================

const lspMaxMessageSize = 32 << 20 // 32 MiB

type lspSession struct {
	lang string
	root string
}

type lspBridge struct {
	mu       sync.Mutex
	listener net.Listener
	server   *http.Server
	sessions map[string]*lspSession // one-shot token -> session info
	ctx      context.Context
}

var bridge = &lspBridge{sessions: make(map[string]*lspSession)}

var wsUpgrader = websocket.Upgrader{
	// Loopback-only: the bridge listens on 127.0.0.1 and every session is
	// gated by a random one-shot token, so this only needs to reject
	// requests that somehow didn't originate from this machine.
	CheckOrigin: func(r *http.Request) bool {
		host, _, err := net.SplitHostPort(r.RemoteAddr)
		if err != nil {
			return false
		}
		ip := net.ParseIP(host)
		return ip != nil && ip.IsLoopback()
	},
}

// startLSPBridge boots the WebSocket bridge once, lazily, on first use.
func (a *App) startLSPBridge() error {
	bridge.mu.Lock()
	defer bridge.mu.Unlock()

	if bridge.listener != nil {
		return nil
	}

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return fmt.Errorf("listen for LSP bridge: %w", err)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/lsp", a.handleLSPWebSocket)

	bridge.server = &http.Server{Handler: mux, ReadHeaderTimeout: 5 * time.Second}
	bridge.listener = listener
	bridge.ctx = a.ctx

	go func() {
		if err := bridge.server.Serve(listener); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Printf("[LSP bridge] server error: %v", err)
		}
	}()

	log.Printf("[LSP bridge] listening on %s", listener.Addr())
	return nil
}

// StopLSPBridge shuts the bridge down (called on app shutdown).
func (a *App) StopLSPBridge() {
	bridge.mu.Lock()
	defer bridge.mu.Unlock()
	if bridge.server != nil {
		_ = bridge.server.Close()
		bridge.listener = nil
		bridge.server = nil
	}
}

// CreateLSPSession is called from the frontend before opening a
// WebSocket. It validates that lang has a registered LSP server, mints a
// one-shot token bound to (lang, root), and returns the ws:// URL to
// connect to. The actual language server process is spawned only once
// that WebSocket connection is made, and is killed when it closes.
func (a *App) CreateLSPSession(lang, root string) (string, error) {
	tc := GetToolchain(lang)
	if tc == nil || tc.LSP == nil {
		return "", fmt.Errorf("no LSP server registered for %s", lang)
	}

	if err := a.startLSPBridge(); err != nil {
		return "", err
	}

	token, err := randomToken()
	if err != nil {
		return "", err
	}

	bridge.mu.Lock()
	bridge.sessions[token] = &lspSession{lang: lang, root: root}
	addr := bridge.listener.Addr().String()
	bridge.mu.Unlock()

	return fmt.Sprintf("ws://%s/lsp?token=%s", addr, token), nil
}

func (a *App) handleLSPWebSocket(w http.ResponseWriter, r *http.Request) {
	token := r.URL.Query().Get("token")

	bridge.mu.Lock()
	sess, ok := bridge.sessions[token]
	if ok {
		delete(bridge.sessions, token) // one-shot
	}
	bridge.mu.Unlock()

	if !ok {
		http.Error(w, "invalid or expired LSP session token", http.StatusUnauthorized)
		return
	}

	tc := GetToolchain(sess.lang)
	if tc == nil || tc.LSP == nil {
		http.Error(w, "unknown language", http.StatusBadRequest)
		return
	}

	resolvedCmd, err := findToolBinary(tc.LSP.Command)
	if err != nil {
		http.Error(w, err.Error(), http.StatusFailedDependency)
		log.Printf("[LSP bridge] %s: %v", sess.lang, err)
		return
	}

	conn, err := wsUpgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[LSP bridge] upgrade failed: %v", err)
		return
	}
	defer conn.Close()
	conn.SetReadLimit(lspMaxMessageSize)

	procCtx, cancel := context.WithCancel(bridge.ctx)
	defer cancel()

	cmd := exec.CommandContext(procCtx, resolvedCmd, tc.LSP.Args...)
	if sess.root != "" {
		cmd.Dir = sess.root
	}

	stdin, err := cmd.StdinPipe()
	if err != nil {
		log.Printf("[LSP bridge] stdin pipe: %v", err)
		return
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		log.Printf("[LSP bridge] stdout pipe: %v", err)
		return
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		log.Printf("[LSP bridge] stderr pipe: %v", err)
		return
	}

	if err := cmd.Start(); err != nil {
		log.Printf("[LSP bridge] start %s: %v", tc.LSP.Command, err)
		return
	}
	log.Printf("[LSP bridge] %s started (root=%s)", sess.lang, sess.root)

	go drainLSPStderr(sess.lang, stderr)

	transportErrs := make(chan error, 2)
	go func() { transportErrs <- wsToStdio(conn, stdin) }()
	go func() { transportErrs <- stdioToWS(stdout, conn) }()

	exited := make(chan error, 1)
	go func() { exited <- cmd.Wait() }()

	select {
	case err := <-transportErrs:
		if err != nil && !isNormalWSClose(err) {
			log.Printf("[LSP bridge] transport error (%s): %v", sess.lang, err)
		}
		cancel()
		_ = stdin.Close()
		<-exited
	case err := <-exited:
		if err != nil && procCtx.Err() == nil {
			log.Printf("[LSP bridge] %s exited: %v", sess.lang, err)
		}
	}

	log.Printf("[LSP bridge] %s session ended (root=%s)", sess.lang, sess.root)
}

// wsToStdio reads plain JSON-RPC text frames from the WebSocket (what
// Monaco's client sends) and re-frames each one with LSP's
// "Content-Length: N\r\n\r\n" header before writing it to the language
// server's stdin.
func wsToStdio(conn *websocket.Conn, dst io.Writer) error {
	for {
		_, msg, err := conn.ReadMessage()
		if err != nil {
			return err
		}
		if !json.Valid(msg) {
			return errors.New("invalid JSON-RPC message from client")
		}

		header := fmt.Sprintf("Content-Length: %d\r\n\r\n", len(msg))
		if _, err := io.WriteString(dst, header); err != nil {
			return err
		}
		if _, err := dst.Write(msg); err != nil {
			return err
		}
	}
}

// stdioToWS reads Content-Length-framed LSP messages from the language
// server's stdout and forwards each one as a plain WebSocket text frame
// (stripping the framing, which the browser-side JSON-RPC client doesn't
// use or expect).
func stdioToWS(src io.Reader, conn *websocket.Conn) error {
	reader := bufio.NewReader(src)
	for {
		msg, err := readLSPFrame(reader)
		if err != nil {
			return err
		}
		if err := conn.WriteMessage(websocket.TextMessage, msg); err != nil {
			return err
		}
	}
}

func readLSPFrame(reader *bufio.Reader) ([]byte, error) {
	contentLength := -1

	for {
		line, err := reader.ReadString('\n')
		if err != nil {
			return nil, err
		}
		line = strings.TrimRight(line, "\r\n")
		if line == "" {
			break
		}

		name, value, found := strings.Cut(line, ":")
		if !found {
			continue
		}
		if strings.EqualFold(strings.TrimSpace(name), "Content-Length") {
			n, err := strconv.Atoi(strings.TrimSpace(value))
			if err != nil {
				return nil, fmt.Errorf("invalid Content-Length: %w", err)
			}
			contentLength = n
		}
	}

	if contentLength < 0 {
		return nil, errors.New("missing Content-Length header")
	}
	if contentLength > lspMaxMessageSize {
		return nil, fmt.Errorf("LSP message too large: %d bytes", contentLength)
	}

	buf := make([]byte, contentLength)
	if _, err := io.ReadFull(reader, buf); err != nil {
		return nil, err
	}
	return buf, nil
}

func drainLSPStderr(lang string, r io.Reader) {
	scanner := bufio.NewScanner(r)
	scanner.Buffer(make([]byte, 64*1024), 4<<20)
	for scanner.Scan() {
		log.Printf("[%s] %s", lang, scanner.Text())
	}
}

func randomToken() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func isNormalWSClose(err error) bool {
	return errors.Is(err, io.EOF) || websocket.IsCloseError(
		err,
		websocket.CloseNormalClosure,
		websocket.CloseGoingAway,
		websocket.CloseNoStatusReceived,
	)
}