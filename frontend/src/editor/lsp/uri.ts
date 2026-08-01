/** Converts a filesystem path (Windows or POSIX) to a `file://` URI. */
export function toFileUri(path: string): string {
  let p = path.replace(/\\/g, "/");
  if (/^[A-Za-z]:/.test(p)) {
    // use charAt to avoid possible undefined when indexing an empty string
    p = p.charAt(0).toLowerCase() + p.slice(1);
  }
  if (!p.startsWith("/")) p = "/" + p;
  return "file://" + p;
}

/** Best-effort inverse of toFileUri, for display purposes only. */
export function fromFileUri(uri: string): string {
  if (!uri.startsWith("file://")) return uri;
  let p = uri.slice("file://".length);
  try {
    p = decodeURIComponent(p);
  } catch {
    // leave as-is if malformed
  }
  if (/^\/[A-Za-z]:/.test(p)) p = p.slice(1);
  return p;
}
