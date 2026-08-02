package main

import (
	"encoding/json"
	"path/filepath"
)

// ============================================================================
// golangci-lint integration - one pluggable linter implementation, wired
// into the "go" entry in toolchain.go via LinterConfig. Mirrors eslint.go's
// role: LintDocument (toolchain.go) has zero golangci-lint-specific
// knowledge, only calling DynamicArgs/Parse below.
//
// Unlike ESLint, golangci-lint type-checks real Go packages and its `run`
// command has no stdin mode (only its separate `fmt` command supports
// --stdin), so Go linting always reflects the file's last-saved contents
// on disk - the "go" toolchain entry leaves LinterConfig.Stdin false, and
// the `content` parameter LintDocument otherwise pipes in is simply
// unused for this language.
//
// Targets the classic v1 CLI (`--out-format json`), matching
// `go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest`
// - that import path (without a `/v2` suffix) resolves to the latest
// v1.x release under Go's module versioning rules. golangci-lint v2
// renamed this to `--output.json.path stdout`; if MervCode ever needs to
// support both, that only changes golangciLintArgs, not the JSON shape
// parseGolangciLintJSON understands (Issues[].Pos is unchanged between
// the two).
// ============================================================================

// golangciLintArgs runs golangci-lint against just "." - LintDocument runs
// every linter with its working directory set to filePath's own directory
// (see toolchain.go), so this scopes analysis to the single package
// containing the open file rather than paying to lint the whole module on
// every debounce tick.
func golangciLintArgs(_ string) []string {
	return []string{"run", "--out-format", "json", "."}
}

type golangciLintIssue struct {
	FromLinter string `json:"FromLinter"`
	Text       string `json:"Text"`
	Severity   string `json:"Severity"`
	Pos        struct {
		Filename string `json:"Filename"`
		Line     int    `json:"Line"`
		Column   int    `json:"Column"`
	} `json:"Pos"`
}

type golangciLintOutput struct {
	Issues []golangciLintIssue `json:"Issues"`
}

// parseGolangciLintJSON parses `golangci-lint run --out-format json`'s
// stdout into normalized LintDiagnostics, keeping only issues reported
// against filePath itself. golangci-lint analyzes the whole package
// directory (see golangciLintArgs), which commonly includes other files
// MervCode isn't currently asking to lint. Matched by base name rather
// than a full path comparison since golangci-lint's own reported path can
// be absolute, relative to its working directory, or relative to the
// discovered module root depending on version/flags - a base name
// collision isn't a realistic concern within the single directory
// LintDocument scopes each run to.
func parseGolangciLintJSON(output []byte, filePath string) ([]LintDiagnostic, error) {
	var parsed golangciLintOutput
	if err := json.Unmarshal(output, &parsed); err != nil {
		return nil, err
	}

	targetName := filepath.Base(filePath)
	diagnostics := make([]LintDiagnostic, 0, len(parsed.Issues))
	for _, issue := range parsed.Issues {
		if filepath.Base(issue.Pos.Filename) != targetName {
			continue
		}
		diagnostics = append(diagnostics, LintDiagnostic{
			Severity: normalizeGolangciSeverity(issue.Severity),
			Message:  issue.Text,
			RuleID:   issue.FromLinter,
			Line:     issue.Pos.Line,
			Column:   issue.Pos.Column,
		})
	}
	return diagnostics, nil
}

// normalizeGolangciSeverity maps golangci-lint's own severity string -
// empty by default unless a `severity` config section assigns one - to
// MervCode's normalized set. An unconfigured issue is still a real,
// actionable finding, so it defaults to "warning" rather than being
// silently miscategorized as mere "info".
func normalizeGolangciSeverity(severity string) string {
	switch severity {
	case "error":
		return "error"
	case "info", "note":
		return "info"
	default:
		return "warning"
	}
}
