import * as monaco from "monaco-editor";
import type { EditorSettings } from "../../types";

/**
 * Converts our EditorSettings (what the Settings panel edits) into the
 * actual Monaco editor options object. Field names mostly match Monaco's
 * own API 1:1 by design — the few that don't (renderIndentGuides,
 * semanticTokens) are translated to their real Monaco option below.
 *
 * This is applied both at editor creation and on every settings change,
 * so every control in the Settings panel actually affects the editor
 * instead of just being stored.
 */
/**
 * Extracts model-level update options (tabSize, insertSpaces, etc.) from
 * EditorSettings for ITextModel.updateOptions(). This is called separately
 * from toMonacoOptions because ITextModel accepts a narrower options type
 * than IStandaloneCodeEditor.
 */
export function toModelOptions(
  settings: EditorSettings,
): monaco.editor.ITextModelUpdateOptions {
  return {
    tabSize: settings.tabSize,
    insertSpaces: settings.insertSpaces,
    trimAutoWhitespace: settings.trimAutoWhitespace,
    indentSize: settings.tabSize,
    bracketColorizationOptions: {
      enabled: settings.bracketPairColorization.enabled,
      independentColorPoolPerBracketType:
        settings.bracketPairColorization.independentColorPoolPerBracketType,
    },
  };
}

export function toMonacoOptions(
  settings: EditorSettings,
): monaco.editor.IEditorOptions & monaco.editor.IGlobalEditorOptions {
  return {
    // Typography
    fontSize: settings.fontSize,
    fontFamily: settings.fontFamily,
    fontWeight: String(settings.fontWeight),
    fontLigatures: settings.fontLigatures,
    lineHeight: settings.lineHeight,

    // Indentation (IGlobalEditorOptions — valid on
    // IStandaloneCodeEditor.updateOptions, which merges IEditorOptions &
    // IGlobalEditorOptions; NOT valid on the plain ICodeEditor interface)
    tabSize: settings.tabSize,
    insertSpaces: settings.insertSpaces,
    detectIndentation: settings.detectIndentation,
    trimAutoWhitespace: settings.trimAutoWhitespace,

    // Layout / wrapping
    wordWrap: settings.wordWrap,
    wordWrapColumn: settings.wordWrapColumn,
    wrappingIndent: settings.wrappingIndent,
    wrappingStrategy: settings.wrappingStrategy,

    // Line numbers
    lineNumbers: settings.lineNumbers,
    lineNumbersMinChars: settings.lineNumbersMinChars,
    renderLineHighlight: settings.renderLineHighlight,
    renderLineHighlightOnlyWhenFocus: settings.renderLineHighlightOnlyWhenFocus,

    // Minimap — settings.minimap already matches Monaco's
    // IEditorMinimapOptions shape ({enabled, maxColumn, ...}), so pass it
    // straight through rather than re-wrapping it.
    minimap: settings.minimap,

    // Scrollbars
    scrollbar: settings.scrollbar,

    // Overview ruler
    overviewRulerLanes: settings.overviewRulerLanes,
    overviewRulerBorder: settings.overviewRulerBorder,

    // Glyph margin & folding
    glyphMargin: settings.glyphMargin,
    folding: settings.folding,
    foldingStrategy: settings.foldingStrategy,
    showFoldingControls: settings.showFoldingControls,
    foldingHighlight: settings.foldingHighlight,
    foldingImportsByDefault: settings.foldingImportsByDefault,

    matchBrackets: settings.matchBrackets,

    // Cursor
    cursorStyle: settings.cursorStyle,
    cursorWidth: settings.cursorWidth,
    cursorBlinking: settings.cursorBlinking,
    cursorSmoothCaretAnimation: settings.cursorSmoothCaretAnimation,
    cursorSurroundingLines: settings.cursorSurroundingLines,
    cursorSurroundingLinesStyle: settings.cursorSurroundingLinesStyle,

    // Selection
    selectionClipboard: settings.selectionClipboard,
    copyWithSyntaxHighlighting: settings.copyWithSyntaxHighlighting,
    emptySelectionClipboard: settings.emptySelectionClipboard,

    // Multi-cursor
    multiCursorModifier: settings.multiCursorModifier,
    multiCursorPaste:
      settings.multiCursorPaste === "same" ? "full" : settings.multiCursorPaste,
    multiCursorLimit: settings.multiCursorLimit,

    // IntelliSense / suggestions
    quickSuggestions: settings.quickSuggestions,
    suggestOnTriggerCharacters: settings.suggestOnTriggerCharacters,
    acceptSuggestionOnEnter: settings.acceptSuggestionOnEnter,
    acceptSuggestionOnCommitCharacter: settings.acceptSuggestionOnCommitCharacter,
    suggestSelection: settings.suggestSelection,
    tabCompletion: settings.tabCompletion,
    snippetSuggestions: settings.snippetSuggestions,
    inlineSuggest: settings.inlineSuggest,
    suggestFontSize: settings.suggestFontSize,
    suggestLineHeight: settings.suggestLineHeight,

    // Rendering & whitespace
    renderWhitespace: settings.renderWhitespace,
    renderControlCharacters: settings.renderControlCharacters,
    renderFinalNewline: settings.renderFinalNewline,
    renderValidationDecorations: settings.renderValidationDecorations,
    // renderIndentGuides was folded into guides.indentation in newer Monaco
    guides: { indentation: settings.renderIndentGuides },

    // Bracket pair colorization
    bracketPairColorization: settings.bracketPairColorization,

    // Unicode highlight
    unicodeHighlight: settings.unicodeHighlight,

    // Sticky scroll
    stickyScroll: settings.stickyScroll,

    // Inlay hints
    inlayHints: settings.inlayHints,

    // Format / editing behavior
    formatOnPaste: settings.formatOnPaste,
    formatOnType: settings.formatOnType,
    autoClosingBrackets: settings.autoClosingBrackets,
    autoClosingQuotes: settings.autoClosingQuotes,
    autoClosingOvertype: settings.autoClosingOvertype,
    autoClosingDelete: settings.autoClosingDelete,
    autoIndent: settings.autoIndent,
    dragAndDrop: settings.dragAndDrop,
    selectionHighlight: settings.selectionHighlight,
    occurrencesHighlight: settings.occurrencesHighlight,
    codeLens: settings.codeLens,
    codeLensFontFamily: settings.codeLensFontFamily,
    codeLensFontSize: settings.codeLensFontSize,
    parameterHints: settings.parameterHints,
    hover: settings.hover,
    links: settings.links,

    // Navigation & scrolling
    smoothScrolling: settings.smoothScrolling,
    scrollBeyondLastLine: settings.scrollBeyondLastLine,
    scrollBeyondLastColumn: settings.scrollBeyondLastColumn,
    mouseWheelZoom: settings.mouseWheelZoom,
    mouseWheelScrollSensitivity: settings.mouseWheelScrollSensitivity,
    fastScrollSensitivity: settings.fastScrollSensitivity,
    padding: settings.padding,

    // Advanced
    maxTokenizationLineLength: settings.maxTokenizationLineLength,
    largeFileOptimizations: settings.largeFileOptimizations,
    experimentalWhitespaceRendering: settings.experimentalWhitespaceRendering,
    useTabStops: settings.useTabStops,
    wordBasedSuggestions: settings.wordBasedSuggestions,
    // semanticTokens has no direct top-level option; it maps to Monaco's
    // theme-level semantic highlighting toggle.
    "semanticHighlighting.enabled": settings.semanticTokens,
  };
}