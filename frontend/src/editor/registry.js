import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
import { createEslintLinter, customLintGutter } from "./linter/eslint";
impo
// Instantiate extension items for easy plug-and-play mapping
const eslintLinter = createEslintLinter();
const customGutter = customLintGutter();

export const editorRegistry = {
  js: {
    formatter: formatJS,
    extensions: [
      javascript(),
      oneDark,
      eslintLinter,
      customGutter, // Injected clean custom components array
    ],
  },

  ts: {
    formatter: (code) => formatJS(code, "ts"),
    extensions: [
      javascript({ typescript: true }),
      oneDark,
      eslintLinter,
      customGutter,
    ],
  },
};

export const fallbackRegistry = {
  formatter: null,
  extensions: [],
};
