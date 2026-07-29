//go:build windows

package main

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"unsafe"

	"golang.org/x/sys/windows"
)

// procThreadAttributePseudoConsole = PROC_THREAD_ATTRIBUTE_PSEUDOCONSOLE (0x00020016)
const procThreadAttributePseudoConsole uintptr = 0x00020016

// conPty wraps a Windows ConPTY pseudo-console.
type conPty struct {
	console windows.Handle
	inWrite *os.File
	outRead *os.File
}

func (p *conPty) Read(b []byte) (int, error)  { return p.outRead.Read(b) }
func (p *conPty) Write(b []byte) (int, error) { return p.inWrite.Write(b) }

func (p *conPty) Close() error {
	if p.console != 0 {
		windows.ClosePseudoConsole(p.console)
	}
	err1 := p.inWrite.Close()
	err2 := p.outRead.Close()
	if err1 != nil {
		return err1
	}
	return err2
}

func (p *conPty) Resize(cols, rows uint16) error {
	return windows.ResizePseudoConsole(p.console, windows.Coord{X: int16(cols), Y: int16(rows)})
}

func startShell(shell, workingDir string, env []string) (ptyHandle, *os.Process, error) {
	log.Printf("[MervCode] startShell: shell=%q workingDir=%q", shell, workingDir)

	// Create pipes: ConPTY reads from inRead, writes to outWrite.
	// We write to inWrite, read from outRead.
	inRead, inWrite, err := os.Pipe()
	if err != nil {
		return nil, nil, fmt.Errorf("create input pipe: %w", err)
	}

	outRead, outWrite, err := os.Pipe()
	if err != nil {
		inRead.Close()
		inWrite.Close()
		return nil, nil, fmt.Errorf("create output pipe: %w", err)
	}

	// Create the pseudo console.
	var hPC windows.Handle
	size := windows.Coord{X: 80, Y: 24}
	err = windows.CreatePseudoConsole(
		size,
		windows.Handle(inRead.Fd()),
		windows.Handle(outWrite.Fd()),
		0,
		&hPC,
	)
	// Close the pipe ends we gave to the console — they're now owned by ConPTY.
	inRead.Close()
	outWrite.Close()
	if err != nil {
		log.Printf("[MervCode] startShell: CreatePseudoConsole FAILED: %v", err)
		inWrite.Close()
		outRead.Close()
		return nil, nil, fmt.Errorf("CreatePseudoConsole: %w", err)
	}
	log.Printf("[MervCode] startShell: ConPTY created (handle=%d)", hPC)

	// Set up process creation with the pseudo console attribute.
	attrs, err := windows.NewProcThreadAttributeList(1)
	if err != nil {
		log.Printf("[MervCode] startShell: NewProcThreadAttributeList FAILED: %v", err)
		windows.ClosePseudoConsole(hPC)
		inWrite.Close()
		outRead.Close()
		return nil, nil, fmt.Errorf("NewProcThreadAttributeList: %w", err)
	}
	defer attrs.Delete()

	err = attrs.Update(
		procThreadAttributePseudoConsole,
		unsafe.Pointer(&hPC),
		unsafe.Sizeof(hPC),
	)
	if err != nil {
		log.Printf("[MervCode] startShell: UpdateProcThreadAttribute FAILED: %v", err)
		windows.ClosePseudoConsole(hPC)
		inWrite.Close()
		outRead.Close()
		return nil, nil, fmt.Errorf("UpdateProcThreadAttribute: %w", err)
	}

	// Build the command line with shell-appropriate flags for interactive mode.
	// PowerShell needs -NoExit to stay alive; CMD and others work without flags
	// when stdin is connected.
	shellName := strings.ToLower(filepath.Base(shell))
	var args string
	if strings.Contains(shellName, "powershell") || shellName == "pwsh" || shellName == "pwsh.exe" {
		args = " -NoExit -"
	}
	cmdStr := fmt.Sprintf(`"%s"%s`, shell, args)
	cmdLine, err := windows.UTF16PtrFromString(cmdStr)
	if err != nil {
		log.Printf("[MervCode] startShell: UTF16PtrFromString(%q) FAILED: %v", cmdStr, err)
		windows.ClosePseudoConsole(hPC)
		inWrite.Close()
		outRead.Close()
		return nil, nil, err
	}
	log.Printf("[MervCode] startShell: command line = %q", cmdStr)

	// Build environment block.
	var envBlock *uint16
	if len(env) > 0 {
		envBlock = createEnvBlock(env)
		log.Printf("[MervCode] startShell: env block created (%d vars)", len(env))
	} else {
		log.Printf("[MervCode] startShell: WARNING — no environment variables")
	}

	// Build working directory.
	var dirPtr *uint16
	if workingDir != "" {
		dirPtr, _ = windows.UTF16PtrFromString(workingDir)
		log.Printf("[MervCode] startShell: working dir = %q", workingDir)
	} else {
		log.Printf("[MervCode] startShell: no working dir (will inherit from parent)")
	}

	// Create the process with a NEW console (required by ConPTY for proper
	// stdin/stdout redirection) but mark the console window HIDDEN so the
	// user doesn't see a separate PowerShell window floating around.
	si := &windows.StartupInfoEx{
		StartupInfo: windows.StartupInfo{
			Cb: uint32(unsafe.Sizeof(windows.StartupInfoEx{})),
			Flags:     windows.STARTF_USESHOWWINDOW,
			ShowWindow: windows.SW_HIDE,
		},
		ProcThreadAttributeList: attrs.List(),
	}

	pi := &windows.ProcessInformation{}

	log.Printf("[MervCode] startShell: calling CreateProcess(shell=%s)", cmdStr)
	err = windows.CreateProcess(
		nil,
		cmdLine,
		nil,
		nil,
		false,
		windows.CREATE_UNICODE_ENVIRONMENT|windows.EXTENDED_STARTUPINFO_PRESENT|windows.CREATE_NEW_CONSOLE,
		envBlock,
		dirPtr,
		&si.StartupInfo,
		pi,
	)
	if err != nil {
		log.Printf("[MervCode] startShell: CreateProcess FAILED: %v", err)
		windows.ClosePseudoConsole(hPC)
		inWrite.Close()
		outRead.Close()
		return nil, nil, fmt.Errorf("CreateProcess: %w", err)
	}
	log.Printf("[MervCode] startShell: CreateProcess OK (pid=%d)", pi.ProcessId)

	// Close thread handle — we don't need it.
	windows.CloseHandle(pi.Thread)

	// Find the process via Go's os.Process so we can call Wait()/Kill().
	proc, err := os.FindProcess(int(pi.ProcessId))
	if err != nil {
		log.Printf("[MervCode] startShell: FindProcess(%d) FAILED: %v", pi.ProcessId, err)
		windows.ClosePseudoConsole(hPC)
		inWrite.Close()
		outRead.Close()
		windows.CloseHandle(pi.Process)
		return nil, nil, fmt.Errorf("FindProcess: %w", err)
	}

	// Close the original process handle from CreateProcess —
	// os.FindProcess opened its own handle.
	windows.CloseHandle(pi.Process)

	log.Printf("[MervCode] startShell: success (pid=%d)", proc.Pid)
	return &conPty{
		console: hPC,
		inWrite: inWrite,
		outRead: outRead,
	}, proc, nil
}

// createEnvBlock builds a Windows environment block
// (null-terminated UTF-16 strings, double-null terminated).
func createEnvBlock(env []string) *uint16 {
	if len(env) == 0 {
		log.Printf("[MervCode] createEnvBlock: empty env — returning nil")
		return nil
	}
	var block []uint16
	for _, s := range env {
		u, _ := windows.UTF16FromString(s)
		block = append(block, u...)
	}
	block = append(block, 0) // final double-null terminator
	log.Printf("[MervCode] createEnvBlock: built block with %d vars (%d uint16s)", len(env), len(block))
	return &block[0]
}
