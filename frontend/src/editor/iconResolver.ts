// ../editor/iconResolver.js


const cache = new Map();

/**
 * Loads icon dynamically from your assets folder
 * expects: ../assets/icons/{name}.svg
 */
export async function resolveIcon(name:String): Promise<string> {
  const key = name;

  if (cache.has(key)) return cache.get(key);

  try {
    const mod = await import(`../assets/icons/${name}.svg`);
    const icon = mod.default || mod;

    cache.set(key, icon);
    return icon;
  } catch (e) {
    const fallback: string = (await import("../assets/icons/file.svg")).default;
    cache.set(key, fallback);
    return fallback;
  }
}
