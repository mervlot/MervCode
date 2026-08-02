package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

// ============================================================================
// ktlint - the Kotlin linter, bundled under runtime/kotlin/ktlint as the
// plain "ktlint" jar (deliberately not ktlint.bat - see the comment on
// ResolveKtlint). Wired into the "kotlin" entry in toolchain.go via
// LinterConfig.Resolve/Parse.
//
// Runs on the Kotlin LSP's bundled JBR, same as ktfmt (see ktfmt.go), and
// used purely for lint diagnostics here - ktfmt is MervCode's designated
// Kotlin formatter, even though ktlint can also autoformat.
// ============================================================================

// resolveKtlintJar locates the bundled ktlint executable jar under
// runtime/kotlin/ktlint. Unlike checkstyle/google-java-format/ktfmt, this
// filename has no version number to search for - the release asset is
// just named "ktlint" - so it's referenced directly rather than via
// findJarByPrefix.
func resolveKtlintJar(kotlinDir string) (string, error) {
	jar := filepath.Join(kotlinDir, "ktlint", "ktlint")
	if info, err := os.Stat(jar); err != nil || info.IsDir() {
		return "", fmt.Errorf("bundled ktlint jar not found at %s", jar)
	}
	return jar, nil
}

// ktlintAvailable is a cheap, network-free check for whether ktlint can
// actually be launched right now: the bundled Kotlin LSP's JBR and the
// ktlint jar itself are both present. Never panics - any failure just
// makes it return false.
func ktlintAvailable() bool {
	runtimeDir, err := resolveKotlinRuntimeDir()
	if err != nil {
		return false
	}
	javaExe := kotlinLSPJavaExecutable(kotlinLSPJBRDir(runtimeDir))
	if info, err := os.Stat(javaExe); err != nil || info.IsDir() {
		return false
	}

	kotlinDir, err := resolveBundledRuntimeDir("kotlin")
	if err != nil {
		return false
	}
	_, err = resolveKtlintJar(kotlinDir)
	return err == nil
}

// ResolveKtlint builds the exact `java -jar ktlint --stdin
// --reporter=json` invocation. ktlint's release ships both a plain
// executable jar ("ktlint") and a "ktlint.bat" Windows launcher script;
// running the jar directly through the bundled JBR's own `java` works
// identically on every platform, so ktlint.bat is deliberately unused -
// one invocation path instead of two to keep in sync.
func ResolveKtlint(_ string) (string, []string, error) {
	runtimeDir, err := resolveKotlinRuntimeDir()
	if err != nil {
		return "", nil, err
	}

	javaExe := kotlinLSPJavaExecutable(kotlinLSPJBRDir(runtimeDir))
	if info, err := os.Stat(javaExe); err != nil || info.IsDir() {
		return "", nil, fmt.Errorf("bundled Kotlin JBR java executable not found at %s", javaExe)
	}

	kotlinDir, err := resolveBundledRuntimeDir("kotlin")
	if err != nil {
		return "", nil, err
	}
	jar, err := resolveKtlintJar(kotlinDir)
	if err != nil {
		return "", nil, err
	}

	return javaExe, []string{"-jar", jar, "--stdin", "--reporter=json"}, nil
}

type ktlintFileResult struct {
	File   string        `json:"file"`
	Errors []ktlintError `json:"errors"`
}

type ktlintError struct {
	Line    int    `json:"line"`
	Column  int    `json:"column"`
	Message string `json:"message"`
	Rule    string `json:"rule"`
}

// parseKtlintJSON parses `ktlint --reporter=json`'s stdout into normalized
// LintDiagnostics. Unlike golangci-lint/checkstyle, no filename filtering
// is applied: ktlint is only ever given one file's content over stdin
// (see ResolveKtlint), so every reported error already belongs to it,
// even though ktlint itself labels the entry "<stdin>" rather than the
// real path.
//
// ktlint has occasionally printed deprecation warnings to stdout ahead of
// the JSON array (see https://github.com/pinterest/ktlint/issues/1137),
// which would otherwise break json.Unmarshal outright - the array start
// is located explicitly to stay resilient to that.
func parseKtlintJSON(output []byte, _ string) ([]LintDiagnostic, error) {
	start := bytes.IndexByte(output, '[')
	if start < 0 {
		return nil, fmt.Errorf("no JSON array found in ktlint output")
	}
	output = output[start:]

	var results []ktlintFileResult
	if err := json.Unmarshal(output, &results); err != nil {
		return nil, err
	}

	var diagnostics []LintDiagnostic
	for _, result := range results {
		for _, e := range result.Errors {
			diagnostics = append(diagnostics, LintDiagnostic{
				Severity: "warning",
				Message:  e.Message,
				RuleID:   e.Rule,
				Line:     e.Line,
				Column:   e.Column,
			})
		}
	}
	return diagnostics, nil
}
