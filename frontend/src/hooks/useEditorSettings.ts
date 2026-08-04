import { useCallback, useEffect, useState } from "react";
import type { EditorSettings } from "../types";

const STORAGE_KEY = "mervcode:editorSettings";

export const defaultEditorSettings: EditorSettings = {
  fontSize: 14,
  fontFamily: "'Monaspace Argon', 'Fira Code', 'Cascadia Code', monospace",
  fontWeight: "normal",
  fontLigatures: true,
  lineHeight: 21,

  tabSize: 2,
  insertSpaces: true,
  detectIndentation: true,
  trimAutoWhitespace: true,

  wordWrap: "off",
  wordWrapColumn: 80,
  wordWrapMinIndent: 1,
  wrappingIndent: "same",
  wrappingStrategy: "simple",

  lineNumbers: "on",
  lineNumbersMinChars: 5,
  renderLineHighlight: "line",
  renderLineHighlightOnlyWhenFocus: false,

  minimap: {
    enabled: false,
    maxColumn: 120,
    renderCharacters: true,
    showSlider: "mouseover",
    scale: 1,
    side: "right",
  },

  scrollbar: {
    vertical: "auto",
    horizontal: "auto",
    verticalScrollbarSize: 10,
    horizontalScrollbarSize: 10,
    useShadows: true,
    alwaysConsumeMouseWheel: true,
  },

  overviewRulerLanes: 3,
  overviewRulerBorder: true,

  glyphMargin: true,
  folding: true,
  foldingStrategy: "auto",
  showFoldingControls: "mouseover",
  foldingHighlight: true,
  foldingImportsByDefault: false,

  matchBrackets: "always",

  cursorStyle: "line",
  cursorWidth: 2,
  cursorBlinking: "smooth",
  cursorSmoothCaretAnimation: "on",
  cursorSurroundingLines: 0,
  cursorSurroundingLinesStyle: "default",

  selectionClipboard: true,
  copyWithSyntaxHighlighting: true,
  emptySelectionClipboard: true,

  multiCursorModifier: "alt",
  multiCursorPaste: "spread",
  multiCursorLimit: 10000,

  quickSuggestions: { other: true, comments: false, strings: false },
  suggestOnTriggerCharacters: true,
  acceptSuggestionOnEnter: "on",
  acceptSuggestionOnCommitCharacter: true,
  suggestSelection: "recentlyUsedByPrefix",
  tabCompletion: "off",
  snippetSuggestions: "inline",
  inlineSuggest: { enabled: true, showToolbar: "onHover" },
  suggestFontSize: 14,
  suggestLineHeight: 24,

  renderWhitespace: "selection",
  renderControlCharacters: false,
  renderIndentGuides: true,
  renderFinalNewline: "on",
  renderValidationDecorations: "on",

  bracketPairColorization: { enabled: true, independentColorPoolPerBracketType: false },

  unicodeHighlight: {
    ambiguousCharacters: true,
    invisibleCharacters: true,
    nonBasicASCII: false,
  },

  stickyScroll: { enabled: true, maxLineCount: 5 },

  inlayHints: { enabled: "on", fontSize: 14, fontFamily: "" },

  autoSave: "off",
  autoSaveDelay: 1000,
  formatOnSave: false,
  formatOnType: false,
  formatOnPaste: false,
  autoClosingBrackets: "languageDefined",
  autoClosingQuotes: "languageDefined",
  autoClosingOvertype: "always",
  autoClosingDelete: "always",
  autoIndent: "advanced",
  dragAndDrop: true,
  selectionHighlight: true,
  occurrencesHighlight: "singleFile",
  codeLens: true,
  codeLensFontFamily: "",
  codeLensFontSize: 14,
  parameterHints: { enabled: true, cycle: true },
  hover: { enabled: true, delay: 300, sticky: true },
  links: true,

  smoothScrolling: true,
  scrollBeyondLastLine: true,
  scrollBeyondLastColumn: 5,
  mouseWheelZoom: true,
  mouseWheelScrollSensitivity: 1,
  fastScrollSensitivity: 5,
  padding: { top: 0, bottom: 0 },

  defaultShell: "",
  terminalFontSize: 13,
  terminalFontFamily: '"Cascadia Code", "JetBrains Mono", Consolas, monospace',
  terminalCursorBlink: true,
  terminalScrollback: 5000,
  terminalHeight: 260,

  maxTokenizationLineLength: 20000,
  largeFileOptimizations: true,
  experimentalWhitespaceRendering: "svg",
  useTabStops: true,
  wordBasedSuggestions: "currentDocument",
  semanticTokens: true,
  roundedSelection: true,
  hideCursorInOverviewRuler: false,
  colorDecorators: true,
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function mergeSettings<T extends object>(defaults: T, saved: unknown): T {
  if (!isPlainObject(saved)) return { ...defaults };

  const defaultRecord = defaults as Record<string, unknown>;
  const merged: Record<string, unknown> = { ...defaultRecord };
  for (const [key, value] of Object.entries(saved)) {
    const defaultValue = defaultRecord[key];
    merged[key] = isPlainObject(defaultValue) && isPlainObject(value)
      ? mergeSettings(defaultValue, value)
      : value;
  }
  return merged as T;
}

function load(): EditorSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaultEditorSettings };
    // Deep merge so new nested settings (minimap/scrollbar/terminal/etc.) get
    // defaults without clobbering the user's existing saved preferences.
    return mergeSettings(defaultEditorSettings, JSON.parse(raw));
  } catch {
    return { ...defaultEditorSettings };
  }
}

function save(settings: EditorSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function useEditorSettings() {
  const [settings, setSettings] = useState<EditorSettings>(load);

  useEffect(() => {
    save(settings);
  }, [settings]);

  const updateSettings = useCallback(
    (patch: Partial<EditorSettings>) => {
      setSettings((prev) => ({ ...prev, ...patch }));
    },
    [],
  );

  const resetSettings = useCallback(() => {
    setSettings({ ...defaultEditorSettings });
  }, []);

  return { settings, updateSettings, resetSettings };
}
