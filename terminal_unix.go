//go:build !windows

package main

import (
	"log"
	"os"
	"os/exec"

	"github.com/creack/pty"
)

// unixPty wraps the master end of a Unix pseudo-terminal.
type unixPty struct {
	f *os.File
}

func (p *unixPty) Read(b []byte) (int, error)  { return p.f.Read(b) }
func (p *unixPty) Write(b []byte) (int, error) { return p.f.Write(b) }
func (p *unixPty) Close() error                { return p.f.Close() }
func (p *unixPty) Resize(cols, rows uint16) error {
	return pty.Setsize(p.f, &pty.Winsize{Cols: cols, Rows: rows})
}

func startShell(shell, workingDir string, env []string) (ptyHandle, *os.Process, error) {
	log.Printf("[MervCode] startShell (unix): shell=%q workingDir=%q", shell, workingDir)
	cmd := exec.Command(shell, "-l")
	if workingDir != "" {
		cmd.Dir = workingDir
	}
	cmd.Env = env

	ptmx, err := pty.Start(cmd)
	if err != nil {
		log.Printf("[MervCode] startShell (unix): pty.Start FAILED: %v", err)
		return nil, nil, err
	}
	log.Printf("[MervCode] startShell (unix): OK (pid=%d)", cmd.Process.Pid)
	return &unixPty{f: ptmx}, cmd.Process, nil
}
