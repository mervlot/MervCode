package main

import (
	"fmt"
	"path/filepath"
)

// ============================================================================
// google-java-format - the Java formatter, bundled under
// runtime/java/google-java-format as a single "-all-deps" jar. Wired into
// the "java" entry in toolchain.go via FormatterConfig.Resolve.
//
// Requires a real JDK (jdk.compiler module), not just a JRE, so this runs
// on the system `java` already required for JDTLS itself (see jdtls.go) -
// no separate bundled runtime needed for Java's own tools, unlike
// Kotlin's (which bundles its own JBR because the Kotlin LSP itself needs
// one; see kotlin.go).
// ============================================================================

// resolveGoogleJavaFormatJar locates the bundled google-java-format
// "-all-deps" jar under runtime/java/google-java-format.
func resolveGoogleJavaFormatJar() (string, error) {
	javaDir, err := resolveBundledRuntimeDir("java")
	if err != nil {
		return "", err
	}

	dir := filepath.Join(javaDir, "google-java-format")
	jar, err := findJarByPrefix(dir, "google-java-format-")
	if err != nil {
		return "", fmt.Errorf("locate bundled google-java-format jar: %w", err)
	}
	return jar, nil
}

// googleJavaFormatAvailable is a cheap, network-free check for whether
// google-java-format can actually be launched right now: a JDK-capable
// `java` exists on PATH and the bundled jar is present. Never panics - any
// failure just makes it return false.
func googleJavaFormatAvailable() bool {
	if _, err := findToolBinary("java"); err != nil {
		return false
	}
	_, err := resolveGoogleJavaFormatJar()
	return err == nil
}

// ResolveGoogleJavaFormat builds the exact `java -jar ... -` invocation for
// formatting: "-" tells google-java-format to read Java source from stdin
// and write the formatted result to stdout, matching FormatterConfig's
// Stdin convention exactly - it never touches the file on disk itself.
func ResolveGoogleJavaFormat(_ string) (string, []string, error) {
	javaPath, err := findToolBinary("java")
	if err != nil {
		return "", nil, fmt.Errorf("Java runtime not found. google-java-format requires a JDK (not just a JRE) - install one and ensure `java` is available on PATH: %w", err)
	}

	jar, err := resolveGoogleJavaFormatJar()
	if err != nil {
		return "", nil, err
	}

	return javaPath, []string{"-jar", jar, "-"}, nil
}
