import { editorRegistry, fallbackRegistry } from "./registry";

export async function formatDocument(langKey, code) {
  const config = editorRegistry[langKey] || fallbackRegistry;

  if (!config.formatter) return code;

  return await config.formatter(code);
}
