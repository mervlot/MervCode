import { basicSetup } from "codemirror";
import { editorRegistry, fallbackRegistry } from "./registry";
import tooltipTheme from "./tooltip/tooltip";
export function buildExtensions(langKey, plugins = {}) {
  const config = editorRegistry[langKey] || fallbackRegistry;

  return [
    basicSetup,
    tooltipTheme,

    ...(config.extensions || []),
    ...(plugins.extraExtensions || []),
  ];
}
