import LeftBar from "./LeftBar";
import ExplorerPanel from "./ExplorerPanel";
import SearchPanel from "./SearchPanel";
import SourceControlPanel from "./SourceControlPanel";
import SettingsPanel from "./SettingsPanel";
import PlaceholderPanel from "./PlaceHolderPanel";
import ErrorBoundary from "./ErrorBoundary";
import type { EditorSettings, FileTab, WorkspaceRoot } from "../../types";

interface SidebarProps {
  activeTab: string;
  setActiveTab: React.Dispatch<React.SetStateAction<string>>;
  sidebarWidth: number;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  dragging: boolean;
  startResize: () => void;
  activeFile: FileTab | undefined;
  workspaceRoot: WorkspaceRoot | null;
  setWorkspaceRoot: (root: WorkspaceRoot) => void;
  openFile: (file: FileTab, revealLine?: number) => void;
  openPathByString: (path: string, line?: number) => void;
  settings: EditorSettings;
  onSettingsChange: (patch: Partial<EditorSettings>) => void;
}

export default function Sidebar({
  activeTab,
  setActiveTab,
  sidebarWidth,
  sidebarCollapsed,
  setSidebarCollapsed,
  dragging,
  startResize,
  activeFile,
  workspaceRoot,
  setWorkspaceRoot,
  openFile,
  openPathByString,
  settings,
  onSettingsChange,
}: SidebarProps) {
  function handleTabChange(tab: string) {
    if (sidebarCollapsed && tab === activeTab) {
      setSidebarCollapsed(false);
    } else if (tab === activeTab) {
      setSidebarCollapsed((v) => !v);
    } else {
      setActiveTab(tab);
      setSidebarCollapsed(false);
    }
  }

  return (
    <>
      <LeftBar activeTab={activeTab} onTabChange={handleTabChange} />

      {!sidebarCollapsed && (
        <div style={{ width: sidebarWidth }} className='h-full shrink-0 relative'>
          <ErrorBoundary label={`${activeTab} panel`} resetKey={activeTab}>
            {activeTab === "explorer" ? (
              <ExplorerPanel
                activeFile={activeFile ? { ...activeFile, isDir: false } : null}
                onFileOpen={openFile}
                onRootChange={setWorkspaceRoot}
              />
            ) : activeTab === "search" ? (
              <SearchPanel
                rootPath={workspaceRoot?.path ?? null}
                onResultOpen={(path, line) => openPathByString(path, line)}
              />
            ) : activeTab === "source-control" ? (
              <SourceControlPanel
                rootPath={workspaceRoot?.path ?? null}
                onFileOpen={(path) => openPathByString(path)}
              />
            ) : activeTab === "settings" ? (
              <SettingsPanel
                settings={settings}
                onSettingsChange={onSettingsChange}
              />
            ) : (
              <PlaceholderPanel
                activeTab={activeTab}
                onBack={() => setActiveTab("explorer")}
              />
            )}
          </ErrorBoundary>
          <div
            onMouseDown={startResize}
            className={`absolute top-0 right-0 w-1 h-full cursor-col-resize transition-colors ${
              dragging ? "bg-accent/30" : "hover:bg-white/5"
            }`}
          />
        </div>
      )}
    </>
  );
}
