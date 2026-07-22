import { useEffect, useMemo, useRef, useState } from "react";
import type * as monaco from "monaco-editor";

// Components
import Header from "../components/editor/Header";
import Sidebar from "../components/editor/Sidebar";
import EditorArea from "../components/editor/EditorArea";
import StatusBar from "../components/editor/StatusBar";

// Hooks
import useTabManager from "../hooks/useTabManager";
import useFileOps from "../hooks/useFileOps";

// Utilities
import { Quit } from "../../wailsjs/go/main/App";
import { detectLang } from "../editor/detectLang.js";
import { loadWorkspaceState, saveWorkspaceState } from "../lib/persistence.js";
import type { FileTab, WorkspaceRoot } from "../types";

const FONT_SIZE_KEY = "mervcode:fontSize";

export default function Home() {
  const [activeTab, setActiveTab] = useState("explorer");
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(true);
  const [workspaceRoot, setWorkspaceRoot] = useState<WorkspaceRoot | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [fontSize, setFontSize] = useState<number>(() => {
    if (typeof window === "undefined") return 14;
    const stored = Number(window.localStorage.getItem(FONT_SIZE_KEY));
    return stored >= 10 && stored <= 22 ? stored : 14;
  });

  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const [tabs, setTabs] = useState<FileTab[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [savedContent, setSavedContent] = useState<Record<string, string>>({});
  const [liveContent, setLiveContent] = useState<Record<string, string>>({});
  const editorRefs = useRef<Record<string, monaco.editor.IStandaloneCodeEditor>>({});

  const tab = useTabManager({
    tabs, setTabs,
    activePath, setActivePath,
    savedContent, liveContent,
    setSavedContent, setLiveContent,
    editorRefs,
    setActiveTab,
  });

  const { openFile, openPathByString, saveActiveFile, saveByPath } = useFileOps({
    tabs, setTabs,
    activePath, setActivePath,
    setSavedContent, setLiveContent,
    liveContent, editorRefs,
  });

  const language = useMemo(() => {
    if (!tab.activeFile) return "plaintext";
    return detectLang(tab.activeFile.name);
  }, [tab.activeFile]);

  // Persist font size
  useEffect(() => {
    window.localStorage.setItem(FONT_SIZE_KEY, String(fontSize));
  }, [fontSize]);

  // Restore workspace state on mount
  useEffect(() => {
    const saved = loadWorkspaceState();
    if (saved.activePath) setActivePath(saved.activePath);
    if (saved.tabs) {
      setTabs(saved.tabs);
      const initialSaved: Record<string, string> = {};
      saved.tabs.forEach((t: FileTab) => {
        if (typeof t.content === "string") initialSaved[t.path] = t.content;
      });
      setSavedContent(initialSaved);
      setLiveContent(initialSaved);
    }
  }, []);

  // Save workspace state on changes
  useEffect(() => {
    saveWorkspaceState({
      activePath,
      tabs,
      rootPath: workspaceRoot?.path || null,
    });
  }, [activePath, tabs, workspaceRoot]);

  // Warn before closing with unsaved changes
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (tab.dirtyCount > 0) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [tab.dirtyCount]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const meta = e.ctrlKey || e.metaKey;
      if (!meta) return;
      if (e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setPaletteOpen(true);
      } else if (e.key.toLowerCase() === "w" && activePath) {
        e.preventDefault();
        tab.closeTab(activePath);
      } else if (e.key === "`") {
        e.preventDefault();
        setTerminalOpen((v) => !v);
      } else if (e.key.toLowerCase() === "b") {
        e.preventDefault();
        setSidebarCollapsed((v) => !v);
      } else if (e.key === "Tab") {
        e.preventDefault();
        tab.cycleTab(e.shiftKey ? -1 : 1);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activePath, tabs]);

  function requestQuit() {
    if (tab.dirtyCount > 0) {
      const proceed = confirm(
        `You have ${tab.dirtyCount} unsaved file${tab.dirtyCount > 1 ? "s" : ""}. Quit anyway?`,
      );
      if (!proceed) return;
    }
    Quit();
  }

  const startResize = () => {
    setDragging(true);
    const onMove = (e: MouseEvent) => {
      const newWidth = e.clientX - 48;
      if (newWidth >= 160 && newWidth <= 500) setSidebarWidth(newWidth);
    };
    const onUp = () => {
      setDragging(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <div className='w-full h-screen flex flex-col bg-app-surface overflow-hidden select-none'>
      <Header
        recent={tab.activeFile?.name || workspaceRoot?.name || ""}
        hasUnsavedChanges={tab.activeFile ? tab.isDirty(tab.activeFile.path) : false}
        onRequestQuit={requestQuit}
        terminalOpen={terminalOpen}
        setTerminalOpen={setTerminalOpen}
        sidebarCollapsed={sidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
        saveActiveFile={() => saveActiveFile(tab.activeFile)}
        activePath={activePath}
        closeTab={tab.closeTab}
        setActiveTab={setActiveTab}
        closeAllTabs={tab.closeAllTabs}
        setActivePath={setActivePath}
        tabs={tabs}
        paletteOpen={paletteOpen}
        setPaletteOpen={setPaletteOpen}
      />

      <div className='flex-1 w-full flex min-h-0'>
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          sidebarWidth={sidebarWidth}
          sidebarCollapsed={sidebarCollapsed}
          setSidebarCollapsed={setSidebarCollapsed}
          dragging={dragging}
          startResize={startResize}
          activeFile={tab.activeFile}
          workspaceRoot={workspaceRoot}
          setWorkspaceRoot={setWorkspaceRoot}
          openFile={openFile}
          openPathByString={openPathByString}
          fontSize={fontSize}
          setFontSize={setFontSize}
        />

        <EditorArea
          tabs={tabs}
          activePath={activePath}
          setActivePath={setActivePath}
          language={language}
          fontSize={fontSize}
          cursor={cursor}
          setCursor={setCursor}
          activeFile={tab.activeFile}
          terminalOpen={terminalOpen}
          setTerminalOpen={setTerminalOpen}
          contextMenu={tab.contextMenu}
          setContextMenu={tab.setContextMenu}
          draggedTabPath={tab.draggedTabPath}
          dropTargetPath={tab.dropTargetPath}
          isDirty={tab.isDirty}
          closeTab={tab.closeTab}
          closeOthers={tab.closeOthers}
          closeTabsToRight={tab.closeTabsToRight}
          closeAllTabs={tab.closeAllTabs}
          handleContextMenu={tab.handleContextMenu}
          handleTabDragStart={tab.handleTabDragStart}
          handleTabDragOver={tab.handleTabDragOver}
          handleTabDrop={tab.handleTabDrop}
          handleTabDragEnd={tab.handleTabDragEnd}
          copyTabPath={tab.copyTabPath}
          revealTabInExplorer={tab.revealTabInExplorer}
          onEditorReady={(path, editor) => {
            editorRefs.current[path] = editor;
          }}
          onChange={(path, content) => {
            setLiveContent((prev) => ({ ...prev, [path]: content }));
          }}
          onSave={(path, content) => saveByPath(path, content)}
          onOpenFolder={() => {
            setSidebarCollapsed(false);
            setActiveTab("explorer");
            window.dispatchEvent(new CustomEvent("mervcode:open-folder"));
          }}
        />
      </div>

      <StatusBar
        fileType={tab.activeFile ? detectLang(tab.activeFile.name) : "txt"}
        line={cursor.line}
        column={cursor.column}
        unsavedCount={tab.dirtyCount}
      />
    </div>
  );
}
