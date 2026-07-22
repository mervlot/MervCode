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
	Category string `json:"category"` // "editor", "image", "video", "audio", "pdf", "spreadsheet", "binary"
	Content  string `json:"content"`  // Text content OR a fully qualified Base64 Data URL for media canvases
}
type SearchMatch struct {
	Path    string `json:"path"`
	Line    int    `json:"line"`
	Column  int    `json:"column"`
	Preview string `json:"preview"`
}
type GitFileStatus struct {
	Path   string `json:"path"`   // absolute path
	Rel    string `json:"rel"`    // path relative to repo root, as reported by git
	Status string `json:"status"` // "M", "A", "D", "R", "??", etc (porcelain code)
}

type GitStatusResult struct {
	IsRepo bool            `json:"isRepo"`
	Branch string          `json:"branch"`
	Files  []GitFileStatus `json:"files"`
}
