package main

import (
	"errors"
	"fmt"
	"sync"

	"github.com/UserExistsError/conpty"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// Windows-only for now (ConPTY). Linux/macOS PTY support comes later.

type termSession struct {
	pty   *conpty.ConPty
	shell string
}

var (
	terminalMu sync.Mutex
	terminals  = map[string]*termSession{}
)

const defaultShellFallback = "powershell.exe -NoLogo"

// StartTerminal starts a new PTY session identified by id, running shell
// (e.g. "cmd.exe", "powershell.exe -NoLogo", "pwsh.exe -NoLogo"). The shell
// is fixed for the lifetime of this session — it is decided once, at
// creation, from whatever the caller passes (normally the current "default
// shell" setting). Changing that setting afterward only affects terminals
// started after the change; it never changes the shell of an already
// running session.
func (a *App) StartTerminal(id string, shell string) error {
	terminalMu.Lock()
	defer terminalMu.Unlock()

	if _, exists := terminals[id]; exists {
		return nil
	}

	if !conpty.IsConPtyAvailable() {
		return errors.New("ConPTY is not supported on this Windows version")
	}

	if shell == "" {
		shell = defaultShellFallback
	}

	ptyInstance, err := conpty.Start(
		shell,
		conpty.ConPtyDimensions(120, 30),
	)
	if err != nil {
		return fmt.Errorf("start ConPTY: %w", err)
	}

	terminals[id] = &termSession{pty: ptyInstance, shell: shell}

	go func(id string, ptyInstance *conpty.ConPty) {
		buf := make([]byte, 8192)

		for {
			n, err := ptyInstance.Read(buf)
			if err != nil {
				runtime.EventsEmit(a.ctx, "terminal:exit:"+id)
				terminalMu.Lock()
				delete(terminals, id)
				terminalMu.Unlock()
				return
			}

			if n > 0 {
				runtime.EventsEmit(a.ctx, "terminal:output:"+id, string(buf[:n]))
			}
		}
	}(id, ptyInstance)

	return nil
}

func (a *App) TerminalInput(id string, input string) error {
	terminalMu.Lock()
	sess := terminals[id]
	terminalMu.Unlock()

	if sess == nil {
		return errors.New("terminal is not running")
	}

	_, err := sess.pty.Write([]byte(input))
	return err
}

func (a *App) ResizeTerminal(id string, cols, rows int) error {
	terminalMu.Lock()
	sess := terminals[id]
	terminalMu.Unlock()

	if sess == nil {
		return nil
	}

	return sess.pty.Resize(cols, rows)
}

// StopTerminal closes and removes a single terminal session.
func (a *App) StopTerminal(id string) {
	terminalMu.Lock()
	defer terminalMu.Unlock()

	if sess, ok := terminals[id]; ok {
		_ = sess.pty.Close()
		delete(terminals, id)
	}
}

// StopAllTerminals closes every running terminal session (app shutdown).
func (a *App) StopAllTerminals() {
	terminalMu.Lock()
	defer terminalMu.Unlock()

	for id, sess := range terminals {
		_ = sess.pty.Close()
		delete(terminals, id)
	}
}