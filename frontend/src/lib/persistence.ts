const STORAGE_KEY = "mervcode.workspace-state";

export function loadWorkspaceState() {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    console.warn("Failed to restore workspace state", error);
    return {};
  }
}

export function saveWorkspaceState(state: any) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn("Failed to persist workspace state", error);
  }
}
