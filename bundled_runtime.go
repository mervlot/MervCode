package main

import (
	"crypto/sha1"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// resolveBundledRuntimeDir locates a bundled runtime/<name> directory
// (e.g. "java" for JDTLS, "kotlin" for the Kotlin LSP). It tries, in
// order: next to the running executable (production build), then
// relative to the current working directory (source tree / `wails dev`),
// so it works whether MervCode is running built or from source.
func resolveBundledRuntimeDir(name string) (string, error) {
	var candidates []string

	if exePath, err := os.Executable(); err == nil {
		exeDir := filepath.Dir(exePath)
		candidates = append(candidates,
			filepath.Join(exeDir, "runtime", name),
			filepath.Join(exeDir, "resources", "runtime", name),
		)
	}

	if wd, err := os.Getwd(); err == nil {
		candidates = append(candidates, filepath.Join(wd, "runtime", name))
	}

	for _, c := range candidates {
		if info, err := os.Stat(c); err == nil && info.IsDir() {
			return c, nil
		}
	}

	return "", fmt.Errorf("bundled runtime/%s directory not found (looked in: %s)", name, strings.Join(candidates, ", "))
}

// projectHash derives a short, stable, filesystem-safe identifier for a
// project root, used to build deterministic per-project cache/workspace
// directory names (so reopening the same project reuses the same
// directory instead of accumulating a new one on every launch).
func projectHash(projectRoot string) string {
	sum := sha1.Sum([]byte(filepath.Clean(projectRoot)))
	return hex.EncodeToString(sum[:])[:16]
}

// findJarByPrefix scans dir for the first regular file whose name starts
// with prefix and ends in ".jar" - used to locate a bundled tool's fat
// jar (checkstyle, google-java-format, ktfmt, ...) without hardcoding its
// exact version number in source, so bumping a bundled tool's version
// never requires a matching code change.
func findJarByPrefix(dir, prefix string) (string, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return "", fmt.Errorf("read %s: %w", dir, err)
	}

	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		name := e.Name()
		if strings.HasPrefix(name, prefix) && strings.HasSuffix(name, ".jar") {
			return filepath.Join(dir, name), nil
		}
	}

	return "", fmt.Errorf("no %s*.jar found in %s", prefix, dir)
}
