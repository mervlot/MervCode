import { useEffect, useState } from "react";
import { AnimatePresence } from "motion/react";
import ToolBar from "./ToolBar";
import TabBar from "./TabBar";
import TabContextMenu from "./TabContextMenu";
import FileViewer from "./FileViewer";
import EmptyState from "./EmptyState";
import TerminalPanel from "./TerminalPanel";
import ErrorBoundary from "./ErrorBoundary";
import ToolchainPrompt from "./ToolchainPrompt";
import { CheckLanguageTools } from "../../../wailsjs/go/main/App";
import type { EditorSettings, FileTab } from "../../types";
import type { ContextMenuState } from "../../hooks/useTabManager";

interface EditorAreaProps {
  tabs: FileTab[];
  activePath: string | null;
  setActivePath: React.Dispatch<React.SetStateAction<string | null>>;
  language: string;
  settings: EditorSettings;
  cursor: { line: number; column: number };
  setCursor: React.Dispatch<React.SetStateAction<{ line: number; column: number }>>;
  activeFile: FileTab | undefined;
  terminalOpen: boolean;
  setTerminalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  contextMenu: ContextMenuState;
  setContextMenu: React.Dispatch<React.SetStateAction<ContextMenuState>>;
  draggedTabPath: string | null;
  dropTargetPath: string | null;
  isDirty: (path: string) => boolean;
  closeTab: (path: string) => void;
  closeOthers: (path: string) => void;
  closeTabsToRight: (path: string) => void;
  closeAllTabs: () => void;
  handleContextMenu: (event: React.MouseEvent<HTMLDivElement>, path: string) => void;
  handleTabDragStart: (event: React.DragEvent<HTMLDivElement>, path: string) => void;
  handleTabDragOver: (event: React.DragEvent<HTMLDivElement>, targetPath: string) => void;
  handleTabDrop: (event: React.DragEvent<HTMLDivElement>, targetPath: string) => void;
  handleTabDragEnd: () => void;
  copyTabPath: (path: string) => void;
  revealTabInExplorer: (path: string) => void;
  onEditorReady: (path: string, editor: any) => void;
  onChange: (path: string, content: string) => void;
  onSave: (path: string, content: string) => void | Promise<void>;
  onOpenFolder: () => void;
}

export default function EditorArea({
  tabs,
  activePath,
  setActivePath,
  language,
  settings,
  cursor,
  setCursor,
  activeFile,
  terminalOpen,
  setTerminalOpen,
  contextMenu,
  setContextMenu,
  draggedTabPath,
  dropTargetPath,
  isDirty,
  closeTab,
  closeOthers,
  closeTabsToRight,
  closeAllTabs,
  handleContextMenu,
  handleTabDragStart,
  handleTabDragOver,
  handleTabDrop,
  handleTabDragEnd,
  copyTabPath,
  revealTabInExplorer,
  onEditorReady,
  onChange,
  onSave,
  onOpenFolder,
}: EditorAreaProps) {
  const [toolchainLang, setToolchainLang] = useState<string | null>(null);

  useEffect(() => {
    if (!language || language === "plaintext") return;

    CheckLanguageTools(language)
      .then((status) => {
        const needsPrompt =
          !status.languageInstalled ||
          (!status.toolsInstalled && (status.missingTools?.length ?? 0) > 0);
        if (needsPrompt) {
          setToolchainLang(language);
        }
      })
      .catch(() => undefined);
  }, [language, activePath]);

  return (
    <main className='flex-1 h-full min-w-0 flex flex-col bg-canvas relative'>
      {toolchainLang && (
        <ToolchainPrompt
          language={toolchainLang}
          onResolved={() => setToolchainLang(null)}
          onDismiss={() => setToolchainLang(null)}
        />
      )}
      <ToolBar activeFile={activeFile} />

      {tabs.length > 0 && (
        <TabBar
          tabs={tabs}
          activePath={activePath}
          draggedTabPath={draggedTabPath}
          dropTargetPath={dropTargetPath}
          isDirty={isDirty}
          onTabClick={setActivePath}
          onTabClose={closeTab}
          onContextMenu={handleContextMenu}
          onDragStart={handleTabDragStart}
          onDragOver={handleTabDragOver}
          onDrop={handleTabDrop}
          onDragEnd={handleTabDragEnd}
        />
      )}

      {contextMenu && (
        <TabContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onCloseTab={() => closeTab(contextMenu.path)}
          onCloseOthers={() => closeOthers(contextMenu.path)}
          onCloseToRight={() => closeTabsToRight(contextMenu.path)}
          onCloseAll={closeAllTabs}
          onRevealInExplorer={() => revealTabInExplorer(contextMenu.path)}
          onCopyPath={() => copyTabPath(contextMenu.path)}
        />
      )}

      <div className='flex-1 min-h-0 flex flex-col'>
        <div className='flex-1 min-h-0 relative'>
          {tabs.length === 0 ? (
            <EmptyState onOpenFolder={onOpenFolder} />
          ) : (
            tabs.map((t) => (
              <div
                key={t.path}
                className={`h-full ${t.path === activePath ? "block" : "hidden"}`}
              >
                <FileViewer
                  tab={t}
                  language={language}
                  settings={settings}
                  onCursorChange={setCursor}
                  onEditorReady={onEditorReady}
                  onChange={onChange}
                  onSave={onSave}
                />
              </div>
            ))
          )}
        </div>

        <AnimatePresence>
          {terminalOpen && (
            <ErrorBoundary label='Terminal'>
              <TerminalPanel onClose={() => setTerminalOpen(false)} />
            </ErrorBoundary>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
