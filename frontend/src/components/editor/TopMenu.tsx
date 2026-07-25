import { useState, useRef, useEffect } from "react";

interface TopMenuProps {
  onOpenSettingsTab: () => void;
  saveActiveFile: () => Promise<void>;
  toggleTheme: () => void;
  terminalOpen: boolean;
  setTerminalOpen: (v: boolean) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
  setPaletteOpen: (v: boolean) => void;
  closeAllTabs: () => void;
  activePath: string | null;
  closeTab: (path: string) => void;
}

interface MenuItem {
  label: string;
  shortcut?: string;
  run: () => void;
}

interface MenuSection {
  items: MenuItem[];
}

export default function TopMenu({
  onOpenSettingsTab,
  saveActiveFile,
  toggleTheme,
  terminalOpen,
  setTerminalOpen,
  sidebarCollapsed,
  setSidebarCollapsed,
  setPaletteOpen,
  closeAllTabs,
  activePath,
  closeTab,
}: TopMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const sections: MenuSection[] = [
    {
      items: [
        {
          label: "Open Folder",
          run: () => {
            setOpen(false);
            window.dispatchEvent(new CustomEvent("mervcode:open-folder"));
          },
        },
        {
          label: "Save",
          shortcut: "Ctrl+S",
          run: () => {
            setOpen(false);
            void saveActiveFile();
          },
        },
        {
          label: "Close Tab",
          shortcut: "Ctrl+W",
          run: () => {
            setOpen(false);
            if (activePath) closeTab(activePath);
          },
        },
        {
          label: "Close All Tabs",
          run: () => {
            setOpen(false);
            closeAllTabs();
          },
        },
      ],
    },
    {
      items: [
        {
          label: sidebarCollapsed ? "Show Sidebar" : "Hide Sidebar",
          shortcut: "Ctrl+B",
          run: () => {
            setOpen(false);
            setSidebarCollapsed((v) => !v);
          },
        },
        {
          label: terminalOpen ? "Close Terminal" : "Open Terminal",
          shortcut: "Ctrl+`",
          run: () => {
            setOpen(false);
            setTerminalOpen((v) => !v);
          },
        },
        {
          label: "Command Palette",
          shortcut: "Ctrl+Shift+P",
          run: () => {
            setOpen(false);
            setPaletteOpen(true);
          },
        },
      ],
    },
    {
      items: [
        {
          label: "Settings",
          shortcut: "Ctrl+,",
          run: () => {
            setOpen(false);
            onOpenSettingsTab();
          },
        },
        {
          label: "Toggle Theme",
          run: () => {
            setOpen(false);
            toggleTheme();
          },
        },
      ],
    },
    {
      items: [
        {
          label: "Quit",
          run: () => {
            setOpen(false);
            window.dispatchEvent(new CustomEvent("mervcode:quit"));
          },
        },
      ],
    },
  ];

  return (
    <div ref={ref} className='relative no-drag w-12 flex items-center justify-center shrink-0'>
      <button
        onClick={() => setOpen((v) => !v)}
        className='w-9 h-9 flex items-center justify-center text-tertiary hover:text-primary hover:bg-hover transition-colors rounded'
        title='Menu'
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M3 4h10M3 8h10M3 12h10" />
        </svg>
      </button>

      {open && (
        <div className='absolute top-full left-1 mt-0.5 w-52 py-1 rounded-lg border border-subtle-strong bg-surface shadow-app z-50'>
          {sections.map((section, si) => (
            <div key={si}>
              {si > 0 && <div className='mx-2 my-1 h-px bg-white/8' />}
              {section.items.map((item) => (
                <button
                  key={item.label}
                  onClick={item.run}
                  className='flex w-full items-center justify-between px-3 py-1.5 text-left text-[12.5px] text-secondary hover:text-primary hover:bg-hover transition-colors'
                >
                  <span>{item.label}</span>
                  {item.shortcut && (
                    <kbd className='rounded border border-subtle-strong px-1.5 py-0.5 text-[10px] text-tertiary'>
                      {item.shortcut}
                    </kbd>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
