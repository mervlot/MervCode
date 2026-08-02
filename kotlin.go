package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
)

// ============================================================================
// Bundled Kotlin LSP (JetBrains' official Kotlin/kotlin-lsp) launcher.
//
// This is NOT fwcd/kotlin-language-server. It's JetBrains' IntelliJ-based
// server, bundled with MervCode under runtime/kotlin, including its own
// JBR (JetBrains Runtime).
//
// Bundled runtime/kotlin/kotlin-lsp layout (Windows):
//
//	runtime/kotlin/kotlin-lsp/
//	├── bin/
//	│   └── intellij-server.exe
//	├── jbr/
//	├── lib/
//	├── plugins/
//	└── modules/
//
// Invocation:
//
//	intellij-server.exe --stdio --system-path <dir>
//
// ============================================================================
// resolveKotlinRuntimeDir locates the bundled Kotlin LSP distribution,
// nested one level under runtime/kotlin (runtime/kotlin/kotlin-lsp)
// alongside any other Kotlin-related bundled tooling that may live under
// runtime/kotlin in the future.
func resolveKotlinRuntimeDir() (string, error) {
	kotlinDir, err := resolveBundledRuntimeDir("kotlin")
	if err != nil {
		return "", err
	}

	kotlinLSPDir := filepath.Join(kotlinDir, "kotlin-lsp")
	if info, err := os.Stat(kotlinLSPDir); err != nil || !info.IsDir() {
		return "", fmt.Errorf("bundled Kotlin LSP directory not found at %s", kotlinLSPDir)
	}

	return kotlinLSPDir, nil
}

// kotlinLSPEntrypoint returns the platform-specific launcher script inside
// the bundled runtime. Only Windows is wired up for now; Linux/macOS use
// kotlin-lsp.sh in the official distribution and can be added the same
// way once that runtime is bundled too.
func kotlinLSPExecutable(runtimeDir string) (string, error) {
	if runtime.GOOS != "windows" {
		return "", fmt.Errorf(
			"bundled Kotlin LSP is Windows-only, current platform: %s",
			runtime.GOOS,
		)
	}

	entrypoint := filepath.Join(
		runtimeDir,
		"bin",
		"intellij-server.exe",
	)

	info, err := os.Stat(entrypoint)
	if err != nil {
		return "", fmt.Errorf(
			"Kotlin LSP executable not found at %s: %w",
			entrypoint,
			err,
		)
	}
	if info.IsDir() {
		return "", fmt.Errorf(
			"Kotlin LSP entrypoint is a directory: %s",
			entrypoint,
		)
	}

	return entrypoint, nil
}

// kotlinLSPJBRDir returns the bundled JetBrains Runtime directory inside
// runtime/kotlin, used instead of the system JDK.
func kotlinLSPJBRDir(runtimeDir string) string {
	return filepath.Join(runtimeDir, "jbr")
}

// kotlinLSPJavaExecutable returns the bundled JBR's java executable.
// Reused not just to launch the Kotlin LSP itself but also Kotlin's
// jar-based formatter/linter tools (ktfmt, ktlint - see ktfmt.go/
// ktlint.go), so the whole Kotlin toolchain works without depending on a
// system-installed JDK, matching the LSP's own zero-external-dependency
// design.
func kotlinLSPJavaExecutable(jbrDir string) string {
	name := "java"
	if runtime.GOOS == "windows" {
		name = "java.exe"
	}
	return filepath.Join(jbrDir, "bin", name)
}

// kotlinWorkspaceDir returns a stable, writable per-project cache/index
// directory for kotlin-lsp's --system-path flag, deterministically
// derived from the project root the same way jdtlsWorkspaceDir is -
// reusing that exact hashing so both language servers' cache directories
// live side by side under the same MervCode cache root.
func kotlinWorkspaceDir(projectRoot string) (string, error) {
	cacheDir, err := os.UserCacheDir()
	if err != nil {
		return "", fmt.Errorf("resolve user cache directory: %w", err)
	}

	dir := filepath.Join(cacheDir, "MervCode", "kotlin-lsp-workspaces", projectHash(projectRoot))
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", fmt.Errorf("create Kotlin LSP workspace directory: %w", err)
	}

	return dir, nil
}

// kotlinLSAvailable is a cheap, network-free check for whether the
// bundled Kotlin LSP can actually be launched right now: the
// bundled runtime directory, its JBR, and the platform executable all exist.
// It never panics - any failure just makes it return false.
func kotlinLSAvailable() bool {
	runtimeDir, err := resolveKotlinRuntimeDir()
	if err != nil {
		return false
	}

	entrypoint, err := kotlinLSPExecutable(runtimeDir)
	if err != nil {
		return false
	}
	if info, err := os.Stat(entrypoint); err != nil || info.IsDir() {
		return false
	}

	jbrDir := kotlinLSPJBRDir(runtimeDir)
	if info, err := os.Stat(jbrDir); err != nil || !info.IsDir() {
		return false
	}

	return true
}

// ResolveKotlinLS builds the exact invocation for launching the bundled
// Kotlin LSP against projectRoot: locates the runtime, its launcher
// script, and a stable per-project cache directory, and points
// JAVA_HOME/PATH at the bundled JBR so the server never falls back to
// whatever (possibly absent, possibly wrong-version) JDK the user has
// installed system-wide. The Kotlin LSP executable is executed directly. (no
// cmd.exe, no shell) via exec.CommandContext.
func ResolveKotlinLS(_ context.Context, projectRoot string) (string, []string, []string, error) {
	runtimeDir, err := resolveKotlinRuntimeDir()
	if err != nil {
		return "", nil, nil, err
	}

	entrypoint, err := kotlinLSPExecutable(runtimeDir)
	if err != nil {
		return "", nil, nil, err
	}
	if info, err := os.Stat(entrypoint); err != nil || info.IsDir() {
		return "", nil, nil, fmt.Errorf("Kotlin LSP executable not found at %s", entrypoint)
	}

	jbrDir := kotlinLSPJBRDir(runtimeDir)
	if info, err := os.Stat(jbrDir); err != nil || !info.IsDir() {
		return "", nil, nil, fmt.Errorf("bundled JetBrains Runtime not found at %s", jbrDir)
	}
	jbrBin := filepath.Join(jbrDir, "bin")

	workspaceDir, err := kotlinWorkspaceDir(projectRoot)
	if err != nil {
		return "", nil, nil, err
	}

	args := []string{"--stdio", "--system-path", workspaceDir}

	env := []string{
		"JAVA_HOME=" + jbrDir,
		"PATH=" + jbrBin + string(os.PathListSeparator) + os.Getenv("PATH"),
	}

	return entrypoint, args, env, nil
}
