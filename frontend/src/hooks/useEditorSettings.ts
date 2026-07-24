import { useCallback, useEffect, useState } from "react";
import type { EditorSettings } from "../types";

const STORAGE_KEY = "mervcode:editorSettings";

const defaults: EditorSettings = {
  fontSize: 14,
  tabSize: 2,
  insertSpaces: true,
  wordWrap: "off",
  minimap: false,
  fontLigatures: true,
  lineNumbers: "on",
  autoSave: false,
  formatOnSave: false,
  formatOnPaste: false,
  formatOnType: false,
};

function load(): EditorSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaults };
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return { ...defaults };
  }
}

function save(settings: EditorSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function useEditorSettings() {
  const [settings, setSettings] = useState<EditorSettings>(load);

  useEffect(() => {
    save(settings);
  }, [settings]);

  const updateSettings = useCallback(
    (patch: Partial<EditorSettings>) => {
      setSettings((prev) => ({ ...prev, ...patch }));
    },
    [],
  );

  return { settings, updateSettings };
}
