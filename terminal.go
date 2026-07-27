// terminal.go — Native PTY-based shell manager for MervCode's integrated terminal.
// Uses github.com/creack/pty for proper pseudo-terminal support (no CGO).
// Enables: Ctrl+C (SIGINT), arrow keys, vim/nano/htop, job control, etc.

package main

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"runtime"

	"github.com/creack/pty"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// TerminalSession represents a running shell with a PTY
type TerminalSession struct {
	ID     string
	cmd    *exec.Cmd
	pty    *os.File
	cancel context.CancelFunc
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
func (a *App) CreateTerminal(id string, workingDir string, shell string) error {
	a.terminalMu.Lock()
	defer a.terminalMu.Unlock()

	if _, exists := a.terminals[id]; exists {
		return fmt.Errorf("terminal session %s already exists", id)
	}

	if shell == "" {
		shell = DetectShell()
	}

	ctx, cancel := context.WithCancel(a.ctx)

	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		cmd = exec.CommandContext(ctx, shell)
	} else {
		cmd = exec.CommandContext(ctx, shell, "-l")
	}

	if workingDir != "" {
		cmd.Dir = workingDir
	}

	env := os.Environ()
	env = append(env, "TERM=xterm-256color")
	cmd.Env = env

	ptmx, err := pty.Start(cmd)
	if err != nil {
		cancel()
		return fmt.Errorf("start pty: %w", err)
	}

	session := &TerminalSession{
		ID:     id,
		cmd:    cmd,
		pty:    ptmx,
		cancel: cancel,
	}
	a.terminals[id] = session

	go func() {
		buf := make([]byte, 8192)
		for {
			n, err := ptmx.Read(buf)
			if n > 0 {
				wailsRuntime.EventsEmit(a.ctx, "terminal:output:"+id, string(buf[:n]))
			}
			if err != nil {
				break
			}
		}
	}()

	go func() {
		_ = cmd.Wait()
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

// ResizeTerminal updates the PTY window size for proper rendering of interactive programs.
func (a *App) ResizeTerminal(id string, cols, rows int) error {
	a.terminalMu.Lock()
	session, exists := a.terminals[id]
	a.terminalMu.Unlock()

	if !exists {
		return fmt.Errorf("terminal session %s not found", id)
	}

	return pty.Setsize(session.pty, &pty.Winsize{
		Rows: uint16(rows),
		Cols: uint16(cols),
	})
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
	if session.cmd.Process != nil {
		_ = session.cmd.Process.Kill()
	}
	return nil
}

// KillAllTerminals cleans up all sessions on app shutdown.
func (a *App) KillAllTerminals() {
	a.terminalMu.Lock()
	defer a.terminalMu.Unlock()

	for id, session := range a.terminals {
		session.cancel()
		if session.pty != nil {
			_ = session.pty.Close()
		}
		if session.cmd.Process != nil {
			_ = session.cmd.Process.Kill()
		}
		delete(a.terminals, id)
	}
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
