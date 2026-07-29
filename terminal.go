package main

import (
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"runtime"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// ptyHandle abstracts platform-specific PTY operations.
type ptyHandle interface {
	io.ReadWriteCloser
	Resize(cols, rows uint16) error
}

// TerminalSession represents a running shell.
type TerminalSession struct {
	ID      string
	pty     ptyHandle
	process *os.Process
	cancel  context.CancelFunc
}

// DetectShell returns the user's default shell for the current OS.
func DetectShell() string {
	if runtime.GOOS == "windows" {
		if _, err := exec.LookPath("pwsh"); err == nil {
			return "pwsh"
		}
		if _, err := exec.LookPath("powershell"); err == nil {
			return "powershell"
		}
		return "cmd"
	}
	if shell := os.Getenv("SHELL"); shell != "" {
		return shell
	}
	if _, err := exec.LookPath("zsh"); err == nil {
		return "zsh"
	}
	return "bash"
}

// CreateTerminal spawns a new shell with a proper PTY.
// startShell is implemented per platform (terminal_unix.go / terminal_windows.go).
func (a *App) CreateTerminal(id string, workingDir string, shell string) error {
	a.terminalMu.Lock()
	defer a.terminalMu.Unlock()

	if _, exists := a.terminals[id]; exists {
		return fmt.Errorf("terminal session %s already exists", id)
	}

	if shell == "" {
		shell = DetectShell()
	}

	// Resolve to full path so Windows CreateProcess can find it.
	if full, err := exec.LookPath(shell); err == nil {
		shell = full
	}

	ctx, cancel := context.WithCancel(a.ctx)

	env := os.Environ()
	env = append(env, "TERM=xterm-256color")

	h, process, err := startShell(shell, workingDir, env)
	if err != nil {
		cancel()
		return fmt.Errorf("start shell: %w", err)
	}

	session := &TerminalSession{
		ID:      id,
		pty:     h,
		process: process,
		cancel:  cancel,
	}
	a.terminals[id] = session

	// Read PTY output and emit to frontend.
	go func() {
		buf := make([]byte, 8192)
		for {
			n, readErr := h.Read(buf)
			if n > 0 {
				wailsRuntime.EventsEmit(a.ctx, "terminal:output:"+id, string(buf[:n]))
			}
			if readErr != nil {
				break
			}
		}
	}()

	// Kill process on context cancellation.
	go func() {
		<-ctx.Done()
		if process != nil {
			_ = process.Kill()
		}
	}()

	// Wait for process exit, then clean up.
	go func() {
		_, _ = process.Wait()
		wailsRuntime.EventsEmit(a.ctx, "terminal:exit:"+id, nil)
		a.terminalMu.Lock()
		if s, ok := a.terminals[id]; ok {
			if s.pty != nil {
				s.pty.Close()
			}
			delete(a.terminals, id)
		}
		a.terminalMu.Unlock()
	}()

	return nil
}

// WriteTerminal sends user input to the PTY.
func (a *App) WriteTerminal(id string, data string) error {
	a.terminalMu.Lock()
	session, exists := a.terminals[id]
	a.terminalMu.Unlock()

	if !exists {
		return fmt.Errorf("terminal session %s not found", id)
	}

	_, err := session.pty.Write([]byte(data))
	return err
}

// ResizeTerminal updates the PTY window size.
func (a *App) ResizeTerminal(id string, cols, rows int) error {
	a.terminalMu.Lock()
	session, exists := a.terminals[id]
	a.terminalMu.Unlock()

	if !exists {
		return fmt.Errorf("terminal session %s not found", id)
	}

	return session.pty.Resize(uint16(cols), uint16(rows))
}

// KillTerminal forcefully terminates a shell session.
func (a *App) KillTerminal(id string) error {
	a.terminalMu.Lock()
	session, exists := a.terminals[id]
	if !exists {
		a.terminalMu.Unlock()
		return nil
	}
	delete(a.terminals, id)
	a.terminalMu.Unlock()

	session.cancel()
	if session.pty != nil {
		_ = session.pty.Close()
	}
	if session.process != nil {
		_ = session.process.Kill()
	}
	return nil
}

// KillAllTerminals cleans up all sessions on app shutdown.
func (a *App) KillAllTerminals() {
	a.terminalMu.Lock()
	defer a.terminalMu.Unlock()

	for _, session := range a.terminals {
		session.cancel()
		if session.pty != nil {
			_ = session.pty.Close()
		}
		if session.process != nil {
			_ = session.process.Kill()
		}
	}
	a.terminals = make(map[string]*TerminalSession)
}

// GetDefaultShell exposes the detected shell to the frontend.
func (a *App) GetDefaultShell() string {
	return DetectShell()
}

// ListAvailableShells returns all detected shells on the system.
func (a *App) ListAvailableShells() []string {
	var shells []string
	if runtime.GOOS == "windows" {
		for _, s := range []string{"pwsh", "powershell", "cmd", "wsl"} {
			if _, err := exec.LookPath(s); err == nil {
				shells = append(shells, s)
			}
		}
	} else {
		for _, s := range []string{"bash", "zsh", "fish", "sh"} {
			if _, err := exec.LookPath(s); err == nil {
				shells = append(shells, s)
			}
		}
		if shell := os.Getenv("SHELL"); shell != "" {
			found := false
			for _, s := range shells {
				if s == shell {
					found = true
					break
				}
			}
			if !found {
				shells = append([]string{shell}, shells...)
			}
		}
	}
	return shells
}
