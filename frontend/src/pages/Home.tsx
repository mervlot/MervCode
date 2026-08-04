import { useEffect, useMemo, useRef, useState } from "react";
import * as monaco from "monaco-editor";

// Components
import Header from "../components/editor/Header";
import Sidebar from "../components/editor/Sidebar";
import EditorArea from "../components/editor/EditorArea";
import StatusBar from "../components/editor/StatusBar";
import LspInspector from "../components/editor/LspInspector";

// Hooks
import useTabManager from "../hooks/useTabManager";
import useFileOps from "../hooks/useFileOps";
import { useEditorSettings } from "../hooks/useEditorSettings";

// Utilities
import { Quit } from "../../wailsjs/go/main/App";
import { EventsOn } from "../../wailsjs/runtime/runtime";
import { detectLang } from "../editor/detectLang.js";
import { loadWorkspaceState, saveWorkspaceState } from "../lib/persistence.js";
import type { FileTab, WorkspaceRoot } from "../types";

// Elements where the user is actively typing plain text (rename dialogs,
// the search box, settings fields, the terminal's hidden textarea, ...).
// Native text editing there (e.g. Ctrl+Backspace to delete a word) should
// never be hijacked by a MervCode shortcut that happens to reuse the same
// combination.
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

function isInsideMonacoEditor(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && target.closest(".monaco-editor") !== null;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState("explorer");
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(true);
  // Seeded synchronously from localStorage (not left null until
  // ExplorerPanel's async ReadDir/loadRoot round-trip resolves) so that
  // tabs restored on this same mount never open their LSP connection
  // before the real workspace root is known. ExplorerPanel reads the same
  // persisted rootPath independently to populate its own file tree and
  // will call setWorkspaceRoot again once that completes, confirming/
  // refreshing this value - it never regresses it to null.
  const [workspaceRoot, setWorkspaceRoot] = useState<WorkspaceRoot | null>(
    () => {
      const saved = loadWorkspaceState();
      if (!saved.rootPath) return null;
      const name = saved.rootPath.split(/[\\/]/).pop() || saved.rootPath;
      return { path: saved.rootPath, name };
    },
  );
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [devToolsOpen, setDevToolsOpen] = useState(false);
  const { settings, updateSettings, resetSettings } = useEditorSettings();

  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const [tabs, setTabs] = useState<FileTab[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [savedContent, setSavedContent] = useState<Record<string, string>>({});
  const [liveContent, setLiveContent] = useState<Record<string, string>>({});
  const editorRefs = useRef<
    Record<string, monaco.editor.IStandaloneCodeEditor>
  >({});

  const tab = useTabManager({
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
  });

  const { openFile, openPathByString, saveActiveFile, saveByPath } = useFileOps(
    {
      tabs,
      setTabs,
      activePath,
      setActivePath,
      setSavedContent,
      setLiveContent,
      liveContent,
      editorRefs,
    },
  );

  // Ctrl/Cmd+Click on an import path or file link in the editor (see
  // editor/monaco/linkProvider.ts) dispatches this instead of calling
  // openPathByString directly, so the Monaco layer never needs to know
  // about the tab-management React tree above it.
  useEffect(() => {
    function handleOpenFile(e: Event) {
      const { path, line } = (e as CustomEvent<{ path: string; line?: number }>)
        .detail;
      if (path) openPathByString(path, line);
    }
    window.addEventListener("mervcode:open-file", handleOpenFile);
    return () =>
      window.removeEventListener("mervcode:open-file", handleOpenFile);
  }, [openPathByString]);

  const language = useMemo(() => {
    if (!tab.activeFile) return "plaintext";
    return detectLang(tab.activeFile.name);
  }, [tab.activeFile]);

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

  // Ctrl+MouseWheel zoom (Monaco's `mouseWheelZoom` option) changes a
  // process-wide `EditorZoom` multiplier, not the `fontSize` setting -
  // Monaco applies it on top of whatever fontSize each editor already has.
  // Left alone, the Settings panel's Font Size slider would drift out of
  // sync with what's actually on screen, and the zoom itself is never
  // persisted (reverts on restart). Fold it into the real setting instead:
  // whenever the zoom level changes, read the effective font size Monaco
  // just computed, save it as the new `fontSize`, then reset the zoom
  // level back to neutral so it never double-applies on top of itself.
  const applyingZoomRef = useRef(false);
  useEffect(() => {
    const disposable = monaco.editor.EditorZoom.onDidChangeZoomLevel(() => {
      if (applyingZoomRef.current) return;
      if (monaco.editor.EditorZoom.getZoomLevel() === 0) return;

      const activeEditor = Object.values(editorRefs.current)[0];
      if (!activeEditor) return;

      const fontInfo = activeEditor.getOption(
        monaco.editor.EditorOption.fontInfo,
      );
      const newFontSize = Math.round(fontInfo.fontSize);

      applyingZoomRef.current = true;
      monaco.editor.EditorZoom.setZoomLevel(0);
      applyingZoomRef.current = false;

      updateSettings({ fontSize: newFontSize });
    });
    return () => disposable.dispose();
  }, [updateSettings]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const meta = e.ctrlKey || e.metaKey;
      if (!meta) return;

      // Save must work everywhere, exactly like VS Code's Ctrl+S - even if
      // focus is in the sidebar, the search box, or a rename field, not
      // just while the Monaco editor itself is focused. Route through the
      // active editor's own registered save action when one exists so
      // format-on-save still applies; fall back to a plain save otherwise
      // (e.g. a non-editor tab, or no editor instance mounted yet).
      if (!e.shiftKey && !e.altKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        const activeEditor = activePath ? editorRefs.current[activePath] : undefined;
        const saveAction = activeEditor?.getAction("merv-save-file");
        if (saveAction) {
          void saveAction.run();
        } else if (tab.activeFile) {
          void saveActiveFile(tab.activeFile);
        }
        return;
      }

      // Every other MervCode shortcut below repurposes a combination a
      // plain text input would otherwise use for native editing (Ctrl+W,
      // Ctrl+`, Ctrl+B, Ctrl+Tab, ...). Leave those alone while the user is
      // actually typing somewhere other than the code editor itself (a
      // rename dialog, the search box, a settings field, the terminal) so
      // MervCode never steals a keystroke mid-edit.
      if (isTypingTarget(e.target) && !isInsideMonacoEditor(e.target)) return;

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
      } else if (e.shiftKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
        setDevToolsOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activePath, tabs, tab, saveActiveFile, setTerminalOpen]);

  // Listen for backend toolchain events
  useEffect(() => {
    const unsubs: (() => void)[] = [];
    unsubs.push(
      EventsOn("toolchain:languageMissing", (data: any) => {
        console.log("Toolchain: language missing", data);
      }),
    );
    unsubs.push(
      EventsOn("toolchain:toolsMissing", (data: any) => {
        console.log("Toolchain: tools missing", data);
      }),
    );
    unsubs.push(
      EventsOn("toolchain:installProgress", (data: any) => {
        console.log(`Toolchain: ${data.message}`);
      }),
    );
    return () => unsubs.forEach((fn) => fn());
  }, []);

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

  function openSettingsTab() {
    const SETTINGS_PATH = "mervcode://settings";
    if (tabs.some((t) => t.path === SETTINGS_PATH)) {
      setActivePath(SETTINGS_PATH);
    } else {
      const settingsTab: FileTab = {
        name: "Settings",
        path: SETTINGS_PATH,
        isDir: false,
        category: "settings",
      };
      setTabs((prev) => [...prev, settingsTab]);
      setActivePath(SETTINGS_PATH);
    }
  }

  return (
    <div className="w-full h-screen flex flex-col bg-app-surface overflow-hidden select-none">
      {}
      <Header
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
        onOpenSettingsTab={openSettingsTab}
        onToggleDevTools={() => setDevToolsOpen((v) => !v)}
        rootPath={workspaceRoot?.path}
      />
      <LspInspector
        open={devToolsOpen}
        onClose={() => setDevToolsOpen(false)}
      />
      <div className="flex-1 w-full flex min-h-0">
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
          onOpenSettingsTab={openSettingsTab}
        />

        <EditorArea
          tabs={tabs}
          activePath={activePath}
          setActivePath={setActivePath}
          language={language}
          settings={settings}
          onSettingsChange={updateSettings}
          onSettingsReset={resetSettings}
          rootPath={workspaceRoot?.path}
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
