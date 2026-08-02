package main

import "encoding/json"

// ============================================================================
// ESLint integration - one pluggable linter implementation, wired into the
// "typescript" entry in toolchain.go via LinterConfig.DynamicArgs/Parse.
// LintDocument (toolchain.go) itself knows nothing about ESLint; adding
// another language's linter (Python's ruff, Go's golangci-lint, ...) means
// adding a similarly-scoped file with its own arg builder + Parse function
// and pointing that language's LinterConfig at them - no changes to the
// engine itself.
// ============================================================================

// eslintArgs builds the CLI arguments for linting a single file's content
// piped over stdin:
//   - --stdin makes ESLint read the source from stdin instead of a real
//     file on disk (so linting reflects unsaved editor content).
//   - --stdin-filename tells it which real path to resolve config/
//     overrides/parser against, and to report in its own output.
//   - --format json gives a stable, machine-parseable result shape.
func eslintArgs(filePath string) []string {
	return []string{"--stdin", "--stdin-filename", filePath, "--format", "json"}
}

// parseESLintJSON parses `eslint --format json`'s stdout - an array of
// per-file results, each carrying its own list of messages - into
// normalized LintDiagnostics. ESLint's severity is 1 (warning) or 2
// (error); anything else is mapped to "info" defensively. filePath is
// unused: ESLint is invoked against exactly one file (--stdin-filename),
// so its whole result already belongs to that file - no filtering needed,
// unlike golangci-lint's package-wide output (see golangci-lint.go).
func parseESLintJSON(output []byte, _ string) ([]LintDiagnostic, error) {
	type eslintMessage struct {
		RuleID    string `json:"ruleId"`
		Severity  int    `json:"severity"`
		Message   string `json:"message"`
		Line      int    `json:"line"`
		Column    int    `json:"column"`
		EndLine   int    `json:"endLine"`
		EndColumn int    `json:"endColumn"`
	}
	type eslintResult struct {
		Messages []eslintMessage `json:"messages"`
	}

	var results []eslintResult
	if err := json.Unmarshal(output, &results); err != nil {
		return nil, err
	}

	diagnostics := make([]LintDiagnostic, 0, len(results))
	for _, result := range results {
		for _, m := range result.Messages {
			severity := "info"
			switch m.Severity {
			case 2:
				severity = "error"
			case 1:
				severity = "warning"
			}
			diagnostics = append(diagnostics, LintDiagnostic{
				Severity:  severity,
				Message:   m.Message,
				RuleID:    m.RuleID,
				Line:      m.Line,
				Column:    m.Column,
				EndLine:   m.EndLine,
				EndColumn: m.EndColumn,
			})
		}
	}
	return diagnostics, nil
}
