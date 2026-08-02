package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestResolveProjectRootUsesNearestMarker(t *testing.T) {
	NewApp().InvalidateWorkspaceCache()
	root := t.TempDir()
	project := filepath.Join(root, "apps", "service")
	sourceDir := filepath.Join(project, "src", "main")
	if err := os.MkdirAll(sourceDir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(project, "build.gradle.kts"), nil, 0o644); err != nil {
		t.Fatal(err)
	}

	resolved, err := NewApp().ResolveProjectRoot(
		"kotlin",
		filepath.Join(sourceDir, "App.kt"),
		root,
	)
	if err != nil {
		t.Fatal(err)
	}
	if resolved != project {
		t.Fatalf("resolved root = %q, want %q", resolved, project)
	}
}

func TestResolveProjectRootFallsBackToDocumentDirectoryForRelativeWorkspace(t *testing.T) {
	NewApp().InvalidateWorkspaceCache()
	root := t.TempDir()
	documentDir := filepath.Join(root, "scratch")
	if err := os.MkdirAll(documentDir, 0o755); err != nil {
		t.Fatal(err)
	}

	resolved, err := NewApp().ResolveProjectRoot(
		"kotlin",
		filepath.Join(documentDir, "Scratch.kt"),
		".",
	)
	if err != nil {
		t.Fatal(err)
	}
	if resolved != documentDir {
		t.Fatalf("resolved root = %q, want document directory %q", resolved, documentDir)
	}
	if !filepath.IsAbs(resolved) {
		t.Fatalf("resolved root must be absolute, got %q", resolved)
	}
}

func TestResolveProjectRootUsesAbsoluteWorkspaceFallback(t *testing.T) {
	NewApp().InvalidateWorkspaceCache()
	root := t.TempDir()
	documentDir := filepath.Join(root, "scratch")
	workspaceRoot := filepath.Join(root, "opened-workspace")
	if err := os.MkdirAll(documentDir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(workspaceRoot, 0o755); err != nil {
		t.Fatal(err)
	}

	resolved, err := NewApp().ResolveProjectRoot(
		"kotlin",
		filepath.Join(documentDir, "Scratch.kt"),
		workspaceRoot,
	)
	if err != nil {
		t.Fatal(err)
	}
	if resolved != workspaceRoot {
		t.Fatalf("resolved root = %q, want workspace fallback %q", resolved, workspaceRoot)
	}
}
