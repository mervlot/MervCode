package types

type FileItem struct {
	Name     string     `json:"name"`
	Path     string     `json:"path"`
	IsDir    bool       `json:"isDir"`
	Children []FileItem `json:"children,omitempty"`
}

type Diagnostic struct {
	Line      int    `json:"line"`
	Column    int    `json:"column"`
	EndLine   int    `json:"endLine"`
	EndColumn int    `json:"endColumn"`
	Message   string `json:"message"`
	Severity  string `json:"severity"`
}
type FileResponse struct {
	Category string `json:"category"`
	Content  string `json:"content"`
}
type SearchMatch struct {
	Path    string `json:"path"`
	Line    int    `json:"line"`
	Column  int    `json:"column"`
	Preview string `json:"preview"`
}
type GitFileStatus struct {
	Path   string `json:"path"`
	Rel    string `json:"rel"`
	Status string `json:"status"`
}

type GitStatusResult struct {
	IsRepo bool            `json:"isRepo"`
	Branch string          `json:"branch"`
	Files  []GitFileStatus `json:"files"`
}

// LSP types
type LSPPosition struct {
	Line      int `json:"line"`
	Character int `json:"character"`
}

type LSPRange struct {
	Start LSPPosition `json:"start"`
	End   LSPPosition `json:"end"`
}

type LSPHoverResult struct {
	Contents interface{} `json:"contents"`
	Range    *LSPRange   `json:"range,omitempty"`
}

type LSPCompletionItem struct {
	Label         string `json:"label"`
	Kind          int    `json:"kind"`
	Detail        string `json:"detail,omitempty"`
	Documentation string `json:"documentation,omitempty"`
	InsertText    string `json:"insertText,omitempty"`
}

type LSPLocation struct {
	URI   string   `json:"uri"`
	Range LSPRange `json:"range"`
}

type LSPDiagnostic struct {
	Range    LSPRange `json:"range"`
	Message  string   `json:"message"`
	Severity int      `json:"severity,omitempty"`
	Source   string   `json:"source,omitempty"`
}

type LSPPublishDiagnosticsParams struct {
	URI         string          `json:"uri"`
	Diagnostics []LSPDiagnostic `json:"diagnostics"`
}
