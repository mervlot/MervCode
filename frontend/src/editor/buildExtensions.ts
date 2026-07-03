import { basicSetup } from "codemirror";
import { editorRegistry, fallbackRegistry } from "./registry";
import tooltipTheme from "./tooltip/tooltip";
import { oneDark } from "@codemirror/theme-one-dark";
export function buildExtensions(
  langKey: string,
  plugins: { extraExtensions?: any[] } = {},
) {
  const config = editorRegistry[langKey] || fallbackRegistry;

  return [
    basicSetup,
    tooltipTheme,
    oneDark,
    ...(config.extensions || []),
    ...(plugins.extraExtensions || []),
  ];
}
