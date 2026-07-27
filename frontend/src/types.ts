import type * as monaco from "monaco-editor";

export interface FileItem {
  name: string;
  path: string;
  isDir: boolean;
  children?: FileItem[];
}

export interface FileTab {
  name: string;
  path: string;
  content?: string;
  category?: string;
  isDir: boolean;
}

export interface WorkspaceRoot {
  name: string;
  path: string;
}

export interface EditorSettings {
  // ── Typography ──
  fontSize: number;
  fontFamily: string;
  fontWeight: string | number;
  fontLigatures: boolean;
  lineHeight: number;

  // ── Indentation ──
  tabSize: number;
  insertSpaces: boolean;
  detectIndentation: boolean;
  trimAutoWhitespace: boolean;

  // ── Layout ──
  wordWrap: "off" | "on" | "wordWrapColumn" | "bounded";
  wordWrapColumn: number;
  wordWrapMinIndent: number;
  wrappingIndent: "none" | "same" | "indent" | "deepIndent";
  wrappingStrategy: "simple" | "advanced";

  // ── Line Numbers ──
  lineNumbers: "on" | "off" | "relative" | "interval";
  lineNumbersMinChars: number;
  renderLineHighlight: "none" | "gutter" | "line" | "all";
  renderLineHighlightOnlyWhenFocus: boolean;

  // ── Minimap ──
  minimap: {
    enabled: boolean;
    maxColumn: number;
    renderCharacters: boolean;
    showSlider: "always" | "mouseover";
    scale: number;
    side: "right" | "left";
  };

  // ── Scrollbars ──
  scrollbar: {
    vertical: "auto" | "visible" | "hidden";
    horizontal: "auto" | "visible" | "hidden";
    verticalScrollbarSize: number;
    horizontalScrollbarSize: number;
    useShadows: boolean;
    alwaysConsumeMouseWheel: boolean;
  };

  // ── Overview Ruler ──
  overviewRulerLanes: number;
  overviewRulerBorder: boolean;

  // ── Glyph Margin & Folding ──
  glyphMargin: boolean;
  folding: boolean;
  foldingStrategy: "auto" | "indentation";
  showFoldingControls: "always" | "never" | "mouseover";
  foldingHighlight: boolean;
  foldingImportsByDefault: boolean;

  // ── Match Brackets ──
  matchBrackets: "always" | "never" | "near";

  // ── Cursor ──
  cursorStyle: "line" | "block" | "underline" | "line-thin" | "block-outline" | "underline-thin";
  cursorWidth: number;
  cursorBlinking: "blink" | "smooth" | "phase" | "expand" | "solid";
  cursorSmoothCaretAnimation: "on" | "off" | "explicit";
  cursorSurroundingLines: number;
  cursorSurroundingLinesStyle: "default" | "all";

  // ── Selection ──
  selectionClipboard: boolean;
  copyWithSyntaxHighlighting: boolean;
  emptySelectionClipboard: boolean;

  // ── Multi-Cursor ──
  multiCursorModifier: "alt" | "ctrlCmd";
  multiCursorPaste: "spread" | "same" | "full";
  multiCursorLimit: number;

  // ── IntelliSense ──
  quickSuggestions:
    | boolean
    | { other: boolean; comments: boolean; strings: boolean };
  suggestOnTriggerCharacters: boolean;
  acceptSuggestionOnEnter: "on" | "smart" | "off";
  acceptSuggestionOnCommitCharacter: boolean;
  suggestSelection: "first" | "recentlyUsed" | "recentlyUsedByPrefix";
  tabCompletion: "on" | "off" | "onlySnippets";
  snippetSuggestions: "top" | "bottom" | "inline" | "none";
  inlineSuggest: {
    enabled: boolean;
    showToolbar: "always" | "onHover" | "never";
  };
  suggestFontSize: number;
  suggestLineHeight: number;

  // ── Rendering & Whitespace ──
  renderWhitespace: "none" | "boundary" | "selection" | "trailing" | "all";
  renderControlCharacters: boolean;
  renderIndentGuides: boolean;
  renderFinalNewline: "on" | "off" | "dimmed";
  renderValidationDecorations: "on" | "off" | "editable";

  // ── Bracket Pair Colorization ──
  bracketPairColorization: {
    enabled: boolean;
    independentColorPoolPerBracketType: boolean;
  };

  // ── Unicode Highlight ──
  unicodeHighlight: {
    ambiguousCharacters: boolean;
    invisibleCharacters: boolean;
    nonBasicASCII: boolean;
  };

  // ── Sticky Scroll ──
  stickyScroll: {
    enabled: boolean;
    maxLineCount: number;
  };

  // ── Inlay Hints ──
  inlayHints: {
    enabled: "on" | "off" | "offUnlessPressed" | "onUnlessPressed";
    fontSize: number;
    fontFamily: string;
  };

  // ── Behavior ──
  autoSave: "off" | "afterDelay" | "onFocusChange" | "onWindowChange";
  autoSaveDelay: number;
  formatOnSave: boolean;
  formatOnType: boolean;
  formatOnPaste: boolean;
  autoClosingBrackets: "always" | "languageDefined" | "beforeWhitespace" | "never";
  autoClosingQuotes: "always" | "languageDefined" | "beforeWhitespace" | "never";
  autoClosingOvertype: "always" | "never";
  autoClosingDelete: "always" | "never";
  autoIndent: "none" | "keep" | "brackets" | "advanced" | "full";
  dragAndDrop: boolean;
  selectionHighlight: boolean;
  occurrencesHighlight: "off" | "singleFile" | "multiFile";
  codeLens: boolean;
  codeLensFontFamily: string;
  codeLensFontSize: number;
  parameterHints: { enabled: boolean; cycle: boolean };
  hover: { enabled: boolean; delay: number; sticky: boolean };
  links: boolean;

  // ── Navigation & Scrolling ──
  smoothScrolling: boolean;
  scrollBeyondLastLine: boolean;
  scrollBeyondLastColumn: number;
  mouseWheelZoom: boolean;
  mouseWheelScrollSensitivity: number;
  fastScrollSensitivity: number;
  padding: { top: number; bottom: number };

  // ── Terminal ──
  defaultShell: string;

  // ── Advanced ──
  maxTokenizationLineLength: number;
  largeFileOptimizations: boolean;
  experimentalWhitespaceRendering: "off" | "svg" | "font";
  useTabStops: boolean;
  wordBasedSuggestions: "off" | "currentDocument" | "matchingDocuments" | "allDocuments";
  semanticTokens: boolean;
}
