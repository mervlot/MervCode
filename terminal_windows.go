//go:build windows

package main

import (
	"fmt"
	"os"
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
		inWrite.Close()
		outRead.Close()
		return nil, nil, fmt.Errorf("CreatePseudoConsole: %w", err)
	}

	// Set up process creation with the pseudo console attribute.
	attrs, err := windows.NewProcThreadAttributeList(1)
	if err != nil {
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
		windows.ClosePseudoConsole(hPC)
		inWrite.Close()
		outRead.Close()
		return nil, nil, fmt.Errorf("UpdateProcThreadAttribute: %w", err)
	}

	// Build the command line (quote path in case it has spaces).
	cmdLine, err := windows.UTF16PtrFromString(fmt.Sprintf(`"%s"`, shell))
	if err != nil {
		windows.ClosePseudoConsole(hPC)
		inWrite.Close()
		outRead.Close()
		return nil, nil, err
	}

	// Build environment block.
	var envBlock *uint16
	if len(env) > 0 {
		envBlock = createEnvBlock(env)
	}

	// Build working directory.
	var dirPtr *uint16
	if workingDir != "" {
		dirPtr, _ = windows.UTF16PtrFromString(workingDir)
	}

	// Create the process.
	si := &windows.StartupInfoEx{
		StartupInfo: windows.StartupInfo{
			Cb: uint32(unsafe.Sizeof(windows.StartupInfoEx{})),
		},
		ProcThreadAttributeList: attrs.List(),
	}

	pi := &windows.ProcessInformation{}

	err = windows.CreateProcess(
		nil,
		cmdLine,
		nil,
		nil,
		false,
		windows.CREATE_UNICODE_ENVIRONMENT|windows.EXTENDED_STARTUPINFO_PRESENT,
		envBlock,
		dirPtr,
		&si.StartupInfo,
		pi,
	)
	if err != nil {
		windows.ClosePseudoConsole(hPC)
		inWrite.Close()
		outRead.Close()
		return nil, nil, fmt.Errorf("CreateProcess: %w", err)
	}

	// Close thread handle — we don't need it.
	windows.CloseHandle(pi.Thread)

	// Find the process via Go's os.Process so we can call Wait()/Kill().
	proc, err := os.FindProcess(int(pi.ProcessId))
	if err != nil {
		windows.ClosePseudoConsole(hPC)
		inWrite.Close()
		outRead.Close()
		windows.CloseHandle(pi.Process)
		return nil, nil, fmt.Errorf("FindProcess: %w", err)
	}

	// Close the original process handle from CreateProcess —
	// os.FindProcess opened its own handle.
	windows.CloseHandle(pi.Process)

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
		return nil
	}
	var block []uint16
	for _, s := range env {
		u, _ := windows.UTF16FromString(s)
		block = append(block, u...)
	}
	block = append(block, 0) // final double-null terminator
	return &block[0]
}
