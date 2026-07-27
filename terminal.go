// terminal.go — Native shell process manager for MervCode's integrated terminal.
// Spawns the user's default shell via os/exec (no CGO, no external deps).
// Streams I/O through Wails events. Each session is identified by a unique ID
// and cleaned up on app shutdown via KillAllTerminals().

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

// TerminalSession represents a single running shell process
type TerminalSession struct {
	ID     string
	cmd    *exec.Cmd
	stdin  io.WriteCloser
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

// CreateTerminal spawns a new shell session and streams output via Wails events.
// If shell is empty, the user's default shell is auto-detected.
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

	cmd.Env = os.Environ()

	stdinPipe, err := cmd.StdinPipe()
	if err != nil {
		cancel()
		return fmt.Errorf("stdin pipe: %w", err)
	}

	stdoutPipe, err := cmd.StdoutPipe()
	if err != nil {
		cancel()
		return fmt.Errorf("stdout pipe: %w", err)
	}

	stderrPipe, err := cmd.StderrPipe()
	if err != nil {
		cancel()
		return fmt.Errorf("stderr pipe: %w", err)
	}

	if err := cmd.Start(); err != nil {
		cancel()
		return fmt.Errorf("start shell %s: %w", shell, err)
	}

	session := &TerminalSession{
		ID:     id,
		cmd:    cmd,
		stdin:  stdinPipe,
		cancel: cancel,
	}
	a.terminals[id] = session

	go func() {
		buf := make([]byte, 8192)
		for {
			n, err := stdoutPipe.Read(buf)
			if n > 0 {
				wailsRuntime.EventsEmit(a.ctx, "terminal:output:"+id, string(buf[:n]))
			}
			if err != nil {
				break
			}
		}
	}()

	go func() {
		buf := make([]byte, 4096)
		for {
			n, err := stderrPipe.Read(buf)
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
		delete(a.terminals, id)
		a.terminalMu.Unlock()
	}()

	return nil
}

// WriteTerminal sends user input to the shell's stdin.
func (a *App) WriteTerminal(id string, data string) error {
	a.terminalMu.Lock()
	session, exists := a.terminals[id]
	a.terminalMu.Unlock()

	if !exists {
		return fmt.Errorf("terminal session %s not found", id)
	}

	_, err := session.stdin.Write([]byte(data))
	return err
}

// ResizeTerminal is a no-op placeholder for future PTY support.
func (a *App) ResizeTerminal(id string, cols, rows int) error {
	return nil
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
			// Ensure the $SHELL value is included (may use full path)
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
