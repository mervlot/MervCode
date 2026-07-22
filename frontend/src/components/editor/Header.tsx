import { useEffect, useMemo, useState } from "react";
import { Quit } from "../../../wailsjs/go/main/App";
import CommandPalette, { type Command } from "./CommandPalette";
import { useTheme } from "../../contexts/ThemeContext";
import type { FileTab } from "../../types";

declare global {
  interface Window {
    runtime?: {
      WindowMinimise?: () => void;
      WindowIsMaximised?: () => Promise<boolean>;
      WindowUnmaximise?: () => void;
      WindowMaximise?: () => void;
    };
  }
}

interface HeaderProps {
  recent: string;
  hasUnsavedChanges?: boolean;
  onRequestQuit?: () => void;
  terminalOpen: boolean;
  setTerminalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  saveActiveFile: () => Promise<void>;
  activePath: string | null;
  closeTab: (path: string) => void;
  setActiveTab: React.Dispatch<React.SetStateAction<string>>;
  closeAllTabs: () => void;
  setActivePath: React.Dispatch<React.SetStateAction<string | null>>;
  tabs: FileTab[];
  paletteOpen: boolean;
  setPaletteOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function Header({
  recent,
  hasUnsavedChanges,
  onRequestQuit,
  terminalOpen,
  setTerminalOpen,
  sidebarCollapsed,
  setSidebarCollapsed,
  saveActiveFile,
  activePath,
  closeTab,
  setActiveTab,
  closeAllTabs,
  setActivePath,
  tabs,
  paletteOpen,
  setPaletteOpen,
}: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    window.runtime?.WindowIsMaximised?.().then((v) => {
      setIsMaximized(!!v);
    });
  }, []);

  const commands: Command[] = useMemo(() => {
    const list: Command[] = [
      {
        id: "toggle-terminal",
        label: terminalOpen ? "Close Terminal" : "Open Terminal",
        category: "View",
        shortcut: "Ctrl `",
        icon: "terminal",
        run: () => setTerminalOpen((v) => !v),
      },
      {
        id: "toggle-sidebar",
        label: sidebarCollapsed ? "Show Sidebar" : "Hide Sidebar",
        category: "View",
        shortcut: "Ctrl B",
        icon: "layout-sidebar",
        run: () => setSidebarCollapsed((v) => !v),
      },
      {
        id: "toggle-theme",
        label: theme === "dark" ? "Switch to Light" : "Switch to Dark",
        category: "Appearance",
        icon: "circle-half",
        run: toggleTheme,
      },
      {
        id: "save-file",
        label: "Save Active File",
        category: "File",
        shortcut: "Ctrl S",
        icon: "floppy",
        run: () => void saveActiveFile(),
      },
      {
        id: "close-tab",
        label: "Close Active Tab",
        category: "File",
        shortcut: "Ctrl W",
        icon: "x-lg",
        run: () => activePath && closeTab(activePath),
      },
      {
        id: "close-all-tabs",
        label: "Close All Tabs",
        category: "File",
        icon: "x-lg",
        run: closeAllTabs,
      },
      {
        id: "go-to-search",
        label: "Search in Workspace",
        category: "Navigate",
        icon: "search",
        run: () => {
          setSidebarCollapsed(false);
          setActiveTab("search");
        },
      },
      {
        id: "go-to-source-control",
        label: "Source Control",
        category: "Navigate",
        icon: "git",
        run: () => {
          setSidebarCollapsed(false);
          setActiveTab("source-control");
        },
      },
      {
        id: "open-settings",
        label: "Settings",
        category: "Navigate",
        icon: "gear",
        run: () => {
          setSidebarCollapsed(false);
          setActiveTab("settings");
        },
      },
      {
        id: "open-folder",
        label: "Open Folder",
        category: "File",
        icon: "folder2-open",
        run: () => {
          setSidebarCollapsed(false);
          setActiveTab("explorer");
          window.dispatchEvent(new CustomEvent("mervcode:open-folder"));
        },
      },
    ];

    tabs.forEach((t: FileTab) => {
      list.push({
        id: `goto-${t.path}`,
        label: t.name,
        category: "Go to File",
        icon: "file-earmark",
        run: () => setActivePath(t.path),
      });
    });

    return list;
  }, [terminalOpen, sidebarCollapsed, theme, tabs, activePath]);

  const minimize = () => window.runtime?.WindowMinimise?.();

  const maximize = async () => {
    const maximized = await window.runtime?.WindowIsMaximised?.();
    if (maximized) {
      window.runtime?.WindowUnmaximise?.();
      setIsMaximized(false);
    } else {
      window.runtime?.WindowMaximise?.();
      setIsMaximized(true);
    }
  };

  const handleClose = () => {
    if (onRequestQuit) onRequestQuit();
    else Quit();
  };

  return (
    <header className='h-9 w-full bg-panel border-b border-subtle flex items-center select-none shrink-0'>
      <div className='draggable flex-1 h-full flex items-center px-3'>
        {recent && (
          <div className='no-drag px-3 h-7 flex items-center gap-1.5 rounded bg-surface border border-subtle text-[12px] text-secondary'>
            {hasUnsavedChanges && (
              <span className='h-1.5 w-1.5 rounded-full bg-accent shrink-0' />
            )}
            <span className='truncate'>{recent}</span>
          </div>
        )}
      </div>
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        commands={commands}
      />
      <div className='no-drag flex items-center h-full pr-1 gap-0.5'>
        <button
          onClick={minimize}
          className='group w-8 h-8 rounded flex items-center justify-center hover:bg-hover transition-colors'
        >
          <svg
            width='10'
            height='10'
            viewBox='0 0 12 12'
            className='stroke-current text-tertiary group-hover:text-primary'
            fill='none'
            strokeWidth='1.5'
            strokeLinecap='round'
          >
            <path d='M2 6H10' />
          </svg>
        </button>
        <button
          onClick={maximize}
          className='group w-8 h-8 rounded flex items-center justify-center hover:bg-hover transition-colors'
        >
          {isMaximized ? (
            <svg
              width='10'
              height='10'
              viewBox='0 0 12 12'
              fill='none'
              stroke='currentColor'
              className='text-tertiary group-hover:text-primary'
              strokeWidth='1.3'
            >
              <rect x='2.5' y='4' width='5.5' height='5.5' />
              <path d='M4 4V2.5H9.5V8H8' />
            </svg>
          ) : (
            <svg
              width='10'
              height='10'
              viewBox='0 0 12 12'
              fill='none'
              stroke='currentColor'
              className='text-tertiary group-hover:text-primary'
              strokeWidth='1.3'
            >
              <rect x='2' y='2' width='8' height='8' />
            </svg>
          )}
        </button>
        <button
          onClick={handleClose}
          className='group w-8 h-8 rounded flex items-center justify-center hover:bg-[#DC143C] transition-colors'
        >
          <svg
            width='10'
            height='10'
            viewBox='0 0 12 12'
            fill='none'
            stroke='currentColor'
            className='text-tertiary group-hover:text-white'
            strokeWidth='1.5'
            strokeLinecap='round'
          >
            <path d='M3 3L9 9M9 3L3 9' />
          </svg>
        </button>
      </div>
    </header>
  );
}
