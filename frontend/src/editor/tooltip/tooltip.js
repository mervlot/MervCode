import { EditorView } from "@codemirror/view";

const tooltipTheme = EditorView.theme({
  /* MAIN TOOLTIP */
  ".cm-tooltip": {
    background: "rgba(24, 24, 27, 0.96)",
    color: "#d4d4d4",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: "12px",
    overflow: "hidden",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    boxShadow:
      "0 10px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.03)",
    fontFamily: `"Segoe UI", sans-serif`,
    fontSize: "13px",
  },

  /* REMOVE UGLY LEFT BAR */
  ".cm-diagnostic": {
    borderLeft: "none !important",
    paddingLeft: "14px",
    position: "relative",
  },

  /* ERROR DOT */
  ".cm-diagnostic-error::before": {
    content: '""',
    position: "absolute",
    left: "4px",
    top: "11px",
    width: "6px",
    height: "6px",
    borderRadius: "999px",
    background: "#ff5f56",
    boxShadow: "0 0 10px rgba(255,95,86,0.7)",
  },

  /* WARNING DOT */
  ".cm-diagnostic-warning::before": {
    content: '""',
    position: "absolute",
    left: "4px",
    top: "11px",
    width: "6px",
    height: "6px",
    borderRadius: "999px",
    background: "#ffbd2e",
    boxShadow: "0 0 10px rgba(255,189,46,0.7)",
  },

  /* INFO DOT */
  ".cm-diagnostic-info::before": {
    content: '""',
    position: "absolute",
    left: "4px",
    top: "11px",
    width: "6px",
    height: "6px",
    borderRadius: "999px",
    background: "#4FC1FF",
    boxShadow: "0 0 10px rgba(79,193,255,0.7)",
  },

  /* TOOLTIP CONTENT */
  ".cm-tooltip > div": {
    padding: "6px 10px",
  },

  /* AUTOCOMPLETE */
  ".cm-tooltip-autocomplete": {
    padding: "4px",
    minWidth: "240px",
  },

  /* AUTOCOMPLETE LIST */
  ".cm-tooltip-autocomplete ul": {
    outline: "none",
    maxHeight: "250px",
    padding: "2px",
  },

  /* OPTION */
  ".cm-tooltip-autocomplete ul li": {
    padding: "6px 10px",
    borderRadius: "8px",
    transition: "all 120ms ease",
  },

  /* SELECTED OPTION */
  ".cm-tooltip-autocomplete ul li[aria-selected]": {
    background: "rgba(255,255,255,0.08)",
    color: "#ffffff",
  },

  /* LABEL */
  ".cm-completionLabel": {
    fontFamily: `"Segoe UI", sans-serif`,
    color: "#d4d4d4",
  },

  /* DETAIL */
  ".cm-completionDetail": {
    color: "#858585",
    fontStyle: "italic",
  },

  /* MATCHED TEXT */
  ".cm-completionMatchedText": {
    color: "#4FC1FF",
    fontWeight: "600",
    textDecoration: "none",
  },

  /* SCROLLBAR */
  ".cm-tooltip-autocomplete ul::-webkit-scrollbar": {
    width: "8px",
  },

  ".cm-tooltip-autocomplete ul::-webkit-scrollbar-thumb": {
    background: "#3a3a3a",
    borderRadius: "999px",
  },

  ".cm-tooltip-autocomplete ul::-webkit-scrollbar-track": {
    background: "transparent",
  },

  /* HOVER TOOLTIP */
  ".cm-tooltip.cm-tooltip-hover": {
    padding: "2px",
  },

  /* TOOLTIP ARROW */
  ".cm-tooltip-arrow:before": {
    borderTopColor: "rgba(24,24,27,0.96)",
  },

  ".cm-tooltip-arrow:after": {
    borderTopColor: "transparent",
  },
});

export default tooltipTheme;
