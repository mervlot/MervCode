package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestEnsureKPMJVMProjectModelGeneratesBridgeFiles(t *testing.T) {
	root := t.TempDir()
	mustWrite(t, filepath.Join(root, "kpm.json"), `{
  "name": "demo-kpm",
  "group": "com.example",
  "version": "1.2.3",
  "sourceDir": "src",
  "testDir": "src/test",
  "dependencies": { "org.jetbrains.kotlin:kotlin-stdlib": "2.1.21" }
}`)
	mustWrite(t, filepath.Join(root, "src", "main", "java", "com", "example", "App.java"), "package com.example; class App {}")
	mustWrite(t, filepath.Join(root, "src", "main", "kotlin", "com", "example", "App.kt"), "package com.example\nclass AppKt")
	mustWrite(t, filepath.Join(root, "libs", "org.example", "demo", "1.0", "demo-1.0.jar"), "jar")

	if err := ensureKPMJVMProjectModel(root); err != nil {
		t.Fatal(err)
	}

	for _, name := range []string{"settings.gradle.kts", "build.gradle.kts", ".project", ".classpath"} {
		content := mustRead(t, filepath.Join(root, name))
		if !strings.Contains(content, generatedKPMHeader) {
			t.Fatalf("%s does not contain generated header", name)
		}
	}

	classpath := mustRead(t, filepath.Join(root, ".classpath"))
	for _, expected := range []string{
		`path="src/main/java"`,
		`path="src/main/kotlin"`,
		`path="libs/org.example/demo/1.0/demo-1.0.jar"`,
	} {
		if !strings.Contains(classpath, expected) {
			t.Fatalf(".classpath missing %q:\n%s", expected, classpath)
		}
	}

	build := mustRead(t, filepath.Join(root, "build.gradle.kts"))
	for _, expected := range []string{
		`kotlin("jvm") version "2.1.21"`,
		`implementation(fileTree("libs")`,
	} {
		if !strings.Contains(build, expected) {
			t.Fatalf("build.gradle.kts missing %q:\n%s", expected, build)
		}
	}
}

func TestEnsureKPMJVMProjectModelDoesNotOverwriteUserGradleBuild(t *testing.T) {
	root := t.TempDir()
	mustWrite(t, filepath.Join(root, "kpm.json"), `{"name":"demo"}`)
	mustWrite(t, filepath.Join(root, "build.gradle.kts"), "// user owned\nplugins { java }\n")

	if err := ensureKPMJVMProjectModel(root); err != nil {
		t.Fatal(err)
	}

	build := mustRead(t, filepath.Join(root, "build.gradle.kts"))
	if build != "// user owned\nplugins { java }\n" {
		t.Fatalf("user Gradle build was overwritten:\n%s", build)
	}
	if _, err := os.Stat(filepath.Join(root, "settings.gradle.kts")); !os.IsNotExist(err) {
		t.Fatalf("settings.gradle.kts should not be generated for authoritative user Gradle build, err=%v", err)
	}
}

func TestEnsureKPMJVMProjectModelRegeneratesGeneratedClasspath(t *testing.T) {
	root := t.TempDir()
	mustWrite(t, filepath.Join(root, "kpm.json"), `{"name":"demo"}`)
	mustWrite(t, filepath.Join(root, ".classpath"), "<!-- "+generatedKPMHeader+" -->\nold jar\n")
	mustWrite(t, filepath.Join(root, "libs", "new.jar"), "jar")

	if err := ensureKPMJVMProjectModel(root); err != nil {
		t.Fatal(err)
	}

	classpath := mustRead(t, filepath.Join(root, ".classpath"))
	if strings.Contains(classpath, "old jar") || !strings.Contains(classpath, `path="libs/new.jar"`) {
		t.Fatalf("generated .classpath was not refreshed:\n%s", classpath)
	}
}

func mustWrite(t *testing.T, path, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}

func mustRead(t *testing.T, path string) string {
	t.Helper()
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	return string(data)
}
