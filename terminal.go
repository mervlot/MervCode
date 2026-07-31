package main

import (
	"errors"
	"fmt"
	"sync"

	"github.com/UserExistsError/conpty"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

var terminalMu sync.Mutex

func (a *App) StartTerminal() error {
	terminalMu.Lock()
	defer terminalMu.Unlock()

	if a.pty != nil {
		return nil
	}

	if !conpty.IsConPtyAvailable() {
		return errors.New("ConPTY is not supported on this Windows version")
	}

	ptyInstance, err := conpty.Start(
		"powershell.exe -NoLogo",
		conpty.ConPtyDimensions(120, 30),
	)
	if err != nil {
		return fmt.Errorf("start ConPTY: %w", err)
	}

	a.pty = ptyInstance

	go func(ptyInstance *conpty.ConPty) {
		buf := make([]byte, 8192)

		for {
			n, err := ptyInstance.Read(buf)
			if err != nil {
				fmt.Println("terminal stopped:", err)
				return
			}

			if n > 0 {
				runtime.EventsEmit(
					a.ctx,
					"terminal:output",
					string(buf[:n]),
				)
			}
		}
	}(ptyInstance)

	return nil
}

func (a *App) TerminalInput(input string) error {
	terminalMu.Lock()
	ptyInstance := a.pty
	terminalMu.Unlock()

	if ptyInstance == nil {
		return errors.New("terminal is not running")
	}

	_, err := ptyInstance.Write([]byte(input))
	return err
}

func (a *App) ResizeTerminal(cols, rows int) error {
	terminalMu.Lock()
	ptyInstance := a.pty
	terminalMu.Unlock()

	if ptyInstance == nil {
		return nil
	}

	return ptyInstance.Resize(cols, rows)
}

func (a *App) StopTerminal() {
	terminalMu.Lock()
	defer terminalMu.Unlock()

	if a.pty != nil {
		_ = a.pty.Close()
		a.pty = nil
	}
}
