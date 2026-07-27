import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Search, Code, Palette, Type, Play, Lightbulb, Cpu, ScrollText } from "lucide-react";
import type { EditorSettings } from "../../types";
import Toggle from "../ui/Toggle";
import Slider from "../ui/Slider";
import Select from "../ui/Select";

interface SettingsPanelProps {
  settings: EditorSettings;
  onSettingsChange: (patch: Partial<EditorSettings>) => void;
}

const categories = [
  { id: "editor", label: "Editor", icon: <Code size={15} /> },
  { id: "appearance", label: "Appearance", icon: <Palette size={15} /> },
  { id: "cursor", label: "Cursor", icon: <Type size={15} /> },
  { id: "behavior", label: "Behavior", icon: <Play size={15} /> },
  { id: "intellisense", label: "IntelliSense", icon: <Lightbulb size={15} /> },
  { id: "scrolling", label: "Scrolling", icon: <ScrollText size={15} /> },
  { id: "advanced", label: "Advanced", icon: <Cpu size={15} /> },
];

const divider = <div className='border-t border-white/5 my-1.5' />;

type SettingDef = {
  key: string;
  label: string;
  keywords: string;
  render: (s: EditorSettings, p: (patch: Partial<EditorSettings>) => void, dp: (fn: (s: EditorSettings) => EditorSettings) => void) => React.ReactNode;
};

const settingDefs: Record<string, SettingDef[]> = {
  editor: [
    { key: "fontSize", label: "Font Size", keywords: "font size text editor zoom", render: (s, p) => <Slider label='Font Size' min={8} max={72} value={s.fontSize} suffix='px' onChange={(v) => p({ fontSize: v })} /> },
    { key: "fontWeight", label: "Font Weight", keywords: "font weight thin light bold black", render: (s, p) => <Select label='Font Weight' value={String(s.fontWeight)} onChange={(v) => p({ fontWeight: v })} options={[{ value: "normal", label: "Normal" }, { value: "bold", label: "Bold" }, { value: "300", label: "Light" }, { value: "500", label: "Medium" }, { value: "700", label: "Bold" }, { value: "900", label: "Black" }]} /> },
    { key: "fontLigatures", label: "Font Ligatures", keywords: "font ligatures cursive", render: (s, p) => <Toggle label='Font Ligatures' checked={s.fontLigatures} onChange={() => p({ fontLigatures: !s.fontLigatures })} /> },
    { key: "lineHeight", label: "Line Height", keywords: "line height spacing", render: (s, p) => <Slider label='Line Height' min={12} max={48} value={s.lineHeight} suffix='px' onChange={(v) => p({ lineHeight: v })} /> },
    { key: "", label: "", keywords: "divider", render: () => divider },
    { key: "tabSize", label: "Tab Size", keywords: "tab size indent spacing", render: (s, p) => <Slider label='Tab Size' min={1} max={16} value={s.tabSize} onChange={(v) => p({ tabSize: v })} /> },
    { key: "insertSpaces", label: "Insert Spaces", keywords: "insert spaces tabs indent", render: (s, p) => <Toggle label='Insert Spaces' checked={s.insertSpaces} onChange={() => p({ insertSpaces: !s.insertSpaces })} /> },
    { key: "detectIndentation", label: "Detect Indentation", keywords: "detect auto indent", render: (s, p) => <Toggle label='Detect Indentation' checked={s.detectIndentation} onChange={() => p({ detectIndentation: !s.detectIndentation })} /> },
    { key: "trimAutoWhitespace", label: "Trim Auto Whitespace", keywords: "trim whitespace trailing", render: (s, p) => <Toggle label='Trim Auto Whitespace' checked={s.trimAutoWhitespace} onChange={() => p({ trimAutoWhitespace: !s.trimAutoWhitespace })} /> },
    { key: "", label: "", keywords: "divider", render: () => divider },
    { key: "wordWrap", label: "Word Wrap", keywords: "word wrap column", render: (s, p) => <Select label='Word Wrap' value={s.wordWrap} onChange={(v) => p({ wordWrap: v as EditorSettings["wordWrap"] })} options={[{ value: "off", label: "Off" }, { value: "on", label: "On" }, { value: "wordWrapColumn", label: "Column" }, { value: "bounded", label: "Bounded" }]} /> },
    { key: "wordWrapColumn", label: "Wrap Column", keywords: "wrap column width", render: (s, p) => <Slider label='Wrap Column' min={40} max={160} value={s.wordWrapColumn} onChange={(v) => p({ wordWrapColumn: v })} /> },
    { key: "wrappingIndent", label: "Wrapping Indent", keywords: "wrap indent", render: (s, p) => <Select label='Wrapping Indent' value={s.wrappingIndent} onChange={(v) => p({ wrappingIndent: v as EditorSettings["wrappingIndent"] })} options={[{ value: "none", label: "None" }, { value: "same", label: "Same" }, { value: "indent", label: "Indent" }, { value: "deepIndent", label: "Deep" }]} /> },
    { key: "", label: "", keywords: "divider", render: () => divider },
    { key: "lineNumbers", label: "Line Numbers", keywords: "line numbers gutter", render: (s, p) => <Select label='Line Numbers' value={s.lineNumbers} onChange={(v) => p({ lineNumbers: v as EditorSettings["lineNumbers"] })} options={[{ value: "on", label: "On" }, { value: "off", label: "Off" }, { value: "relative", label: "Relative" }, { value: "interval", label: "Interval" }]} /> },
    { key: "lineNumbersMinChars", label: "Line Number Min Chars", keywords: "line number gutter width", render: (s, p) => <Slider label='Min Chars' min={1} max={10} value={s.lineNumbersMinChars} onChange={(v) => p({ lineNumbersMinChars: v })} /> },
    { key: "renderLineHighlight", label: "Line Highlight", keywords: "line highlight current", render: (s, p) => <Select label='Line Highlight' value={s.renderLineHighlight} onChange={(v) => p({ renderLineHighlight: v as EditorSettings["renderLineHighlight"] })} options={[{ value: "none", label: "None" }, { value: "gutter", label: "Gutter" }, { value: "line", label: "Line" }, { value: "all", label: "All" }]} /> },
    { key: "renderLineHighlightOnlyWhenFocus", label: "Highlight Only When Focused", keywords: "highlight focus", render: (s, p) => <Toggle label='Highlight Only When Focused' checked={s.renderLineHighlightOnlyWhenFocus} onChange={() => p({ renderLineHighlightOnlyWhenFocus: !s.renderLineHighlightOnlyWhenFocus })} /> },
  ],
  appearance: [
    { key: "minimapEnabled", label: "Minimap", keywords: "minimap overview", render: (s, _p, dp) => <Toggle label='Minimap' checked={s.minimap.enabled} onChange={() => dp((st) => ({ ...st, minimap: { ...st.minimap, enabled: !st.minimap.enabled } }))} /> },
    { key: "minimapMaxColumn", label: "Minimap Max Column", keywords: "minimap column width", render: (s, _p, dp) => <Slider label='Max Column' min={60} max={240} value={s.minimap.maxColumn} onChange={(v) => dp((st) => ({ ...st, minimap: { ...st.minimap, maxColumn: v } }))} /> },
    { key: "minimapSide", label: "Minimap Side", keywords: "minimap side position", render: (s, _p, dp) => <Select label='Side' value={s.minimap.side} onChange={(v) => dp((st) => ({ ...st, minimap: { ...st.minimap, side: v as "right" | "left" } }))} options={[{ value: "right", label: "Right" }, { value: "left", label: "Left" }]} /> },
    { key: "minimapScale", label: "Minimap Scale", keywords: "minimap scale zoom", render: (s, _p, dp) => <Slider label='Scale' min={1} max={3} value={s.minimap.scale} onChange={(v) => dp((st) => ({ ...st, minimap: { ...st.minimap, scale: v } }))} /> },
    { key: "", label: "", keywords: "divider", render: () => divider },
    { key: "scrollbarVertical", label: "Vertical Scrollbar", keywords: "scrollbar vertical", render: (s, _p, dp) => <Select label='Vertical' value={s.scrollbar.vertical} onChange={(v) => dp((st) => ({ ...st, scrollbar: { ...st.scrollbar, vertical: v as "auto" | "visible" | "hidden" } }))} options={[{ value: "auto", label: "Auto" }, { value: "visible", label: "Visible" }, { value: "hidden", label: "Hidden" }]} /> },
    { key: "scrollbarHorizontal", label: "Horizontal Scrollbar", keywords: "scrollbar horizontal", render: (s, _p, dp) => <Select label='Horizontal' value={s.scrollbar.horizontal} onChange={(v) => dp((st) => ({ ...st, scrollbar: { ...st.scrollbar, horizontal: v as "auto" | "visible" | "hidden" } }))} options={[{ value: "auto", label: "Auto" }, { value: "visible", label: "Visible" }, { value: "hidden", label: "Hidden" }]} /> },
    { key: "scrollbarVerticalSize", label: "Vertical Scrollbar Size", keywords: "scrollbar size width", render: (s, _p, dp) => <Slider label='Vertical Size' min={6} max={24} value={s.scrollbar.verticalScrollbarSize} suffix='px' onChange={(v) => dp((st) => ({ ...st, scrollbar: { ...st.scrollbar, verticalScrollbarSize: v } }))} /> },
    { key: "scrollbarHorizontalSize", label: "Horizontal Scrollbar Size", keywords: "scrollbar size height", render: (s, _p, dp) => <Slider label='Horizontal Size' min={6} max={24} value={s.scrollbar.horizontalScrollbarSize} suffix='px' onChange={(v) => dp((st) => ({ ...st, scrollbar: { ...st.scrollbar, horizontalScrollbarSize: v } }))} /> },
    { key: "scrollbarUseShadows", label: "Scrollbar Shadows", keywords: "scrollbar shadow", render: (s, _p, dp) => <Toggle label='Use Shadows' checked={s.scrollbar.useShadows} onChange={() => dp((st) => ({ ...st, scrollbar: { ...st.scrollbar, useShadows: !st.scrollbar.useShadows } }))} /> },
    { key: "", label: "", keywords: "divider", render: () => divider },
    { key: "folding", label: "Folding", keywords: "fold code collapse", render: (s, p) => <Toggle label='Folding' checked={s.folding} onChange={() => p({ folding: !s.folding })} /> },
    { key: "foldingStrategy", label: "Folding Strategy", keywords: "fold strategy auto indent", render: (s, p) => <Select label='Strategy' value={s.foldingStrategy} onChange={(v) => p({ foldingStrategy: v as "auto" | "indentation" })} options={[{ value: "auto", label: "Auto" }, { value: "indentation", label: "Indentation" }]} /> },
    { key: "showFoldingControls", label: "Folding Controls", keywords: "fold controls gutter", render: (s, p) => <Select label='Controls' value={s.showFoldingControls} onChange={(v) => p({ showFoldingControls: v as "always" | "never" | "mouseover" })} options={[{ value: "mouseover", label: "On Hover" }, { value: "always", label: "Always" }, { value: "never", label: "Never" }]} /> },
    { key: "glyphMargin", label: "Glyph Margin", keywords: "glyph margin breakpoint gutter", render: (s, p) => <Toggle label='Glyph Margin' checked={s.glyphMargin} onChange={() => p({ glyphMargin: !s.glyphMargin })} /> },
    { key: "", label: "", keywords: "divider", render: () => divider },
    { key: "renderWhitespace", label: "Render Whitespace", keywords: "whitespace space tab render", render: (s, p) => <Select label='Render Whitespace' value={s.renderWhitespace} onChange={(v) => p({ renderWhitespace: v as EditorSettings["renderWhitespace"] })} options={[{ value: "none", label: "None" }, { value: "boundary", label: "Boundary" }, { value: "selection", label: "Selection" }, { value: "all", label: "All" }]} /> },
    { key: "renderControlCharacters", label: "Control Characters", keywords: "control characters render", render: (s, p) => <Toggle label='Control Characters' checked={s.renderControlCharacters} onChange={() => p({ renderControlCharacters: !s.renderControlCharacters })} /> },
    { key: "renderIndentGuides", label: "Indent Guides", keywords: "indent guide vertical line", render: (s, p) => <Toggle label='Indent Guides' checked={s.renderIndentGuides} onChange={() => p({ renderIndentGuides: !s.renderIndentGuides })} /> },
    { key: "renderFinalNewline", label: "Final Newline", keywords: "newline final render", render: (s, p) => <Select label='Final Newline' value={s.renderFinalNewline} onChange={(v) => p({ renderFinalNewline: v as "on" | "off" | "dimmed" })} options={[{ value: "on", label: "On" }, { value: "off", label: "Off" }, { value: "dimmed", label: "Dimmed" }]} /> },
    { key: "bracketPairColorization", label: "Bracket Pair Colorization", keywords: "bracket color pair match", render: (s, _p, dp) => <Toggle label='Bracket Pair Colorization' checked={s.bracketPairColorization.enabled} onChange={() => dp((st) => ({ ...st, bracketPairColorization: { ...st.bracketPairColorization, enabled: !st.bracketPairColorization.enabled } }))} /> },
    { key: "stickyScroll", label: "Sticky Scroll", keywords: "sticky scroll header scope", render: (s, _p, dp) => <Toggle label='Sticky Scroll' checked={s.stickyScroll.enabled} onChange={() => dp((st) => ({ ...st, stickyScroll: { ...st.stickyScroll, enabled: !st.stickyScroll.enabled } }))} /> },
    { key: "matchBrackets", label: "Match Brackets", keywords: "match brackets highlight", render: (s, p) => <Select label='Match Brackets' value={s.matchBrackets} onChange={(v) => p({ matchBrackets: v as "always" | "never" | "near" })} options={[{ value: "always", label: "Always" }, { value: "near", label: "Near" }, { value: "never", label: "Never" }]} /> },
  ],
  cursor: [
    { key: "cursorStyle", label: "Cursor Style", keywords: "cursor style line block underline", render: (s, p) => <Select label='Style' value={s.cursorStyle} onChange={(v) => p({ cursorStyle: v as EditorSettings["cursorStyle"] })} options={[{ value: "line", label: "Line" }, { value: "block", label: "Block" }, { value: "underline", label: "Underline" }, { value: "line-thin", label: "Line Thin" }, { value: "block-outline", label: "Block Outline" }]} /> },
    { key: "cursorBlinking", label: "Cursor Blinking", keywords: "cursor blink animation", render: (s, p) => <Select label='Blinking' value={s.cursorBlinking} onChange={(v) => p({ cursorBlinking: v as EditorSettings["cursorBlinking"] })} options={[{ value: "blink", label: "Blink" }, { value: "smooth", label: "Smooth" }, { value: "phase", label: "Phase" }, { value: "expand", label: "Expand" }, { value: "solid", label: "Solid" }]} /> },
    { key: "cursorSmoothCaretAnimation", label: "Caret Animation", keywords: "caret animation smooth cursor", render: (s, p) => <Select label='Caret Animation' value={s.cursorSmoothCaretAnimation} onChange={(v) => p({ cursorSmoothCaretAnimation: v as EditorSettings["cursorSmoothCaretAnimation"] })} options={[{ value: "off", label: "Off" }, { value: "on", label: "On" }, { value: "explicit", label: "Explicit" }]} /> },
    { key: "cursorWidth", label: "Cursor Width", keywords: "cursor width thickness", render: (s, p) => <Slider label='Width' min={1} max={8} value={s.cursorWidth} suffix='px' onChange={(v) => p({ cursorWidth: v })} /> },
    { key: "cursorSurroundingLines", label: "Surrounding Lines", keywords: "cursor surrounding lines offset", render: (s, p) => <Slider label='Surrounding Lines' min={0} max={20} value={s.cursorSurroundingLines} onChange={(v) => p({ cursorSurroundingLines: v })} /> },
    { key: "multiCursorModifier", label: "Multi-Cursor Modifier", keywords: "multi cursor modifier alt ctrl cmd", render: (s, p) => <Select label='Multi-Cursor Modifier' value={s.multiCursorModifier} onChange={(v) => p({ multiCursorModifier: v as "alt" | "ctrlCmd" })} options={[{ value: "alt", label: "Alt" }, { value: "ctrlCmd", label: "Ctrl/Cmd" }]} /> },
  ],
  behavior: [
    { key: "autoSave", label: "Auto Save", keywords: "auto save autosave", render: (s, p) => <Select label='Auto Save' value={s.autoSave} onChange={(v) => p({ autoSave: v as EditorSettings["autoSave"] })} options={[{ value: "off", label: "Off" }, { value: "afterDelay", label: "After Delay" }, { value: "onFocusChange", label: "On Focus Change" }]} /> },
    { key: "autoSaveDelay", label: "Auto Save Delay", keywords: "auto save delay timer ms", render: (s, p) => <Slider label='Auto Save Delay' min={500} max={10000} step={100} value={s.autoSaveDelay} suffix='ms' onChange={(v) => p({ autoSaveDelay: v })} /> },
    { key: "formatOnSave", label: "Format On Save", keywords: "format save", render: (s, p) => <Toggle label='Format On Save' checked={s.formatOnSave} onChange={() => p({ formatOnSave: !s.formatOnSave })} /> },
    { key: "formatOnPaste", label: "Format On Paste", keywords: "format paste", render: (s, p) => <Toggle label='Format On Paste' checked={s.formatOnPaste} onChange={() => p({ formatOnPaste: !s.formatOnPaste })} /> },
    { key: "formatOnType", label: "Format On Type", keywords: "format type", render: (s, p) => <Toggle label='Format On Type' checked={s.formatOnType} onChange={() => p({ formatOnType: !s.formatOnType })} /> },
    { key: "", label: "", keywords: "divider", render: () => divider },
    { key: "autoClosingBrackets", label: "Auto Closing Brackets", keywords: "auto close brackets", render: (s, p) => <Select label='Auto Closing Brackets' value={s.autoClosingBrackets} onChange={(v) => p({ autoClosingBrackets: v as EditorSettings["autoClosingBrackets"] })} options={[{ value: "always", label: "Always" }, { value: "languageDefined", label: "Language Defined" }, { value: "never", label: "Never" }]} /> },
    { key: "autoIndent", label: "Auto Indent", keywords: "auto indent format", render: (s, p) => <Select label='Auto Indent' value={s.autoIndent} onChange={(v) => p({ autoIndent: v as EditorSettings["autoIndent"] })} options={[{ value: "none", label: "None" }, { value: "keep", label: "Keep" }, { value: "brackets", label: "Brackets" }, { value: "full", label: "Full" }]} /> },
    { key: "dragAndDrop", label: "Drag & Drop", keywords: "drag drop text", render: (s, p) => <Toggle label='Drag & Drop' checked={s.dragAndDrop} onChange={() => p({ dragAndDrop: !s.dragAndDrop })} /> },
    { key: "selectionHighlight", label: "Selection Highlight", keywords: "selection highlight word", render: (s, p) => <Toggle label='Selection Highlight' checked={s.selectionHighlight} onChange={() => p({ selectionHighlight: !s.selectionHighlight })} /> },
    { key: "codeLens", label: "Code Lens", keywords: "code lens reference count", render: (s, p) => <Toggle label='Code Lens' checked={s.codeLens} onChange={() => p({ codeLens: !s.codeLens })} /> },
    { key: "parameterHints", label: "Parameter Hints", keywords: "parameter hints function signature", render: (s, _p, dp) => <Toggle label='Parameter Hints' checked={s.parameterHints.enabled} onChange={() => dp((st) => ({ ...st, parameterHints: { ...st.parameterHints, enabled: !st.parameterHints.enabled } }))} /> },
    { key: "hoverInfo", label: "Hover Info", keywords: "hover tooltip info", render: (s, _p, dp) => <Toggle label='Hover Info' checked={s.hover.enabled} onChange={() => dp((st) => ({ ...st, hover: { ...st.hover, enabled: !st.hover.enabled } }))} /> },
    { key: "links", label: "Clickable Links", keywords: "links clickable url", render: (s, p) => <Toggle label='Clickable Links' checked={s.links} onChange={() => p({ links: !s.links })} /> },
  ],
  intellisense: [
    { key: "quickSuggestions", label: "Quick Suggestions", keywords: "suggestions autocomplete quick", render: (s, p) => <Toggle label='Quick Suggestions' checked={typeof s.quickSuggestions === "boolean" ? s.quickSuggestions : true} onChange={() => { if (typeof s.quickSuggestions === "boolean") { p({ quickSuggestions: { other: true, comments: false, strings: false } }); } else { p({ quickSuggestions: !s.quickSuggestions.other }); } }} /> },
    { key: "suggestOnTriggerCharacters", label: "Suggest On Trigger Characters", keywords: "suggest trigger characters dot", render: (s, p) => <Toggle label='Suggest On Trigger Characters' checked={s.suggestOnTriggerCharacters} onChange={() => p({ suggestOnTriggerCharacters: !s.suggestOnTriggerCharacters })} /> },
    { key: "acceptSuggestionOnEnter", label: "Accept On Enter", keywords: "suggestion accept enter", render: (s, p) => <Select label='Accept On Enter' value={s.acceptSuggestionOnEnter} onChange={(v) => p({ acceptSuggestionOnEnter: v as "on" | "smart" | "off" })} options={[{ value: "on", label: "On" }, { value: "smart", label: "Smart" }, { value: "off", label: "Off" }]} /> },
    { key: "tabCompletion", label: "Tab Completion", keywords: "tab complete suggestion", render: (s, p) => <Select label='Tab Completion' value={s.tabCompletion} onChange={(v) => p({ tabCompletion: v as "on" | "off" | "onlySnippets" })} options={[{ value: "on", label: "On" }, { value: "off", label: "Off" }, { value: "onlySnippets", label: "Snippets Only" }]} /> },
    { key: "snippetSuggestions", label: "Snippet Suggestions", keywords: "snippet suggestions position", render: (s, p) => <Select label='Snippet Suggestions' value={s.snippetSuggestions} onChange={(v) => p({ snippetSuggestions: v as "top" | "bottom" | "inline" | "none" })} options={[{ value: "top", label: "Top" }, { value: "bottom", label: "Bottom" }, { value: "inline", label: "Inline" }, { value: "none", label: "None" }]} /> },
    { key: "inlineSuggest", label: "Inline Suggest", keywords: "inline ghost text suggest", render: (s, _p, dp) => <Toggle label='Inline Suggest' checked={s.inlineSuggest.enabled} onChange={() => dp((st) => ({ ...st, inlineSuggest: { ...st.inlineSuggest, enabled: !st.inlineSuggest.enabled } }))} /> },
    { key: "acceptSuggestionOnCommitCharacter", label: "Suggest On Commit Char", keywords: "suggest commit character accept", render: (s, p) => <Toggle label='Suggest On Commit Char' checked={s.acceptSuggestionOnCommitCharacter} onChange={() => p({ acceptSuggestionOnCommitCharacter: !s.acceptSuggestionOnCommitCharacter })} /> },
  ],
  scrolling: [
    { key: "smoothScrolling", label: "Smooth Scrolling", keywords: "smooth scroll animation", render: (s, p) => <Toggle label='Smooth Scrolling' checked={s.smoothScrolling} onChange={() => p({ smoothScrolling: !s.smoothScrolling })} /> },
    { key: "scrollBeyondLastLine", label: "Scroll Beyond Last Line", keywords: "scroll beyond last line bottom", render: (s, p) => <Toggle label='Scroll Beyond Last Line' checked={s.scrollBeyondLastLine} onChange={() => p({ scrollBeyondLastLine: !s.scrollBeyondLastLine })} /> },
    { key: "mouseWheelZoom", label: "Mouse Wheel Zoom", keywords: "mouse wheel zoom ctrl scroll", render: (s, p) => <Toggle label='Mouse Wheel Zoom' checked={s.mouseWheelZoom} onChange={() => p({ mouseWheelZoom: !s.mouseWheelZoom })} /> },
    { key: "mouseWheelScrollSensitivity", label: "Wheel Sensitivity", keywords: "mouse wheel scroll sensitivity speed", render: (s, p) => <Slider label='Wheel Sensitivity' min={0.5} max={10} step={0.5} value={s.mouseWheelScrollSensitivity} onChange={(v) => p({ mouseWheelScrollSensitivity: v })} /> },
    { key: "fastScrollSensitivity", label: "Fast Scroll Sensitivity", keywords: "fast scroll shift speed", render: (s, p) => <Slider label='Fast Scroll Sensitivity' min={1} max={20} value={s.fastScrollSensitivity} onChange={(v) => p({ fastScrollSensitivity: v })} /> },
  ],
  advanced: [
    { key: "unicodeAmbiguous", label: "Unicode Ambiguous", keywords: "unicode ambiguous character", render: (s, _p, dp) => <Toggle label='Unicode Ambiguous' checked={s.unicodeHighlight.ambiguousCharacters} onChange={() => dp((st) => ({ ...st, unicodeHighlight: { ...st.unicodeHighlight, ambiguousCharacters: !st.unicodeHighlight.ambiguousCharacters } }))} /> },
    { key: "unicodeInvisible", label: "Unicode Invisible", keywords: "unicode invisible hidden", render: (s, _p, dp) => <Toggle label='Unicode Invisible' checked={s.unicodeHighlight.invisibleCharacters} onChange={() => dp((st) => ({ ...st, unicodeHighlight: { ...st.unicodeHighlight, invisibleCharacters: !st.unicodeHighlight.invisibleCharacters } }))} /> },
    { key: "inlayHints", label: "Inlay Hints", keywords: "inlay hints type annotation", render: (s, _p, dp) => <Select label='Inlay Hints' value={s.inlayHints.enabled} onChange={(v) => dp((st) => ({ ...st, inlayHints: { ...st.inlayHints, enabled: v as "on" | "off" | "offUnlessPressed" | "onUnlessPressed" } }))} options={[{ value: "on", label: "On" }, { value: "off", label: "Off" }, { value: "offUnlessPressed", label: "Off Unless Pressed" }]} /> },
    { key: "largeFileOptimizations", label: "Large File Optimizations", keywords: "large file performance", render: (s, p) => <Toggle label='Large File Optimizations' checked={s.largeFileOptimizations} onChange={() => p({ largeFileOptimizations: !s.largeFileOptimizations })} /> },
    { key: "wordBasedSuggestions", label: "Word Based Suggestions", keywords: "word based suggestions autocomplete", render: (s, p) => <Select label='Word Based Suggestions' value={s.wordBasedSuggestions} onChange={(v) => p({ wordBasedSuggestions: v as "off" | "currentDocument" | "matchingDocuments" | "allDocuments" })} options={[{ value: "currentDocument", label: "Current Doc" }, { value: "matchingDocuments", label: "Matching Docs" }, { value: "off", label: "Off" }]} /> },
    { key: "", label: "", keywords: "divider", render: () => divider },
    { key: "defaultShell", label: "Default Shell", keywords: "shell terminal default", render: (s, p) => <Select label='Default Shell' value={s.defaultShell || ""} onChange={(v) => p({ defaultShell: v })} options={[{ value: "", label: "Auto-detect" }, { value: "pwsh", label: "PowerShell 7" }, { value: "powershell", label: "Windows PowerShell" }, { value: "cmd", label: "Command Prompt" }, { value: "wsl", label: "WSL" }, { value: "bash", label: "Bash" }, { value: "zsh", label: "Zsh" }, { value: "fish", label: "Fish" }, { value: "sh", label: "Sh" }]} /> },
    { key: "semanticTokens", label: "Semantic Tokens", keywords: "semantic tokens highlighting", render: (s, p) => <Toggle label='Semantic Tokens' checked={s.semanticTokens} onChange={() => p({ semanticTokens: !s.semanticTokens })} /> },
    { key: "paddingTop", label: "Padding Top", keywords: "padding top space", render: (s, _p, dp) => <Slider label='Padding Top' min={0} max={50} value={s.padding.top} suffix='px' onChange={(v) => dp((st) => ({ ...st, padding: { ...st.padding, top: v } }))} /> },
    { key: "paddingBottom", label: "Padding Bottom", keywords: "padding bottom space", render: (s, _p, dp) => <Slider label='Padding Bottom' min={0} max={50} value={s.padding.bottom} suffix='px' onChange={(v) => dp((st) => ({ ...st, padding: { ...st.padding, bottom: v } }))} /> },
    { key: "", label: "", keywords: "divider", render: () => divider },
    { key: "shortcuts", label: "", keywords: "shortcuts divider", render: (s, p, dp, settings) => (
      <>
        <p className='text-[11px] uppercase tracking-wider text-faint mb-2'>Shortcuts</p>
        <div className='space-y-1'>
          {[
            ["Command Palette", "Ctrl+Shift+P"], ["Save File", "Ctrl+S"], ["Close Tab", "Ctrl+W"],
            ["Toggle Terminal", "Ctrl+`"], ["Toggle Sidebar", "Ctrl+B"], ["Next Tab", "Ctrl+Tab"], ["Settings", "Ctrl+,"],
          ].map(([label, keys]) => (
            <div key={label} className='flex items-center justify-between text-[12px]'>
              <span className='text-secondary'>{label}</span>
              <kbd className='rounded border border-subtle px-1.5 py-0.5 text-[10px] text-tertiary'>{keys}</kbd>
            </div>
          ))}
        </div>
      </>
    )},
  ],
};

export default function SettingsPanel({
  settings,
  onSettingsChange,
}: SettingsPanelProps) {
  const [activeCategory, setActiveCategory] = useState("editor");
  const [searchQuery, setSearchQuery] = useState("");

  const p = (patch: Partial<EditorSettings>) => onSettingsChange(patch);
  const dp = (fn: (s: EditorSettings) => EditorSettings) => onSettingsChange(fn(settings));

  const isSearching = searchQuery.trim().length > 0;
  const query = searchQuery.toLowerCase().trim();

  const searchResults = useMemo(() => {
    if (!isSearching) return null;
    const results: { catId: string; catLabel: string; defs: SettingDef[] }[] = [];
    for (const cat of categories) {
      const defs = settingDefs[cat.id].filter(
        (d) => d.key && (d.label.toLowerCase().includes(query) || d.keywords.toLowerCase().includes(query)),
      );
      if (defs.length > 0) {
        results.push({ catId: cat.id, catLabel: cat.label, defs });
      }
    }
    return results;
  }, [query, isSearching]);

  const activeDefs = settingDefs[activeCategory] ?? [];

  return (
    <div data-theme="dark" className='h-full flex flex-col overflow-hidden bg-canvas'>
      {/* Header */}
      <div className='flex items-center justify-between px-4 py-2 border-b border-subtle bg-panel shrink-0'>
        <span className='text-sm font-semibold text-[#DC143C]'>Settings</span>
      </div>

      <div className='flex flex-1 overflow-hidden'>
        {/* Sidebar */}
        <aside className='w-48 border-r border-subtle bg-panel flex flex-col shrink-0'>
          {/* Search bar */}
          <div className='p-2'>
            <div className='flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-[#0a0a0a] border border-subtle text-tertiary focus-within:text-primary focus-within:border-[#DC143C]/40 transition-colors'>
              <Search size={13} className='shrink-0' />
              <input
                type='text'
                placeholder='Search settings…'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className='flex-1 bg-transparent outline-none text-[12px] text-primary placeholder:text-tertiary'
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className='text-tertiary hover:text-primary text-[11px]'>
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Category nav */}
          <nav className='flex-1 overflow-y-auto px-2 pb-2 space-y-0.5'>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => { setActiveCategory(cat.id); setSearchQuery(""); }}
                className={`flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  activeCategory === cat.id && !isSearching
                    ? "text-[#DC143C] bg-[#DC143C]/10"
                    : "text-secondary hover:text-primary hover:bg-white/5"
                }`}
              >
                {cat.icon}
                {cat.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <div className='flex-1 overflow-y-auto p-5 bg-canvas'>
          <AnimatePresence mode='wait'>
            <motion.div
              key={isSearching ? "search" : activeCategory}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.1 }}
              className='max-w-xl'
            >
              {isSearching ? (
                searchResults && searchResults.length > 0 ? (
                  searchResults.map((r) => (
                    <div key={r.catId} className='mb-5'>
                      <h3 className='text-[11px] uppercase tracking-wider text-faint mb-2 px-0.5'>{r.catLabel}</h3>
                      <div className='bg-[#0a0a0a] border border-subtle rounded-xl p-4 space-y-1'>
                        {r.defs.map((d) => <div key={d.key}>{d.render(settings, p, dp, settings)}</div>)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className='flex flex-col items-center justify-center py-16 text-tertiary'>
                    <Search size={32} className='mb-3 opacity-40' />
                    <p className='text-sm'>No results for &ldquo;{searchQuery}&rdquo;</p>
                    <button onClick={() => setSearchQuery("")} className='text-xs text-[#DC143C] hover:underline mt-2'>Clear search</button>
                  </div>
                )
              ) : (
                <div className='bg-[#0a0a0a] border border-subtle rounded-xl p-4 space-y-1'>
                  {activeDefs.map((d) => <div key={d.key || Math.random()}>{d.render(settings, p, dp, settings)}</div>)}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
