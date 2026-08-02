package main

import (
	"encoding/xml"
	"fmt"
	"path/filepath"
	"strings"
)

// ============================================================================
// Checkstyle - the Java style/code-quality linter, bundled under
// runtime/java/checkstyle as a single "-all" jar. Wired into the "java"
// entry in toolchain.go via LinterConfig.Resolve/Parse.
//
// Checkstyle has no stdin mode, so - like golangci-lint (see
// golangci-lint.go) - this always analyzes the file's last-saved contents
// on disk, not live unsaved edits. Unlike golangci-lint, it operates on a
// single file directly rather than needing whole-package/compiled
// context, so it's given filePath itself rather than a directory.
//
// Uses Google's bundled check configuration (/google_checks.xml, a
// classpath resource inside the checkstyle jar itself - see
// https://checkstyle.org/google_style.html) rather than requiring
// MervCode to ship and maintain its own config XML, keeping behavior
// consistent with google-java-format's Google-style formatting.
// ============================================================================

const checkstyleConfig = "/google_checks.xml"

// resolveCheckstyleJar locates the bundled checkstyle "-all" jar under
// runtime/java/checkstyle.
func resolveCheckstyleJar() (string, error) {
	javaDir, err := resolveBundledRuntimeDir("java")
	if err != nil {
		return "", err
	}

	dir := filepath.Join(javaDir, "checkstyle")
	jar, err := findJarByPrefix(dir, "checkstyle-")
	if err != nil {
		return "", fmt.Errorf("locate bundled checkstyle jar: %w", err)
	}
	return jar, nil
}

// checkstyleAvailable is a cheap, network-free check for whether
// checkstyle can actually be launched right now: a JDK-capable `java`
// exists on PATH and the bundled jar is present. Never panics - any
// failure just makes it return false.
func checkstyleAvailable() bool {
	if _, err := findToolBinary("java"); err != nil {
		return false
	}
	_, err := resolveCheckstyleJar()
	return err == nil
}

// ResolveCheckstyle builds the exact `java -jar ... -c ... -f xml <file>`
// invocation: -f xml gives a stable, machine-parseable result shape (see
// parseCheckstyleXML), and the file is passed by path since checkstyle has
// no stdin mode.
func ResolveCheckstyle(filePath string) (string, []string, error) {
	javaPath, err := findToolBinary("java")
	if err != nil {
		return "", nil, fmt.Errorf("Java runtime not found. Checkstyle requires a JDK - install one and ensure `java` is available on PATH: %w", err)
	}

	jar, err := resolveCheckstyleJar()
	if err != nil {
		return "", nil, err
	}

	return javaPath, []string{"-jar", jar, "-c", checkstyleConfig, "-f", "xml", filePath}, nil
}

type checkstyleXMLReport struct {
	XMLName xml.Name         `xml:"checkstyle"`
	Files   []checkstyleFile `xml:"file"`
}

type checkstyleFile struct {
	Name   string               `xml:"name,attr"`
	Errors []checkstyleXMLError `xml:"error"`
}

type checkstyleXMLError struct {
	Line     int    `xml:"line,attr"`
	Column   int    `xml:"column,attr"`
	Severity string `xml:"severity,attr"`
	Message  string `xml:"message,attr"`
	Source   string `xml:"source,attr"`
}

// parseCheckstyleXML parses `checkstyle -f xml`'s stdout into normalized
// LintDiagnostics, keeping only violations reported against filePath
// itself (checkstyle is only ever invoked against exactly one file - see
// ResolveCheckstyle - so this is mostly a defensive safety net rather
// than a real filter). Matched by base name for the same reason
// golangci-lint's parser is: checkstyle's own reported path can be
// absolute or relative depending on how it was invoked.
func parseCheckstyleXML(output []byte, filePath string) ([]LintDiagnostic, error) {
	var report checkstyleXMLReport
	if err := xml.Unmarshal(output, &report); err != nil {
		return nil, err
	}

	targetName := filepath.Base(filePath)
	var diagnostics []LintDiagnostic
	for _, file := range report.Files {
		if filepath.Base(file.Name) != targetName {
			continue
		}
		for _, e := range file.Errors {
			diagnostics = append(diagnostics, LintDiagnostic{
				Severity: normalizeCheckstyleSeverity(e.Severity),
				Message:  e.Message,
				RuleID:   simplifyCheckstyleSource(e.Source),
				Line:     e.Line,
				Column:   e.Column,
			})
		}
	}
	return diagnostics, nil
}

// normalizeCheckstyleSeverity maps checkstyle's own severity attribute
// ("error", "warning", "info", "ignore") to MervCode's normalized set.
// "ignore"-severity violations are never actually reported by checkstyle
// in the first place, so they're mapped defensively rather than expected.
func normalizeCheckstyleSeverity(severity string) string {
	switch severity {
	case "error":
		return "error"
	case "info", "ignore":
		return "info"
	default:
		return "warning"
	}
}

// simplifyCheckstyleSource trims a checkstyle check's fully-qualified
// class name (e.g. "com.puppycrawl.tools.checkstyle.checks.naming.
// MemberNameCheck") down to just the check name, which is what's actually
// meaningful to a MervCode user.
func simplifyCheckstyleSource(source string) string {
	if idx := strings.LastIndex(source, "."); idx >= 0 {
		return source[idx+1:]
	}
	return source
}
