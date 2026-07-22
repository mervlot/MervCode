import { useCallback, useRef } from "react";
import type * as monaco from "monaco-editor";
import type { FileTab } from "../types";
import { InspectAndReadFile, WriteFile } from "../../wailsjs/go/main/App";

interface UseFileOpsParams {
  tabs: FileTab[];
  setTabs: React.Dispatch<React.SetStateAction<FileTab[]>>;
  activePath: string | null;
  setActivePath: React.Dispatch<React.SetStateAction<string | null>>;
  setSavedContent: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setLiveContent: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  liveContent: Record<string, string>;
  editorRefs: React.RefObject<Record<string, monaco.editor.IStandaloneCodeEditor>>;
}

function jumpToLine(
  editorRefs: React.RefObject<Record<string, monaco.editor.IStandaloneCodeEditor>>,
  path: string,
  line?: number,
) {
  if (!line) return;
  let attempts = 0;
  const tryReveal = () => {
      const editor = editorRefs.current?.[path];
    if (editor) {
      editor.revealLineInCenter(line);
      editor.setPosition({ lineNumber: line, column: 1 });
      editor.focus();
    } else if (attempts < 20) {
      attempts += 1;
      setTimeout(tryReveal, 50);
    }
  };
  tryReveal();
}

export default function useFileOps({
  tabs,
  setTabs,
  activePath,
  setActivePath,
  setSavedContent,
  setLiveContent,
  liveContent,
  editorRefs,
}: UseFileOpsParams) {
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;

  async function openFile(file: FileTab, revealLine?: number) {
    const exists = tabsRef.current.find((t) => t.path === file.path);
    if (exists) {
      setActivePath(file.path);
      jumpToLine(editorRefs, file.path, revealLine);
      return;
    }
    try {
      const response = await InspectAndReadFile(file.path);
      setTabs((prev) => [
        ...prev,
        { ...file, category: response.category, content: response.content },
      ]);
      setActivePath(file.path);
      if (response.category === "editor" || response.category === "spreadsheet") {
        setSavedContent((prev) => ({ ...prev, [file.path]: response.content }));
        setLiveContent((prev) => ({ ...prev, [file.path]: response.content }));
      }
      jumpToLine(editorRefs, file.path, revealLine);
    } catch (err) {
      console.error("Failed to open file:", err);
    }
  }

  function openPathByString(path: string, line?: number) {
    const existingTab = tabsRef.current.find((t) => t.path === path);
    if (existingTab) {
      setActivePath(path);
      jumpToLine(editorRefs, path, line);
      return;
    }
    const name = path.split(/[\\/]/).pop() ?? path;
    void openFile({ path, name } as FileTab, line);
  }

  async function saveActiveFile(activeFile: FileTab | undefined) {
    if (!activeFile || !activePath) return;
    const content = liveContent[activePath] ?? activeFile.content ?? "";
    try {
      await WriteFile(activePath, content);
      setSavedContent((prev) => ({ ...prev, [activePath]: content }));
    } catch (err) {
      console.error("Failed to save file:", err);
    }
  }

  async function saveByPath(path: string, content: string) {
    try {
      await WriteFile(path, content);
      setSavedContent((prev) => ({ ...prev, [path]: content }));
    } catch (err) {
      console.error("Failed to save file:", err);
    }
  }

  return { openFile, openPathByString, saveActiveFile, saveByPath };
}
