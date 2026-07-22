import { useMemo, useState, type DragEvent as ReactDragEvent, type MouseEvent as ReactMouseEvent } from "react";
import type * as monaco from "monaco-editor";
import type { FileTab } from "../types";

export type ContextMenuState = {
  x: number;
  y: number;
  path: string;
} | null;

interface UseTabManagerParams {
  tabs: FileTab[];
  setTabs: React.Dispatch<React.SetStateAction<FileTab[]>>;
  activePath: string | null;
  setActivePath: React.Dispatch<React.SetStateAction<string | null>>;
  savedContent: Record<string, string>;
  liveContent: Record<string, string>;
  setSavedContent: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setLiveContent: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  editorRefs: React.RefObject<Record<string, monaco.editor.IStandaloneCodeEditor>>;
  setActiveTab: React.Dispatch<React.SetStateAction<string>>;
}

export default function useTabManager({
  tabs,
  setTabs,
  activePath,
  setActivePath,
  savedContent,
  liveContent,
  setSavedContent,
  setLiveContent,
  editorRefs,
  setActiveTab,
}: UseTabManagerParams) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [draggedTabPath, setDraggedTabPath] = useState<string | null>(null);
  const [dropTargetPath, setDropTargetPath] = useState<string | null>(null);

  const activeFile = tabs.find((t) => t.path === activePath);

  function isDirty(path: string) {
    if (!(path in savedContent) || !(path in liveContent)) return false;
    return savedContent[path] !== liveContent[path];
  }

  const dirtyCount = useMemo(
    () => tabs.filter((t) => isDirty(t.path)).length,
    [tabs, savedContent, liveContent],
  );

  function confirmDiscard(paths: string[]): boolean {
    const dirtyPaths = paths.filter(isDirty);
    if (dirtyPaths.length === 0) return true;
    const names = dirtyPaths
      .map((p) => tabs.find((t) => t.path === p)?.name ?? p)
      .join(", ");
    return confirm(
      dirtyPaths.length === 1
        ? `"${names}" has unsaved changes. Discard them?`
        : `${dirtyPaths.length} files have unsaved changes (${names}). Discard them?`,
    );
  }

  function closeTab(path: string) {
    if (!confirmDiscard([path])) return;
    const index = tabs.findIndex((tab) => tab.path === path);
    const remainingTabs = tabs.filter((tab) => tab.path !== path);
    let nextActivePath = activePath;
    if (activePath === path) {
      nextActivePath = remainingTabs[Math.max(index - 1, 0)]?.path ?? null;
    }
    setTabs(remainingTabs);
    setActivePath(nextActivePath);
    setContextMenu(null);
    if (editorRefs.current) delete editorRefs.current[path];
  }

  function closeOthers(path: string) {
    const others = tabs.filter((t) => t.path !== path).map((t) => t.path);
    if (!confirmDiscard(others)) return;
    setTabs(tabs.filter((tab) => tab.path === path));
    setActivePath(path);
    setContextMenu(null);
  }

  function closeTabsToRight(path: string) {
    const currentIndex = tabs.findIndex((tab) => tab.path === path);
    const removed = tabs.slice(currentIndex + 1).map((t) => t.path);
    if (!confirmDiscard(removed)) return;
    const nextTabs = tabs.slice(0, currentIndex + 1);
    let nextActivePath = activePath;
    if (activePath && !nextTabs.some((tab) => tab.path === activePath)) {
      nextActivePath = nextTabs.at(-1)?.path ?? null;
    }
    setTabs(nextTabs);
    setActivePath(nextActivePath);
    setContextMenu(null);
  }

  function closeAllTabs() {
    if (!confirmDiscard(tabs.map((t) => t.path))) return;
    setTabs([]);
    setActivePath(null);
    setContextMenu(null);
  }

  function cycleTab(direction: 1 | -1) {
    if (tabs.length === 0) return;
    const currentIndex = tabs.findIndex((t) => t.path === activePath);
    const nextIndex = (currentIndex + direction + tabs.length) % tabs.length;
    setActivePath(tabs[nextIndex]?.path ?? null);
  }

  function handleContextMenu(event: ReactMouseEvent<HTMLDivElement>, path: string) {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ x: event.clientX, y: event.clientY, path });
  }

  function handleTabDragStart(event: ReactDragEvent<HTMLDivElement>, path: string) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", path);
    setDraggedTabPath(path);
    setDropTargetPath(path);
  }

  function handleTabDragOver(event: ReactDragEvent<HTMLDivElement>, targetPath: string) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropTargetPath(targetPath);
  }

  function handleTabDrop(event: ReactDragEvent<HTMLDivElement>, targetPath: string) {
    event.preventDefault();
    const sourcePath = event.dataTransfer.getData("text/plain") || draggedTabPath;
    if (!sourcePath || sourcePath === targetPath) {
      setDraggedTabPath(null);
      setDropTargetPath(null);
      return;
    }
    setTabs((prev) => {
      const sourceIndex = prev.findIndex((tab) => tab.path === sourcePath);
      const targetIndex = prev.findIndex((tab) => tab.path === targetPath);
      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return prev;
      const nextTabs = [...prev];
      const [movedTab] = nextTabs.splice(sourceIndex, 1);
      if (!movedTab) return prev;
      const adjustedTargetIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
      nextTabs.splice(adjustedTargetIndex, 0, movedTab);
      return nextTabs;
    });
    setDraggedTabPath(null);
    setDropTargetPath(null);
  }

  function handleTabDragEnd() {
    setDraggedTabPath(null);
    setDropTargetPath(null);
  }

  function copyTabPath(path: string) {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(path).catch(() => undefined);
    }
    setContextMenu(null);
  }

  function revealTabInExplorer(path: string) {
    setActiveTab("explorer");
    setContextMenu(null);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("mervcode:reveal-in-explorer", { detail: { path } }),
      );
    }
  }

  return {
    activeFile,
    dirtyCount,
    isDirty,
    confirmDiscard,
    closeTab,
    closeOthers,
    closeTabsToRight,
    closeAllTabs,
    cycleTab,
    contextMenu,
    setContextMenu,
    handleContextMenu,
    draggedTabPath,
    dropTargetPath,
    handleTabDragStart,
    handleTabDragOver,
    handleTabDrop,
    handleTabDragEnd,
    copyTabPath,
    revealTabInExplorer,
  };
}
