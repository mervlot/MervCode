// import { linter } from "@codemirror/lint";
// import { esLint } from "@codemirror/lang-javascript";
// import { StateField, RangeSet } from "@codemirror/state";
// import { EditorView, GutterMarker, gutter } from "@codemirror/view";
// import { Linter } from "eslint-linter-browserify";

// const eslintEngine = new Linter();

// class CustomErrorMarker extends GutterMarker {
//   toDOM() {
//     const el = document.createElement("div");
//     el.className = "cm-custom-marker marker-error";
//     return el;
//   }
// }

// class CustomWarningMarker extends GutterMarker {
//   toDOM() {
//     const el = document.createElement("div");
//     el.className = "cm-custom-marker marker-warning";
//     return el;
//   }
// }

// const errorMarker = new CustomErrorMarker();
// const warningMarker = new CustomWarningMarker();

// const lintGutterState = StateField.define({
//   create() {
//     return RangeSet.empty;
//   },
//   update(set, transaction) {
//     set = set.map(transaction.changes);

//     for (let effect of transaction.effects) {
//       if (effect.is(linter.setDiagnosticsEffect)) {
//         const diagnostics = effect.value;
//         const builder = new RangeSet.Builder();

//         // 1. Group diagnostics by line so we only add one marker per line
//         const linesWithDiagnostics = new Map();

//         for (const diag of diagnostics) {
//           try {
//             // Find the structural line object matching the character index
//             const line = transaction.state.doc.lineAt(diag.from);
//             const currentHighestSeverity = linesWithDiagnostics.get(line.from);

//             // Errors win over warnings if they share a line
//             if (
//               diag.severity === "error" ||
//               currentHighestSeverity !== "error"
//             ) {
//               linesWithDiagnostics.set(line.from, diag.severity);
//             }
//           } catch (e) {
//             continue;
//           }
//         }

//         // 2. Sort the unique line positions sequentially for the RangeSet Builder
//         const sortedLinePositions = Array.from(
//           linesWithDiagnostics.keys(),
//         ).sort((a, b) => a - b);

//         for (const linePos of sortedLinePositions) {
//           const severity = linesWithDiagnostics.get(linePos);
//           const marker = severity === "error" ? errorMarker : warningMarker;

//           // Snap the marker cleanly to the start of the line column
//           builder.add(linePos, linePos, marker);
//         }

//         return builder.finish();
//       }
//     }
//     return set;
//   },
// });

// export function customLintGutter() {
//   return [
//     lintGutterState,
//     gutter({
//       class: "cm-custom-eslint-gutter",
//       markers: (view) => view.state.field(lintGutterState),
//       initialSpacer: () => errorMarker,
//     }),
//     EditorView.baseTheme({
//       ".cm-custom-eslint-gutter": {
//         width: "20px", // Marginally widened for hitboxes
//         backgroundColor: "#21252b",
//         display: "flex",
//         justifyContent: "center",
//       },
//       ".cm-custom-eslint-gutter .cm-gutterElement": {
//         display: "flex",
//         alignItems: "center",
//         justifyContent: "center",
//         padding: "0",
//         height: "100%",
//       },
//       ".cm-custom-marker": {
//         width: "8px",
//         height: "8px",
//         borderRadius: "50%",
//         display: "block",
//       },
//       ".cm-custom-marker.marker-error": {
//         backgroundColor: "#e06c75 !important",
//         boxShadow: "0 0 8px rgba(224, 108, 117, 0.7)",
//       },
//       ".cm-custom-marker.marker-warning": {
//         backgroundColor: "#d19a66 !important",
//         boxShadow: "0 0 8px rgba(209, 154, 102, 0.7)",
//       },
//     }),
//   ];
// }

// export function createEslintLinter() {
//   return linter(
//     esLint(eslintEngine, {
//       rules: {
//         // semi: ["warn", "always"],
//         // "no-console": "warn",
//         "no-unused-vars": "warn",
//         eqeqeq: ["error", "always"],
//         "no-undef": "error",
//       },
//       languageOptions: {
//         ecmaVersion: 2022,
//         sourceType: "module",
//         globals: { window: true, document: true, console: true, fetch: true },
//       },
//     }),
//     { delay: 300 },
//   );
// }
