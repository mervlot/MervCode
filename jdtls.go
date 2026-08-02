package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
)

// ============================================================================
// Bundled JDTLS (Eclipse JDT Language Server) launcher.
//
// MervCode ships its own copy of JDTLS under runtime/java rather than
// requiring the user to install a `jdtls`/`jdtls.bat` wrapper script
// themselves. This file resolves that bundled distribution's platform-
// specific config directory and Equinox launcher jar, and builds the
// exact `java -jar ...` invocation used to start it - see the "java"
// entry in toolchain.go, which wires jdtlsAvailable/ResolveJDTLS in as
// LSPConfig.IsAvailable/Resolve.
//
// Bundled runtime/java/jdtls layout (versions vary between JDTLS releases):
//
//	runtime/java/jdtls/
//	├── config_win/config.ini        (Windows amd64)
//	├── config_linux/config.ini      (Linux amd64)
//	├── config_linux_arm/config.ini  (Linux arm64)
//	├── config_mac/config.ini        (macOS amd64)
//	├── config_mac_arm/config.ini    (macOS arm64)
//	├── config_ss_*/                 (syntax-server configs - NOT used here)
//	├── features/                    (not used to launch - see plugins/)
//	└── plugins/
//	    └── org.eclipse.equinox.launcher_<version>.jar   (the one we want)
//	    └── org.eclipse.equinox.launcher.<platform>_<version>.jar (fragments - NOT this one)
// ============================================================================

// resolveJDTLSRuntimeDir locates the bundled JDTLS distribution, nested
// one level under runtime/java (runtime/java/jdtls) alongside any other
// Java-related bundled tooling that may live under runtime/java in the
// future.
func resolveJDTLSRuntimeDir() (string, error) {
	javaDir, err := resolveBundledRuntimeDir("java")
	if err != nil {
		return "", err
	}

	jdtlsDir := filepath.Join(javaDir, "jdtls")
	if info, err := os.Stat(jdtlsDir); err != nil || !info.IsDir() {
		return "", fmt.Errorf("bundled JDTLS directory not found at %s", jdtlsDir)
	}

	return jdtlsDir, nil
}

// jdtlsConfigDirName maps the current OS/architecture to the matching
// bundled config directory name. Returns an explicit error for anything
// unsupported rather than silently falling back to an incompatible one.
func jdtlsConfigDirName() (string, error) {
	switch runtime.GOOS {
	case "windows":
		if runtime.GOARCH == "amd64" {
			return "config_win", nil
		}
	case "linux":
		switch runtime.GOARCH {
		case "amd64":
			return "config_linux", nil
		case "arm64":
			return "config_linux_arm", nil
		}
	case "darwin":
		switch runtime.GOARCH {
		case "amd64":
			return "config_mac", nil
		case "arm64":
			return "config_mac_arm", nil
		}
	}
	return "", fmt.Errorf("unsupported JDTLS platform: %s/%s", runtime.GOOS, runtime.GOARCH)
}

// findEquinoxLauncher scans pluginsDir for the base Equinox launcher jar
// (org.eclipse.equinox.launcher_<version>.jar), explicitly excluding the
// platform-specific launcher fragments (...win32..., ...gtk..., ...cocoa...)
// which live alongside it but aren't what `java -jar` should point at.
func findEquinoxLauncher(pluginsDir string) (string, error) {
	entries, err := os.ReadDir(pluginsDir)
	if err != nil {
		return "", fmt.Errorf("read JDTLS plugins directory: %w", err)
	}

	const prefix = "org.eclipse.equinox.launcher_"
	fragmentMarkers := []string{".win32.", ".gtk.", ".cocoa."}

	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		name := e.Name()
		if !strings.HasPrefix(name, prefix) || !strings.HasSuffix(name, ".jar") {
			continue
		}
		isFragment := false
		for _, marker := range fragmentMarkers {
			if strings.Contains(name, marker) {
				isFragment = true
				break
			}
		}
		if isFragment {
			continue
		}
		return filepath.Join(pluginsDir, name), nil
	}

	return "", fmt.Errorf("JDTLS Equinox launcher jar not found in %s", pluginsDir)
}

// jdtlsWorkspaceDir returns a stable, writable per-project workspace
// directory for jdtls's `-data` flag, deterministically derived from the
// project root so re-opening the same project reuses the same workspace.
// This intentionally lives outside the bundled runtime/java directory
// (which should stay pristine/read-only) in the OS's standard cache
// location.
func jdtlsWorkspaceDir(projectRoot string) (string, error) {
	cacheDir, err := os.UserCacheDir()
	if err != nil {
		return "", fmt.Errorf("resolve user cache directory: %w", err)
	}

	dir := filepath.Join(cacheDir, "MervCode", "jdtls-workspaces", projectHash(projectRoot))
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", fmt.Errorf("create JDTLS workspace directory: %w", err)
	}

	return dir, nil
}

// jdtlsAvailable is a cheap, network-free check for whether JDTLS can
// actually be launched right now: a Java executable exists, the bundled
// runtime is present, this platform's config directory and config.ini
// exist, and the base Equinox launcher jar is present. It never panics -
// any failure just makes it return false.
func jdtlsAvailable() bool {
	if _, err := findToolBinary("java"); err != nil {
		return false
	}

	runtimeDir, err := resolveJDTLSRuntimeDir()
	if err != nil {
		return false
	}

	configName, err := jdtlsConfigDirName()
	if err != nil {
		return false
	}

	configIni := filepath.Join(runtimeDir, configName, "config.ini")
	if info, err := os.Stat(configIni); err != nil || info.IsDir() {
		return false
	}

	if _, err := findEquinoxLauncher(filepath.Join(runtimeDir, "plugins")); err != nil {
		return false
	}

	return true
}

// ResolveJDTLS builds the exact `java ...` invocation for launching the
// bundled JDTLS against projectRoot: locates the Java executable, the
// runtime, this platform's config directory, the Equinox launcher jar,
// and a stable per-project workspace directory, then assembles the
// standard JDTLS JVM arguments. The returned command/args are meant to be
// used directly with exec.CommandContext - no shell wrapping.
func ResolveJDTLS(_ context.Context, projectRoot string) (string, []string, []string, error) {
	javaPath, err := findToolBinary("java")
	if err != nil {
		return "", nil, nil, fmt.Errorf("Java runtime not found. JDTLS requires a compatible JDK - install one and ensure `java` is available on PATH: %w", err)
	}

	runtimeDir, err := resolveJDTLSRuntimeDir()
	if err != nil {
		return "", nil, nil, err
	}

	configName, err := jdtlsConfigDirName()
	if err != nil {
		return "", nil, nil, err
	}

	configDir := filepath.Join(runtimeDir, configName)
	configIni := filepath.Join(configDir, "config.ini")
	if info, err := os.Stat(configIni); err != nil || info.IsDir() {
		return "", nil, nil, fmt.Errorf("JDTLS config.ini not found at %s", configIni)
	}

	launcherJar, err := findEquinoxLauncher(filepath.Join(runtimeDir, "plugins"))
	if err != nil {
		return "", nil, nil, err
	}

	workspaceDir, err := jdtlsWorkspaceDir(projectRoot)
	if err != nil {
		return "", nil, nil, err
	}

	args := []string{
		"-Declipse.application=org.eclipse.jdt.ls.core.id1",
		"-Dosgi.bundles.defaultStartLevel=4",
		"-Declipse.product=org.eclipse.jdt.ls.core.product",
		"-Dlog.level=ALL",
		"-Xmx1G",
		"--add-modules=ALL-SYSTEM",
		"--add-opens", "java.base/java.util=ALL-UNNAMED",
		"--add-opens", "java.base/java.lang=ALL-UNNAMED",
		"-jar", launcherJar,
		"-configuration", configDir,
		"-data", workspaceDir,
	}

	return javaPath, args, nil, nil
}
