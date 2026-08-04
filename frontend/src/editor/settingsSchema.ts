import type { EditorSettings } from "../types";

/**
 * Data-driven schema for the Settings UI (components/editor/SettingsPanel.tsx).
 *
 * Every setting is described once here - id, label, description, control
 * type and a get/set pair against EditorSettings - instead of being hand
 * rolled as JSX per-field like the previous panel. The panel component is a
 * dumb renderer over this list, which is what makes "Settings" (VS Code's
 * Ctrl+,) search work uniformly across every field and keeps adding a new
 * setting a one-line change here instead of a new render function.
 */

export type SettingControlType = "toggle" | "slider" | "select";

interface FieldCommon {
  id: string;
  label: string;
  description: string;
  /** Extra search terms beyond label/description/id. */
  keywords?: string;
}

export interface ToggleField extends FieldCommon {
  type: "toggle";
  get: (s: EditorSettings) => boolean;
  set: (s: EditorSettings, value: boolean) => Partial<EditorSettings>;
}

export interface SliderField extends FieldCommon {
  type: "slider";
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  get: (s: EditorSettings) => number;
  set: (s: EditorSettings, value: number) => Partial<EditorSettings>;
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectField extends FieldCommon {
  type: "select";
  options: SelectOption[];
  get: (s: EditorSettings) => string;
  set: (s: EditorSettings, value: string) => Partial<EditorSettings>;
}

export type SettingField = ToggleField | SliderField | SelectField;

export interface SettingGroup {
  title: string;
  fields: SettingField[];
}

export interface SettingSection {
  id: string;
  label: string;
  icon: string;
  groups: SettingGroup[];
}

function toggle(
  id: string,
  label: string,
  description: string,
  get: (s: EditorSettings) => boolean,
  set: (s: EditorSettings, value: boolean) => Partial<EditorSettings>,
  keywords?: string,
): ToggleField {
  const field: ToggleField = { id, type: "toggle", label, description, get, set };
  return keywords ? { ...field, keywords } : field;
}

function slider(
  id: string,
  label: string,
  description: string,
  min: number,
  max: number,
  get: (s: EditorSettings) => number,
  set: (s: EditorSettings, value: number) => Partial<EditorSettings>,
  opts?: { step?: number; suffix?: string },
): SliderField {
  return {
    id,
    type: "slider",
    label,
    description,
    min,
    max,
    get,
    set,
    ...(opts?.step !== undefined ? { step: opts.step } : {}),
    ...(opts?.suffix !== undefined ? { suffix: opts.suffix } : {}),
  };
}

function select(
  id: string,
  label: string,
  description: string,
  options: SelectOption[],
  get: (s: EditorSettings) => string,
  set: (s: EditorSettings, value: string) => Partial<EditorSettings>,
  keywords?: string,
): SelectField {
  const field: SelectField = { id, type: "select", label, description, options, get, set };
  return keywords ? { ...field, keywords } : field;
}

const FONT_OPTIONS: SelectOption[] = [
  {
    value: "'Monaspace Argon', 'Fira Code', 'Cascadia Code', monospace",
    label: "Monaspace Argon",
  },
  {
    value: "'Monaspace Krypton', 'Fira Code', 'Cascadia Code', monospace",
    label: "Monaspace Krypton",
  },
  {
    value: "'Monaspace Neon', 'Fira Code', 'Cascadia Code', monospace",
    label: "Monaspace Neon",
  },
  {
    value: "'Monaspace Radon', 'Fira Code', 'Cascadia Code', monospace",
    label: "Monaspace Radon",
  },
  {
    value: "'Monaspace Xenon', 'Fira Code', 'Cascadia Code', monospace",
    label: "Monaspace Xenon",
  },
  { value: "'Cascadia Code', 'Fira Code', monospace", label: "Cascadia Code" },
  { value: "monospace", label: "System Monospace" },
];

const INHERIT_FONT_OPTIONS: SelectOption[] = [
  { value: "", label: "Inherit Editor Font" },
  ...FONT_OPTIONS,
];

const TERMINAL_FONT_OPTIONS: SelectOption[] = [
  {
    value: '"Cascadia Code", "JetBrains Mono", Consolas, monospace',
    label: "Cascadia Code / JetBrains Mono",
  },
  {
    value: '"JetBrains Mono", "Cascadia Code", Consolas, monospace',
    label: "JetBrains Mono",
  },
  {
    value: '"Monaspace Argon", "Cascadia Code", Consolas, monospace',
    label: "Monaspace Argon",
  },
  { value: "Consolas, monospace", label: "Consolas" },
  { value: "monospace", label: "System Monospace" },
];

export const SETTINGS_SECTIONS: SettingSection[] = [
  {
    id: "editor",
    label: "Text Editor",
    icon: "bi-fonts",
    groups: [
      {
        title: "Font",
        fields: [
          select(
            "fontFamily",
            "Font Family",
            "Controls the font family used in the editor.",
            FONT_OPTIONS,
            (s) => s.fontFamily,
            (_s, v) => ({ fontFamily: v }),
          ),
          slider(
            "fontSize",
            "Font Size",
            "Controls the font size in pixels.",
            8,
            72,
            (s) => s.fontSize,
            (_s, v) => ({ fontSize: v }),
            { suffix: "px" },
          ),
          select(
            "fontWeight",
            "Font Weight",
            "Controls the font weight.",
            [
              { value: "normal", label: "Normal" },
              { value: "300", label: "Light" },
              { value: "500", label: "Medium" },
              { value: "bold", label: "Bold" },
              { value: "700", label: "Bold (700)" },
              { value: "900", label: "Black" },
            ],
            (s) => String(s.fontWeight),
            (_s, v) => ({ fontWeight: v }),
          ),
          toggle(
            "fontLigatures",
            "Font Ligatures",
            "Enables/disables font ligatures (e.g. => renders as an arrow).",
            (s) => s.fontLigatures,
            (_s, v) => ({ fontLigatures: v }),
            "cursive stylistic",
          ),
          slider(
            "lineHeight",
            "Line Height",
            "Controls the line height. Use 0 to compute from font size.",
            12,
            48,
            (s) => s.lineHeight,
            (_s, v) => ({ lineHeight: v }),
            { suffix: "px" },
          ),
        ],
      },
      {
        title: "Indentation",
        fields: [
          slider(
            "tabSize",
            "Tab Size",
            "The number of spaces a tab is equal to.",
            1,
            16,
            (s) => s.tabSize,
            (_s, v) => ({ tabSize: v }),
          ),
          toggle(
            "insertSpaces",
            "Insert Spaces",
            "Insert spaces when pressing Tab.",
            (s) => s.insertSpaces,
            (_s, v) => ({ insertSpaces: v }),
          ),
          toggle(
            "detectIndentation",
            "Detect Indentation",
            "Automatically detect tab size and insert-spaces from file contents.",
            (s) => s.detectIndentation,
            (_s, v) => ({ detectIndentation: v }),
          ),
          toggle(
            "trimAutoWhitespace",
            "Trim Trailing Whitespace",
            "Remove trailing auto-inserted whitespace when the line changes.",
            (s) => s.trimAutoWhitespace,
            (_s, v) => ({ trimAutoWhitespace: v }),
          ),
        ],
      },
      {
        title: "Wrapping",
        fields: [
          select(
            "wordWrap",
            "Word Wrap",
            "Controls how lines should wrap.",
            [
              { value: "off", label: "Off" },
              { value: "on", label: "On" },
              { value: "wordWrapColumn", label: "Wrap at Column" },
              { value: "bounded", label: "Bounded" },
            ],
            (s) => s.wordWrap,
            (_s, v) => ({ wordWrap: v as EditorSettings["wordWrap"] }),
          ),
          slider(
            "wordWrapColumn",
            "Wrap Column",
            "The column at which lines wrap, used by \"Wrap at Column\" and \"Bounded\".",
            40,
            160,
            (s) => s.wordWrapColumn,
            (_s, v) => ({ wordWrapColumn: v }),
          ),
          slider(
            "wordWrapMinIndent",
            "Wrap Minimum Indent",
            "Lines with a leading indent under this many columns won't increase wrap indent further.",
            0,
            20,
            (s) => s.wordWrapMinIndent,
            (_s, v) => ({ wordWrapMinIndent: v }),
          ),
          select(
            "wrappingIndent",
            "Wrapping Indent",
            "Controls the indentation of wrapped lines.",
            [
              { value: "none", label: "None" },
              { value: "same", label: "Same" },
              { value: "indent", label: "Indent" },
              { value: "deepIndent", label: "Deep Indent" },
            ],
            (s) => s.wrappingIndent,
            (_s, v) => ({ wrappingIndent: v as EditorSettings["wrappingIndent"] }),
          ),
          select(
            "wrappingStrategy",
            "Wrapping Strategy",
            "Controls the algorithm used to compute wrapping points. \"Advanced\" is more correct but slower.",
            [
              { value: "simple", label: "Simple (fast)" },
              { value: "advanced", label: "Advanced" },
            ],
            (s) => s.wrappingStrategy,
            (_s, v) => ({ wrappingStrategy: v as EditorSettings["wrappingStrategy"] }),
          ),
        ],
      },
      {
        title: "Line Numbers",
        fields: [
          select(
            "lineNumbers",
            "Line Numbers",
            "Controls the display of line numbers.",
            [
              { value: "on", label: "On" },
              { value: "off", label: "Off" },
              { value: "relative", label: "Relative" },
              { value: "interval", label: "Every 10 Lines" },
            ],
            (s) => s.lineNumbers,
            (_s, v) => ({ lineNumbers: v as EditorSettings["lineNumbers"] }),
            "gutter",
          ),
          slider(
            "lineNumbersMinChars",
            "Line Number Gutter Width",
            "The minimum number of columns reserved for line numbers.",
            1,
            10,
            (s) => s.lineNumbersMinChars,
            (_s, v) => ({ lineNumbersMinChars: v }),
          ),
          select(
            "renderLineHighlight",
            "Highlight Current Line",
            "Controls how the current line is highlighted.",
            [
              { value: "none", label: "None" },
              { value: "gutter", label: "Gutter" },
              { value: "line", label: "Line" },
              { value: "all", label: "Gutter & Line" },
            ],
            (s) => s.renderLineHighlight,
            (_s, v) => ({
              renderLineHighlight: v as EditorSettings["renderLineHighlight"],
            }),
          ),
          toggle(
            "renderLineHighlightOnlyWhenFocus",
            "Highlight Only When Focused",
            "Only highlight the current line when the editor has focus.",
            (s) => s.renderLineHighlightOnlyWhenFocus,
            (_s, v) => ({ renderLineHighlightOnlyWhenFocus: v }),
          ),
          toggle(
            "roundedSelection",
            "Rounded Selection",
            "Use rounded corners for selected text ranges.",
            (s) => s.roundedSelection,
            (_s, v) => ({ roundedSelection: v }),
          ),
        ],
      },
    ],
  },
  {
    id: "appearance",
    label: "Appearance",
    icon: "bi-palette",
    groups: [
      {
        title: "Minimap",
        fields: [
          toggle(
            "minimap.enabled",
            "Show Minimap",
            "Controls whether the minimap is shown.",
            (s) => s.minimap.enabled,
            (s, v) => ({ minimap: { ...s.minimap, enabled: v } }),
          ),
          select(
            "minimap.side",
            "Minimap Side",
            "Controls which side the minimap is rendered on.",
            [
              { value: "right", label: "Right" },
              { value: "left", label: "Left" },
            ],
            (s) => s.minimap.side,
            (s, v) => ({
              minimap: { ...s.minimap, side: v as "right" | "left" },
            }),
          ),
          select(
            "minimap.showSlider",
            "Minimap Slider",
            "Controls when the minimap slider (viewport indicator) is shown.",
            [
              { value: "mouseover", label: "On Hover" },
              { value: "always", label: "Always" },
            ],
            (s) => s.minimap.showSlider,
            (s, v) => ({
              minimap: { ...s.minimap, showSlider: v as "always" | "mouseover" },
            }),
          ),
          toggle(
            "minimap.renderCharacters",
            "Render Actual Characters",
            "Render the actual characters in the minimap instead of blocks.",
            (s) => s.minimap.renderCharacters,
            (s, v) => ({ minimap: { ...s.minimap, renderCharacters: v } }),
          ),
          slider(
            "minimap.maxColumn",
            "Minimap Max Column",
            "The maximum number of columns rendered in the minimap.",
            60,
            240,
            (s) => s.minimap.maxColumn,
            (s, v) => ({ minimap: { ...s.minimap, maxColumn: v } }),
          ),
          slider(
            "minimap.scale",
            "Minimap Scale",
            "Scale of the minimap content (1, 2 or 3).",
            1,
            3,
            (s) => s.minimap.scale,
            (s, v) => ({ minimap: { ...s.minimap, scale: v } }),
          ),
        ],
      },
      {
        title: "Scrollbar & Overview Ruler",
        fields: [
          select(
            "scrollbar.vertical",
            "Vertical Scrollbar",
            "Controls the visibility of the vertical scrollbar.",
            [
              { value: "auto", label: "Auto" },
              { value: "visible", label: "Visible" },
              { value: "hidden", label: "Hidden" },
            ],
            (s) => s.scrollbar.vertical,
            (s, v) => ({
              scrollbar: {
                ...s.scrollbar,
                vertical: v as "auto" | "visible" | "hidden",
              },
            }),
          ),
          select(
            "scrollbar.horizontal",
            "Horizontal Scrollbar",
            "Controls the visibility of the horizontal scrollbar.",
            [
              { value: "auto", label: "Auto" },
              { value: "visible", label: "Visible" },
              { value: "hidden", label: "Hidden" },
            ],
            (s) => s.scrollbar.horizontal,
            (s, v) => ({
              scrollbar: {
                ...s.scrollbar,
                horizontal: v as "auto" | "visible" | "hidden",
              },
            }),
          ),
          slider(
            "scrollbar.verticalScrollbarSize",
            "Vertical Scrollbar Size",
            "Width of the vertical scrollbar.",
            6,
            24,
            (s) => s.scrollbar.verticalScrollbarSize,
            (s, v) => ({
              scrollbar: { ...s.scrollbar, verticalScrollbarSize: v },
            }),
            { suffix: "px" },
          ),
          slider(
            "scrollbar.horizontalScrollbarSize",
            "Horizontal Scrollbar Size",
            "Height of the horizontal scrollbar.",
            6,
            24,
            (s) => s.scrollbar.horizontalScrollbarSize,
            (s, v) => ({
              scrollbar: { ...s.scrollbar, horizontalScrollbarSize: v },
            }),
            { suffix: "px" },
          ),
          toggle(
            "scrollbar.useShadows",
            "Scrollbar Shadows",
            "Show shadows to indicate scrolled content.",
            (s) => s.scrollbar.useShadows,
            (s, v) => ({ scrollbar: { ...s.scrollbar, useShadows: v } }),
          ),
          toggle(
            "scrollbar.alwaysConsumeMouseWheel",
            "Scrollbar Captures Mouse Wheel",
            "The vertical scrollbar consumes mouse wheel events even when not focused.",
            (s) => s.scrollbar.alwaysConsumeMouseWheel,
            (s, v) => ({
              scrollbar: { ...s.scrollbar, alwaysConsumeMouseWheel: v },
            }),
          ),
          slider(
            "overviewRulerLanes",
            "Overview Ruler Lanes",
            "The number of vertical lanes used to render decorations on the overview ruler.",
            0,
            3,
            (s) => s.overviewRulerLanes,
            (_s, v) => ({ overviewRulerLanes: v }),
          ),
          toggle(
            "overviewRulerBorder",
            "Overview Ruler Border",
            "Draw a border around the overview ruler.",
            (s) => s.overviewRulerBorder,
            (_s, v) => ({ overviewRulerBorder: v }),
          ),
          toggle(
            "hideCursorInOverviewRuler",
            "Hide Cursor In Overview Ruler",
            "Do not show the current cursor position marker in the overview ruler.",
            (s) => s.hideCursorInOverviewRuler,
            (_s, v) => ({ hideCursorInOverviewRuler: v }),
          ),
        ],
      },
      {
        title: "Folding & Glyph Margin",
        fields: [
          toggle(
            "folding",
            "Code Folding",
            "Enables code folding in the gutter.",
            (s) => s.folding,
            (_s, v) => ({ folding: v }),
            "fold collapse",
          ),
          select(
            "foldingStrategy",
            "Folding Strategy",
            "Controls how folding ranges are computed.",
            [
              { value: "auto", label: "Auto (language-aware)" },
              { value: "indentation", label: "Indentation" },
            ],
            (s) => s.foldingStrategy,
            (_s, v) => ({ foldingStrategy: v as "auto" | "indentation" }),
          ),
          select(
            "showFoldingControls",
            "Folding Controls",
            "Controls when the fold/unfold arrows are shown in the gutter.",
            [
              { value: "mouseover", label: "On Hover" },
              { value: "always", label: "Always" },
              { value: "never", label: "Never" },
            ],
            (s) => s.showFoldingControls,
            (_s, v) => ({
              showFoldingControls: v as "always" | "never" | "mouseover",
            }),
          ),
          toggle(
            "foldingHighlight",
            "Folding Highlight",
            "Highlight folded ranges.",
            (s) => s.foldingHighlight,
            (_s, v) => ({ foldingHighlight: v }),
          ),
          toggle(
            "foldingImportsByDefault",
            "Fold Imports By Default",
            "Collapse import ranges by default when a file is opened.",
            (s) => s.foldingImportsByDefault,
            (_s, v) => ({ foldingImportsByDefault: v }),
          ),
          toggle(
            "glyphMargin",
            "Glyph Margin",
            "Reserve a margin for breakpoints and other glyphs next to the line numbers.",
            (s) => s.glyphMargin,
            (_s, v) => ({ glyphMargin: v }),
          ),
        ],
      },
      {
        title: "Rendering & Guides",
        fields: [
          select(
            "renderWhitespace",
            "Render Whitespace",
            "Controls how whitespace characters are rendered.",
            [
              { value: "none", label: "None" },
              { value: "boundary", label: "Boundary" },
              { value: "selection", label: "Selection" },
              { value: "trailing", label: "Trailing Only" },
              { value: "all", label: "All" },
            ],
            (s) => s.renderWhitespace,
            (_s, v) => ({
              renderWhitespace: v as EditorSettings["renderWhitespace"],
            }),
          ),
          toggle(
            "renderControlCharacters",
            "Render Control Characters",
            "Render control characters (e.g. \\0) visibly.",
            (s) => s.renderControlCharacters,
            (_s, v) => ({ renderControlCharacters: v }),
          ),
          toggle(
            "renderIndentGuides",
            "Indentation Guides",
            "Show vertical indent guide lines.",
            (s) => s.renderIndentGuides,
            (_s, v) => ({ renderIndentGuides: v }),
          ),
          select(
            "renderFinalNewline",
            "Render Final Newline",
            "Render the last line's ending newline character.",
            [
              { value: "on", label: "On" },
              { value: "off", label: "Off" },
              { value: "dimmed", label: "Dimmed" },
            ],
            (s) => s.renderFinalNewline,
            (_s, v) => ({
              renderFinalNewline: v as "on" | "off" | "dimmed",
            }),
          ),
          select(
            "renderValidationDecorations",
            "Show Diagnostics Squiggles",
            "Controls whether diagnostics (errors/warnings) are rendered with squiggly underlines.",
            [
              { value: "editable", label: "Editable Files Only" },
              { value: "on", label: "Always" },
              { value: "off", label: "Never" },
            ],
            (s) => s.renderValidationDecorations,
            (_s, v) => ({
              renderValidationDecorations: v as "on" | "off" | "editable",
            }),
          ),
          select(
            "matchBrackets",
            "Match Brackets",
            "Highlight matching brackets when the cursor is next to one.",
            [
              { value: "always", label: "Always" },
              { value: "near", label: "Near Cursor" },
              { value: "never", label: "Never" },
            ],
            (s) => s.matchBrackets,
            (_s, v) => ({ matchBrackets: v as "always" | "never" | "near" }),
          ),
        ],
      },
      {
        title: "Bracket Pairs & Sticky Scroll",
        fields: [
          toggle(
            "bracketPairColorization.enabled",
            "Bracket Pair Colorization",
            "Color matching bracket pairs.",
            (s) => s.bracketPairColorization.enabled,
            (s, v) => ({
              bracketPairColorization: {
                ...s.bracketPairColorization,
                enabled: v,
              },
            }),
          ),
          toggle(
            "bracketPairColorization.independentColorPoolPerBracketType",
            "Independent Color Pool Per Bracket Type",
            "Use a separate color pool for each bracket type ((), [], {}).",
            (s) => s.bracketPairColorization.independentColorPoolPerBracketType,
            (s, v) => ({
              bracketPairColorization: {
                ...s.bracketPairColorization,
                independentColorPoolPerBracketType: v,
              },
            }),
          ),
          toggle(
            "stickyScroll.enabled",
            "Sticky Scroll",
            "Show the current nesting scope (function/class) pinned to the top of the editor.",
            (s) => s.stickyScroll.enabled,
            (s, v) => ({ stickyScroll: { ...s.stickyScroll, enabled: v } }),
          ),
          slider(
            "stickyScroll.maxLineCount",
            "Sticky Scroll Max Lines",
            "The maximum number of sticky lines to show.",
            1,
            10,
            (s) => s.stickyScroll.maxLineCount,
            (s, v) => ({ stickyScroll: { ...s.stickyScroll, maxLineCount: v } }),
          ),
        ],
      },
    ],
  },
  {
    id: "cursor",
    label: "Cursor & Selection",
    icon: "bi-cursor-text",
    groups: [
      {
        title: "Cursor",
        fields: [
          select(
            "cursorStyle",
            "Cursor Style",
            "Controls the cursor shape.",
            [
              { value: "line", label: "Line" },
              { value: "line-thin", label: "Line Thin" },
              { value: "block", label: "Block" },
              { value: "block-outline", label: "Block Outline" },
              { value: "underline", label: "Underline" },
              { value: "underline-thin", label: "Underline Thin" },
            ],
            (s) => s.cursorStyle,
            (_s, v) => ({ cursorStyle: v as EditorSettings["cursorStyle"] }),
          ),
          slider(
            "cursorWidth",
            "Cursor Width",
            "Controls the width of the cursor when cursorStyle is \"line\".",
            1,
            8,
            (s) => s.cursorWidth,
            (_s, v) => ({ cursorWidth: v }),
            { suffix: "px" },
          ),
          select(
            "cursorBlinking",
            "Cursor Blinking",
            "Controls the cursor animation style.",
            [
              { value: "blink", label: "Blink" },
              { value: "smooth", label: "Smooth" },
              { value: "phase", label: "Phase" },
              { value: "expand", label: "Expand" },
              { value: "solid", label: "Solid (no blink)" },
            ],
            (s) => s.cursorBlinking,
            (_s, v) => ({ cursorBlinking: v as EditorSettings["cursorBlinking"] }),
          ),
          select(
            "cursorSmoothCaretAnimation",
            "Smooth Caret Animation",
            "Animate the cursor as it moves between positions.",
            [
              { value: "off", label: "Off" },
              { value: "explicit", label: "On Explicit Move" },
              { value: "on", label: "On" },
            ],
            (s) => s.cursorSmoothCaretAnimation,
            (_s, v) => ({
              cursorSmoothCaretAnimation:
                v as EditorSettings["cursorSmoothCaretAnimation"],
            }),
          ),
          slider(
            "cursorSurroundingLines",
            "Cursor Surrounding Lines",
            "Minimum number of visible lines above/below the cursor.",
            0,
            20,
            (s) => s.cursorSurroundingLines,
            (_s, v) => ({ cursorSurroundingLines: v }),
          ),
          select(
            "cursorSurroundingLinesStyle",
            "Surrounding Lines Style",
            "Controls when \"Cursor Surrounding Lines\" is enforced.",
            [
              { value: "default", label: "Default (keyboard only)" },
              { value: "all", label: "Always" },
            ],
            (s) => s.cursorSurroundingLinesStyle,
            (_s, v) => ({
              cursorSurroundingLinesStyle: v as "default" | "all",
            }),
          ),
        ],
      },
      {
        title: "Selection",
        fields: [
          toggle(
            "selectionHighlight",
            "Selection Highlight",
            "Highlight other occurrences of the currently selected text.",
            (s) => s.selectionHighlight,
            (_s, v) => ({ selectionHighlight: v }),
          ),
          select(
            "occurrencesHighlight",
            "Symbol Highlight",
            "Highlight other occurrences of the symbol under the cursor.",
            [
              { value: "singleFile", label: "Current File" },
              { value: "multiFile", label: "All Open Files" },
              { value: "off", label: "Off" },
            ],
            (s) => s.occurrencesHighlight,
            (_s, v) => ({
              occurrencesHighlight: v as EditorSettings["occurrencesHighlight"],
            }),
          ),
          toggle(
            "selectionClipboard",
            "Selection Clipboard",
            "Enable using the selection clipboard (middle-click paste on Linux).",
            (s) => s.selectionClipboard,
            (_s, v) => ({ selectionClipboard: v }),
          ),
          toggle(
            "copyWithSyntaxHighlighting",
            "Copy With Syntax Highlighting",
            "Include syntax highlighting when copying to the clipboard.",
            (s) => s.copyWithSyntaxHighlighting,
            (_s, v) => ({ copyWithSyntaxHighlighting: v }),
          ),
          toggle(
            "emptySelectionClipboard",
            "Copy Current Line When No Selection",
            "Copy the whole line when no selection is made and Copy is invoked.",
            (s) => s.emptySelectionClipboard,
            (_s, v) => ({ emptySelectionClipboard: v }),
          ),
        ],
      },
      {
        title: "Multi-Cursor",
        fields: [
          select(
            "multiCursorModifier",
            "Multi-Cursor Modifier",
            "The modifier key used to add multiple cursors with the mouse.",
            [
              { value: "alt", label: "Alt" },
              { value: "ctrlCmd", label: "Ctrl / Cmd" },
            ],
            (s) => s.multiCursorModifier,
            (_s, v) => ({ multiCursorModifier: v as "alt" | "ctrlCmd" }),
          ),
          select(
            "multiCursorPaste",
            "Multi-Cursor Paste",
            "Controls pasting when the clipboard has multiple entries matching the cursor count.",
            [
              { value: "spread", label: "Spread Across Cursors" },
              { value: "full", label: "Paste Full Text at Each Cursor" },
            ],
            (s) => (s.multiCursorPaste === "same" ? "full" : s.multiCursorPaste),
            (_s, v) => ({
              multiCursorPaste: v as EditorSettings["multiCursorPaste"],
            }),
          ),
          slider(
            "multiCursorLimit",
            "Multi-Cursor Limit",
            "The maximum number of cursors that can be added.",
            100,
            10000,
            (s) => s.multiCursorLimit,
            (_s, v) => ({ multiCursorLimit: v }),
            { step: 100 },
          ),
        ],
      },
    ],
  },
  {
    id: "intellisense",
    label: "IntelliSense",
    icon: "bi-lightbulb",
    groups: [
      {
        title: "Suggestions",
        fields: [
          toggle(
            "quickSuggestions",
            "Quick Suggestions",
            "Show suggestions automatically while typing.",
            (s) =>
              typeof s.quickSuggestions === "boolean"
                ? s.quickSuggestions
                : s.quickSuggestions.other,
            (s, v) => {
              if (typeof s.quickSuggestions === "boolean") {
                return {
                  quickSuggestions: v
                    ? { other: true, comments: false, strings: false }
                    : false,
                };
              }
              return { quickSuggestions: v };
            },
            "autocomplete",
          ),
          toggle(
            "suggestOnTriggerCharacters",
            "Suggest On Trigger Characters",
            "Show suggestions automatically when typing trigger characters (e.g. `.`).",
            (s) => s.suggestOnTriggerCharacters,
            (_s, v) => ({ suggestOnTriggerCharacters: v }),
          ),
          select(
            "acceptSuggestionOnEnter",
            "Accept Suggestion On Enter",
            "Controls whether suggestions are accepted with Enter, in addition to Tab.",
            [
              { value: "on", label: "On" },
              { value: "smart", label: "Smart" },
              { value: "off", label: "Off" },
            ],
            (s) => s.acceptSuggestionOnEnter,
            (_s, v) => ({
              acceptSuggestionOnEnter: v as "on" | "smart" | "off",
            }),
          ),
          toggle(
            "acceptSuggestionOnCommitCharacter",
            "Accept Suggestion On Commit Character",
            "Accept suggestions on typing a commit character, e.g. `;` or `(`.",
            (s) => s.acceptSuggestionOnCommitCharacter,
            (_s, v) => ({ acceptSuggestionOnCommitCharacter: v }),
          ),
          select(
            "suggestSelection",
            "Suggest Selection Mode",
            "Controls how the editor selects a suggestion when the list first shows up.",
            [
              { value: "first", label: "First" },
              { value: "recentlyUsed", label: "Recently Used" },
              { value: "recentlyUsedByPrefix", label: "Recently Used By Prefix" },
            ],
            (s) => s.suggestSelection,
            (_s, v) => ({
              suggestSelection: v as EditorSettings["suggestSelection"],
            }),
          ),
          select(
            "wordBasedSuggestions",
            "Word Based Suggestions",
            "Suggest words found in open documents, not just from the language server.",
            [
              { value: "currentDocument", label: "Current Document" },
              { value: "matchingDocuments", label: "Matching Documents" },
              { value: "allDocuments", label: "All Open Documents" },
              { value: "off", label: "Off" },
            ],
            (s) => s.wordBasedSuggestions,
            (_s, v) => ({
              wordBasedSuggestions: v as EditorSettings["wordBasedSuggestions"],
            }),
          ),
          slider(
            "suggestFontSize",
            "Suggestion Widget Font Size",
            "Font size of the suggestion (autocomplete) widget. 0 uses the editor's font size.",
            0,
            32,
            (s) => s.suggestFontSize,
            (_s, v) => ({ suggestFontSize: v }),
          ),
          slider(
            "suggestLineHeight",
            "Suggestion Widget Line Height",
            "Line height of the suggestion (autocomplete) widget. 0 uses the editor's line height.",
            0,
            48,
            (s) => s.suggestLineHeight,
            (_s, v) => ({ suggestLineHeight: v }),
          ),
        ],
      },
      {
        title: "Snippets & Tab Completion",
        fields: [
          select(
            "tabCompletion",
            "Tab Completion",
            "Controls whether Tab completes snippets before other suggestions.",
            [
              { value: "off", label: "Off" },
              { value: "on", label: "On" },
              { value: "onlySnippets", label: "Snippets Only" },
            ],
            (s) => s.tabCompletion,
            (_s, v) => ({
              tabCompletion: v as "on" | "off" | "onlySnippets",
            }),
          ),
          select(
            "snippetSuggestions",
            "Snippet Suggestions",
            "Controls where snippets show up in the suggestion list.",
            [
              { value: "top", label: "Top" },
              { value: "bottom", label: "Bottom" },
              { value: "inline", label: "Inline" },
              { value: "none", label: "Hidden" },
            ],
            (s) => s.snippetSuggestions,
            (_s, v) => ({
              snippetSuggestions: v as "top" | "bottom" | "inline" | "none",
            }),
          ),
          toggle(
            "inlineSuggest.enabled",
            "Inline Suggestions",
            "Show inline (ghost text) suggestions as you type.",
            (s) => s.inlineSuggest.enabled,
            (s, v) => ({ inlineSuggest: { ...s.inlineSuggest, enabled: v } }),
          ),
          select(
            "inlineSuggest.showToolbar",
            "Inline Suggestion Toolbar",
            "Controls when the inline suggestion toolbar is shown.",
            [
              { value: "onHover", label: "On Hover" },
              { value: "always", label: "Always" },
              { value: "never", label: "Never" },
            ],
            (s) => s.inlineSuggest.showToolbar,
            (s, v) => ({
              inlineSuggest: {
                ...s.inlineSuggest,
                showToolbar: v as "always" | "onHover" | "never",
              },
            }),
          ),
        ],
      },
      {
        title: "Hints & Hover",
        fields: [
          toggle(
            "parameterHints.enabled",
            "Parameter Hints",
            "Show function signature/parameter hints while typing arguments.",
            (s) => s.parameterHints.enabled,
            (s, v) => ({ parameterHints: { ...s.parameterHints, enabled: v } }),
          ),
          toggle(
            "parameterHints.cycle",
            "Cycle Parameter Hints",
            "Cycle back to the first overload once past the last one.",
            (s) => s.parameterHints.cycle,
            (s, v) => ({ parameterHints: { ...s.parameterHints, cycle: v } }),
          ),
          toggle(
            "hover.enabled",
            "Show Hover",
            "Show a hover tooltip with documentation/type info.",
            (s) => s.hover.enabled,
            (s, v) => ({ hover: { ...s.hover, enabled: v } }),
          ),
          slider(
            "hover.delay",
            "Hover Delay",
            "Delay before the hover tooltip is shown.",
            0,
            2000,
            (s) => s.hover.delay,
            (s, v) => ({ hover: { ...s.hover, delay: v } }),
            { step: 50, suffix: "ms" },
          ),
          toggle(
            "hover.sticky",
            "Sticky Hover",
            "Keep the hover tooltip visible when moving the mouse over it.",
            (s) => s.hover.sticky,
            (s, v) => ({ hover: { ...s.hover, sticky: v } }),
          ),
          toggle(
            "links",
            "Clickable Links",
            "Detect links and make them clickable.",
            (s) => s.links,
            (_s, v) => ({ links: v }),
            "url hyperlink",
          ),
        ],
      },
    ],
  },
  {
    id: "behavior",
    label: "Editing Behavior",
    icon: "bi-sliders",
    groups: [
      {
        title: "Saving & Formatting",
        fields: [
          select(
            "autoSave",
            "Auto Save",
            "Controls whether unsaved changes are automatically saved.",
            [
              { value: "off", label: "Off" },
              { value: "afterDelay", label: "After Delay" },
              { value: "onFocusChange", label: "On Focus Change" },
              { value: "onWindowChange", label: "On Window Change" },
            ],
            (s) => s.autoSave,
            (_s, v) => ({ autoSave: v as EditorSettings["autoSave"] }),
          ),
          slider(
            "autoSaveDelay",
            "Auto Save Delay",
            "Delay before auto-saving, in milliseconds.",
            500,
            10000,
            (s) => s.autoSaveDelay,
            (_s, v) => ({ autoSaveDelay: v }),
            { step: 100, suffix: "ms" },
          ),
          toggle(
            "formatOnSave",
            "Format On Save",
            "Format the file automatically when saving.",
            (s) => s.formatOnSave,
            (_s, v) => ({ formatOnSave: v }),
          ),
          toggle(
            "formatOnPaste",
            "Format On Paste",
            "Format pasted content automatically.",
            (s) => s.formatOnPaste,
            (_s, v) => ({ formatOnPaste: v }),
          ),
          toggle(
            "formatOnType",
            "Format On Type",
            "Format the line automatically as you type.",
            (s) => s.formatOnType,
            (_s, v) => ({ formatOnType: v }),
          ),
        ],
      },
      {
        title: "Auto-Closing & Indent",
        fields: [
          select(
            "autoClosingBrackets",
            "Auto Close Brackets",
            "Controls whether brackets are automatically closed after typing an opening bracket.",
            [
              { value: "languageDefined", label: "Language Defined" },
              { value: "always", label: "Always" },
              { value: "beforeWhitespace", label: "Before Whitespace" },
              { value: "never", label: "Never" },
            ],
            (s) => s.autoClosingBrackets,
            (_s, v) => ({
              autoClosingBrackets: v as EditorSettings["autoClosingBrackets"],
            }),
          ),
          select(
            "autoClosingQuotes",
            "Auto Close Quotes",
            "Controls whether quotes are automatically closed after typing an opening quote.",
            [
              { value: "languageDefined", label: "Language Defined" },
              { value: "always", label: "Always" },
              { value: "beforeWhitespace", label: "Before Whitespace" },
              { value: "never", label: "Never" },
            ],
            (s) => s.autoClosingQuotes,
            (_s, v) => ({
              autoClosingQuotes: v as EditorSettings["autoClosingQuotes"],
            }),
          ),
          select(
            "autoClosingOvertype",
            "Type Over Closing Character",
            "Controls whether typing a closing bracket/quote types over an existing one.",
            [
              { value: "always", label: "Always" },
              { value: "never", label: "Never" },
            ],
            (s) => s.autoClosingOvertype,
            (_s, v) => ({ autoClosingOvertype: v as "always" | "never" }),
          ),
          select(
            "autoClosingDelete",
            "Delete Closing Pair",
            "Controls whether Backspace deletes an auto-closed pair together.",
            [
              { value: "always", label: "Always" },
              { value: "never", label: "Never" },
            ],
            (s) => s.autoClosingDelete,
            (_s, v) => ({ autoClosingDelete: v as "always" | "never" }),
          ),
          select(
            "autoIndent",
            "Auto Indent",
            "Controls how much the editor auto-indents on typing, paste and moving lines.",
            [
              { value: "none", label: "None" },
              { value: "keep", label: "Keep" },
              { value: "brackets", label: "Brackets" },
              { value: "advanced", label: "Advanced" },
              { value: "full", label: "Full" },
            ],
            (s) => s.autoIndent,
            (_s, v) => ({ autoIndent: v as EditorSettings["autoIndent"] }),
          ),
        ],
      },
      {
        title: "Editing Aids",
        fields: [
          toggle(
            "dragAndDrop",
            "Drag and Drop",
            "Move selected text via drag and drop.",
            (s) => s.dragAndDrop,
            (_s, v) => ({ dragAndDrop: v }),
          ),
          toggle(
            "codeLens",
            "Code Lens",
            "Show inline actionable annotations above functions (e.g. reference counts).",
            (s) => s.codeLens,
            (_s, v) => ({ codeLens: v }),
          ),
          toggle(
            "colorDecorators",
            "Color Decorators",
            "Show inline color swatches for CSS color values.",
            (s) => s.colorDecorators,
            (_s, v) => ({ colorDecorators: v }),
            "css swatch decorators",
          ),
          select(
            "codeLensFontFamily",
            "Code Lens Font Family",
            "Font family used for Code Lens annotations.",
            INHERIT_FONT_OPTIONS,
            (s) => s.codeLensFontFamily,
            (_s, v) => ({ codeLensFontFamily: v }),
          ),
          slider(
            "codeLensFontSize",
            "Code Lens Font Size",
            "Font size used for Code Lens annotations. 0 uses 90% of the editor's font size.",
            0,
            32,
            (s) => s.codeLensFontSize,
            (_s, v) => ({ codeLensFontSize: v }),
          ),
        ],
      },
    ],
  },
  {
    id: "scrolling",
    label: "Scrolling",
    icon: "bi-mouse2",
    groups: [
      {
        title: "Scrolling",
        fields: [
          toggle(
            "smoothScrolling",
            "Smooth Scrolling",
            "Animate scrolling of the editor.",
            (s) => s.smoothScrolling,
            (_s, v) => ({ smoothScrolling: v }),
          ),
          toggle(
            "scrollBeyondLastLine",
            "Scroll Beyond Last Line",
            "Allow scrolling past the last line.",
            (s) => s.scrollBeyondLastLine,
            (_s, v) => ({ scrollBeyondLastLine: v }),
          ),
          slider(
            "scrollBeyondLastColumn",
            "Scroll Beyond Last Column",
            "The number of extra characters beyond which the editor scrolls horizontally.",
            0,
            20,
            (s) => s.scrollBeyondLastColumn,
            (_s, v) => ({ scrollBeyondLastColumn: v }),
          ),
          toggle(
            "mouseWheelZoom",
            "Mouse Wheel Zoom",
            "Zoom the font size with Ctrl/Cmd + mouse wheel.",
            (s) => s.mouseWheelZoom,
            (_s, v) => ({ mouseWheelZoom: v }),
          ),
          slider(
            "mouseWheelScrollSensitivity",
            "Mouse Wheel Sensitivity",
            "Multiplier for mouse wheel scroll speed.",
            0.5,
            10,
            (s) => s.mouseWheelScrollSensitivity,
            (_s, v) => ({ mouseWheelScrollSensitivity: v }),
            { step: 0.5 },
          ),
          slider(
            "fastScrollSensitivity",
            "Fast Scroll Sensitivity",
            "Multiplier for scroll speed when holding Alt.",
            1,
            20,
            (s) => s.fastScrollSensitivity,
            (_s, v) => ({ fastScrollSensitivity: v }),
          ),
        ],
      },
      {
        title: "Padding",
        fields: [
          slider(
            "padding.top",
            "Top Padding",
            "Space reserved above the first line.",
            0,
            50,
            (s) => s.padding.top,
            (s, v) => ({ padding: { ...s.padding, top: v } }),
            { suffix: "px" },
          ),
          slider(
            "padding.bottom",
            "Bottom Padding",
            "Space reserved below the last line.",
            0,
            50,
            (s) => s.padding.bottom,
            (s, v) => ({ padding: { ...s.padding, bottom: v } }),
            { suffix: "px" },
          ),
        ],
      },
    ],
  },
  {
    id: "advanced",
    label: "Advanced",
    icon: "bi-gear-wide-connected",
    groups: [
      {
        title: "Unicode & Highlighting",
        fields: [
          toggle(
            "semanticTokens",
            "Semantic Highlighting",
            "Use the language server's semantic tokens for richer syntax highlighting.",
            (s) => s.semanticTokens,
            (_s, v) => ({ semanticTokens: v }),
          ),
          toggle(
            "unicodeHighlight.ambiguousCharacters",
            "Highlight Ambiguous Characters",
            "Highlight characters that can be confused with basic ASCII ones.",
            (s) => s.unicodeHighlight.ambiguousCharacters,
            (s, v) => ({
              unicodeHighlight: { ...s.unicodeHighlight, ambiguousCharacters: v },
            }),
          ),
          toggle(
            "unicodeHighlight.invisibleCharacters",
            "Highlight Invisible Characters",
            "Highlight characters that are rendered as invisible.",
            (s) => s.unicodeHighlight.invisibleCharacters,
            (s, v) => ({
              unicodeHighlight: { ...s.unicodeHighlight, invisibleCharacters: v },
            }),
          ),
          toggle(
            "unicodeHighlight.nonBasicASCII",
            "Highlight Non-ASCII Characters",
            "Highlight all characters outside basic ASCII.",
            (s) => s.unicodeHighlight.nonBasicASCII,
            (s, v) => ({
              unicodeHighlight: { ...s.unicodeHighlight, nonBasicASCII: v },
            }),
          ),
        ],
      },
      {
        title: "Inlay Hints",
        fields: [
          select(
            "inlayHints.enabled",
            "Inlay Hints",
            "Show inline type/parameter name hints from the language server.",
            [
              { value: "on", label: "On" },
              { value: "onUnlessPressed", label: "On (hide while Ctrl held)" },
              { value: "offUnlessPressed", label: "Off (show while Ctrl held)" },
              { value: "off", label: "Off" },
            ],
            (s) => s.inlayHints.enabled,
            (s, v) => ({
              inlayHints: {
                ...s.inlayHints,
                enabled: v as EditorSettings["inlayHints"]["enabled"],
              },
            }),
          ),
          slider(
            "inlayHints.fontSize",
            "Inlay Hints Font Size",
            "Font size for inlay hints. 0 uses 90% of the editor's font size.",
            0,
            32,
            (s) => s.inlayHints.fontSize,
            (s, v) => ({ inlayHints: { ...s.inlayHints, fontSize: v } }),
          ),
          select(
            "inlayHints.fontFamily",
            "Inlay Hints Font Family",
            "Font family for inlay hints.",
            INHERIT_FONT_OPTIONS,
            (s) => s.inlayHints.fontFamily,
            (s, v) => ({ inlayHints: { ...s.inlayHints, fontFamily: v } }),
          ),
        ],
      },
      {
        title: "Performance",
        fields: [
          toggle(
            "largeFileOptimizations",
            "Large File Optimizations",
            "Disable certain memory-intensive features for large files.",
            (s) => s.largeFileOptimizations,
            (_s, v) => ({ largeFileOptimizations: v }),
          ),
          slider(
            "maxTokenizationLineLength",
            "Max Tokenization Line Length",
            "Lines longer than this are not tokenized for syntax highlighting, for performance.",
            1000,
            50000,
            (s) => s.maxTokenizationLineLength,
            (_s, v) => ({ maxTokenizationLineLength: v }),
            { step: 1000 },
          ),
          toggle(
            "useTabStops",
            "Use Tab Stops",
            "Move the cursor and delete using tab stops.",
            (s) => s.useTabStops,
            (_s, v) => ({ useTabStops: v }),
          ),
          select(
            "experimentalWhitespaceRendering",
            "Whitespace Rendering Method",
            "The rendering method used for whitespace characters.",
            [
              { value: "svg", label: "SVG" },
              { value: "font", label: "Font" },
              { value: "off", label: "Off (use font glyphs)" },
            ],
            (s) => s.experimentalWhitespaceRendering,
            (_s, v) => ({
              experimentalWhitespaceRendering: v as "off" | "svg" | "font",
            }),
          ),
        ],
      },
      {
        title: "Terminal",
        fields: [
          select(
            "defaultShell",
            "Default Shell",
            "The shell used when opening a new integrated terminal tab.",
            [
              { value: "", label: "System Default (PowerShell)" },
              { value: "powershell", label: "Windows PowerShell" },
              { value: "cmd", label: "Command Prompt" },
            ],
            (s) => s.defaultShell,
            (_s, v) => ({ defaultShell: v }),
          ),
          select(
            "terminalFontFamily",
            "Terminal Font Family",
            "Font family used in the integrated terminal. Kept separate from the editor font.",
            TERMINAL_FONT_OPTIONS,
            (s) => s.terminalFontFamily,
            (_s, v) => ({ terminalFontFamily: v }),
          ),
          slider(
            "terminalFontSize",
            "Terminal Font Size",
            "Font size used by new and existing terminal tabs.",
            9,
            28,
            (s) => s.terminalFontSize,
            (_s, v) => ({ terminalFontSize: v }),
            { suffix: "px" },
          ),
          toggle(
            "terminalCursorBlink",
            "Terminal Cursor Blink",
            "Blink the integrated terminal cursor.",
            (s) => s.terminalCursorBlink,
            (_s, v) => ({ terminalCursorBlink: v }),
          ),
          slider(
            "terminalScrollback",
            "Terminal Scrollback",
            "Number of lines retained in each terminal tab's scrollback buffer.",
            1000,
            20000,
            (s) => s.terminalScrollback,
            (_s, v) => ({ terminalScrollback: v }),
            { step: 1000, suffix: " lines" },
          ),
          slider(
            "terminalHeight",
            "Terminal Panel Height",
            "Default height of the integrated terminal panel.",
            120,
            800,
            (s) => s.terminalHeight,
            (_s, v) => ({ terminalHeight: v }),
            { step: 10, suffix: "px" },
          ),
        ],
      },
    ],
  },
];

export const ALL_SETTING_FIELDS: Array<{
  sectionId: string;
  sectionLabel: string;
  groupTitle: string;
  field: SettingField;
}> = SETTINGS_SECTIONS.flatMap((section) =>
  section.groups.flatMap((group) =>
    group.fields.map((field) => ({
      sectionId: section.id,
      sectionLabel: section.label,
      groupTitle: group.title,
      field,
    })),
  ),
);
