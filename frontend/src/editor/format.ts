import { editorRegistry, fallbackRegistry } from "./registry";

export async function formatDocument(langKey: string, code: string): Promise<string> {
  const config = editorRegistry[langKey] || fallbackRegistry;

  if (!config.formatter) return code;

  return await config.formatter(code);
}
