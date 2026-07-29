package main

import (
	"context"
	"fmt"
	"io"
	"log"
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
			log.Printf("[MervCode] DetectShell: pwsh found")
			return "pwsh"
		}
		if _, err := exec.LookPath("powershell"); err == nil {
			log.Printf("[MervCode] DetectShell: powershell found")
			return "powershell"
		}
		log.Printf("[MervCode] DetectShell: pwsh/powershell not found, falling back to cmd")
		return "cmd"
	}
	if shell := os.Getenv("SHELL"); shell != "" {
		log.Printf("[MervCode] DetectShell: $SHELL=%q", shell)
		return shell
	}
	if _, err := exec.LookPath("zsh"); err == nil {
		log.Printf("[MervCode] DetectShell: zsh found")
		return "zsh"
	}
	log.Printf("[MervCode] DetectShell: falling back to bash")
	return "bash"
}

// CreateTerminal spawns a new shell with a proper PTY.
// startShell is implemented per platform (terminal_unix.go / terminal_windows.go).
func (a *App) CreateTerminal(id string, workingDir string, shell string) error {
	log.Printf("[MervCode] CreateTerminal called: id=%q workingDir=%q shell=%q", id, workingDir, shell)

	a.terminalMu.Lock()
	defer a.terminalMu.Unlock()

	if _, exists := a.terminals[id]; exists {
		err := fmt.Errorf("terminal session %s already exists", id)
		log.Printf("[MervCode] CreateTerminal %s FAILED: %v", id, err)
		return err
	}

	if shell == "" {
		shell = DetectShell()
		log.Printf("[MervCode] CreateTerminal %s: detected shell=%q", id, shell)
	}

	// Resolve to full path so Windows CreateProcess can find it.
	if full, err := exec.LookPath(shell); err == nil {
		log.Printf("[MervCode] CreateTerminal %s: resolved shell path %q -> %q", id, shell, full)
		shell = full
	} else {
		log.Printf("[MervCode] CreateTerminal %s: LookPath(%q) failed: %v", id, shell, err)
	}

	ctx, cancel := context.WithCancel(a.ctx)

	env := os.Environ()
	env = append(env, "TERM=xterm-256color")

	log.Printf("[MervCode] CreateTerminal %s: calling startShell(shell=%q, dir=%q)", id, shell, workingDir)
	h, process, err := startShell(shell, workingDir, env)
	if err != nil {
		log.Printf("[MervCode] CreateTerminal %s: startShell FAILED: %v", id, err)
		cancel()
		return fmt.Errorf("start shell: %w", err)
	}
	log.Printf("[MervCode] CreateTerminal %s: startShell OK (pid=%d)", id, process.Pid)

	session := &TerminalSession{
		ID:      id,
		pty:     h,
		process: process,
		cancel:  cancel,
	}
	a.terminals[id] = session
	log.Printf("[MervCode] CreateTerminal %s: session stored, starting read/exit goroutines", id)

	// Read PTY output and emit to frontend.
	go func() {
		buf := make([]byte, 8192)
		total := 0
		for {
			n, readErr := h.Read(buf)
			if n > 0 {
				total += n
				wailsRuntime.EventsEmit(a.ctx, "terminal:output:"+id, string(buf[:n]))
			}
			if readErr != nil {
				if readErr != io.EOF {
					log.Printf("[MervCode] Terminal %s read error: %v (total=%d bytes)", id, readErr, total)
				} else {
					log.Printf("[MervCode] Terminal %s read EOF (total=%d bytes)", id, total)
				}
				break
			}
		}
	}()

	// Kill process on context cancellation.
	go func() {
		<-ctx.Done()
		log.Printf("[MervCode] Terminal %s: context cancelled, killing process (pid=%d)", id, process.Pid)
		if process != nil {
			_ = process.Kill()
		}
	}()

	// Wait for process exit, then clean up.
	go func() {
		ps, err := process.Wait()
		if err != nil {
			log.Printf("[MervCode] Terminal %s: process.Wait() error: %v", id, err)
		} else {
			log.Printf("[MervCode] Terminal %s: process exited (pid=%d, code=%d)", id, process.Pid, ps.ExitCode())
		}

		log.Printf("[MervCode] Terminal %s: emitting terminal:exit event", id)
		wailsRuntime.EventsEmit(a.ctx, "terminal:exit:"+id, nil)

		a.terminalMu.Lock()
		if s, ok := a.terminals[id]; ok {
			log.Printf("[MervCode] Terminal %s: cleaning up PTY handle", id)
			if s.pty != nil {
				s.pty.Close()
			}
			delete(a.terminals, id)
		}
		a.terminalMu.Unlock()
		log.Printf("[MervCode] Terminal %s: cleanup complete", id)
	}()

	log.Printf("[MervCode] CreateTerminal %s: returning success", id)
	return nil
}

// WriteTerminal sends user input to the PTY.
func (a *App) WriteTerminal(id string, data string) error {
	a.terminalMu.Lock()
	session, exists := a.terminals[id]
	a.terminalMu.Unlock()

	if !exists {
		err := fmt.Errorf("terminal session %s not found", id)
		log.Printf("[MervCode] WriteTerminal %s FAILED: %v", id, err)
		return err
	}

	n, err := session.pty.Write([]byte(data))
	if err != nil {
		log.Printf("[MervCode] WriteTerminal %s: write error (%d bytes): %v", id, n, err)
	} else if n > 0 {
		log.Printf("[MervCode] WriteTerminal %s: wrote %d bytes", id, n)
	}
	return err
}

// ResizeTerminal updates the PTY window size.
func (a *App) ResizeTerminal(id string, cols, rows int) error {
	a.terminalMu.Lock()
	session, exists := a.terminals[id]
	a.terminalMu.Unlock()

	if !exists {
		err := fmt.Errorf("terminal session %s not found", id)
		log.Printf("[MervCode] ResizeTerminal %s FAILED: %v", id, err)
		return err
	}

	err := session.pty.Resize(uint16(cols), uint16(rows))
	if err != nil {
		log.Printf("[MervCode] ResizeTerminal %s: resize(%dx%d) error: %v", id, cols, rows, err)
	}
	return err
}

// KillTerminal forcefully terminates a shell session.
func (a *App) KillTerminal(id string) error {
	log.Printf("[MervCode] KillTerminal %s called", id)
	a.terminalMu.Lock()
	session, exists := a.terminals[id]
	if !exists {
		a.terminalMu.Unlock()
		log.Printf("[MervCode] KillTerminal %s: session not found (already cleaned up)", id)
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
	log.Printf("[MervCode] KillTerminal %s: done", id)
	return nil
}

// KillAllTerminals cleans up all sessions on app shutdown.
func (a *App) KillAllTerminals() {
	log.Printf("[MervCode] KillAllTerminals: cleaning up %d sessions", len(a.terminals))
	a.terminalMu.Lock()
	defer a.terminalMu.Unlock()

	for id, session := range a.terminals {
		log.Printf("[MervCode] KillAllTerminals: killing session %s (pid=%d)", id, session.process.Pid)
		session.cancel()
		if session.pty != nil {
			_ = session.pty.Close()
		}
		if session.process != nil {
			_ = session.process.Kill()
		}
	}
	a.terminals = make(map[string]*TerminalSession)
	log.Printf("[MervCode] KillAllTerminals: done")
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
			} else {
				log.Printf("[MervCode] ListAvailableShells: %s not found: %v", s, err)
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
	log.Printf("[MervCode] ListAvailableShells: found %v", shells)
	return shells
}
