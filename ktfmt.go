package main

import (
	"fmt"
	"os"
	"path/filepath"
)

// ============================================================================
// ktfmt - the Kotlin formatter (facebook/ktfmt, built on
// google-java-format's engine), bundled under runtime/kotlin/ktfmt as a
// single "-with-dependencies" jar. Wired into the "kotlin" entry in
// toolchain.go via FormatterConfig.Resolve.
//
// Runs on the Kotlin LSP's bundled JBR (see kotlinLSPJavaExecutable in
// kotlin.go) rather than requiring a separate system JDK, so the whole
// Kotlin toolchain - LSP, formatter, and linter - works without depending
// on anything the user installed themselves.
// ============================================================================

// resolveKtfmtJar locates the bundled ktfmt jar under runtime/kotlin/ktfmt.
func resolveKtfmtJar() (string, error) {
	kotlinDir, err := resolveBundledRuntimeDir("kotlin")
	if err != nil {
		return "", err
	}

	dir := filepath.Join(kotlinDir, "ktfmt")
	jar, err := findJarByPrefix(dir, "ktfmt-")
	if err != nil {
		return "", fmt.Errorf("locate bundled ktfmt jar: %w", err)
	}
	return jar, nil
}

// ktfmtAvailable is a cheap, network-free check for whether ktfmt can
// actually be launched right now: the bundled Kotlin LSP's JBR (used to
// run the jar) and the ktfmt jar itself are both present. Never panics -
// any failure just makes it return false.
func ktfmtAvailable() bool {
	runtimeDir, err := resolveKotlinRuntimeDir()
	if err != nil {
		return false
	}
	javaExe := kotlinLSPJavaExecutable(kotlinLSPJBRDir(runtimeDir))
	if info, err := os.Stat(javaExe); err != nil || info.IsDir() {
		return false
	}

	_, err = resolveKtfmtJar()
	return err == nil
}

// ResolveKtfmt builds the exact `java -jar ... --google-style -` invocation
// for formatting: "-" tells ktfmt to read Kotlin source from stdin and
// write the formatted result to stdout (ktfmt shares google-java-format's
// engine and CLI conventions). --google-style keeps ktfmt consistent with
// google-java-format's style for Java in the same project.
func ResolveKtfmt(_ string) (string, []string, error) {
	runtimeDir, err := resolveKotlinRuntimeDir()
	if err != nil {
		return "", nil, err
	}

	javaExe := kotlinLSPJavaExecutable(kotlinLSPJBRDir(runtimeDir))
	if info, err := os.Stat(javaExe); err != nil || info.IsDir() {
		return "", nil, fmt.Errorf("bundled Kotlin JBR java executable not found at %s", javaExe)
	}

	jar, err := resolveKtfmtJar()
	if err != nil {
		return "", nil, err
	}

	return javaExe, []string{"-jar", jar, "--google-style", "-"}, nil
}
