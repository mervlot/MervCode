import { useEffect, useRef, useState, useCallback } from "react";

import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { Unicode11Addon } from "@xterm/addon-unicode11";
import { Plus, X, SquareTerminal } from "lucide-react";

// @ts-ignore: Load xterm styles as a side effect.
import "@xterm/xterm/css/xterm.css";

import {
  StartTerminal,
  TerminalInput,
  ResizeTerminal,
  StopTerminal,
} from "../../../wailsjs/go/main/App";
import { EventsOn } from "../../../wailsjs/runtime/runtime";

interface TerminalPanelProps {
  visible: boolean;
  /** Current "Default Shell" setting value (e.g. "cmd", "pwsh", ""). */
  defaultShell: string;
}

interface Shell {
  command: string;
  label: string;
}

// Windows-only for now (ConPTY). Linux/macOS support comes later.
// A shell is resolved once, at the moment a terminal tab is created, from
// whatever the "Default Shell" setting currently is. It never changes for
// that tab afterward — changing the setting only affects tabs created
// after the change.
function resolveShell(setting: string): Shell {
  switch (setting) {
    case "cmd":
      return {
        command: "cmd.exe",
        label: "Command Prompt",
      };

    case "powershell":
      return {
        command: "powershell.exe -NoLogo",
        label: "Windows PowerShell",
      };

    default:
      return {
        command: "powershell.exe -NoLogo",
        label: "Windows PowerShell",
      };
  }
}
const XTERM_THEME = {
  background: "#000000",
  foreground: "#e4e4e7",
  cursor: "#fafafa",
  cursorAccent: "#09090b",
  selectionBackground: "#3f3f46",
  black: "#18181b",
  brightBlack: "#71717a",
  red: "#f87171",
  brightRed: "#fca5a5",
  green: "#4ade80",
  brightGreen: "#86efac",
  yellow: "#facc15",
  brightYellow: "#fde047",
  blue: "#60a5fa",
  brightBlue: "#93c5fd",
  magenta: "#c084fc",
  brightMagenta: "#d8b4fe",
  cyan: "#22d3ee",
  brightCyan: "#67e8f9",
  white: "#d4d4d8",
  brightWhite: "#fafafa",
};

let termCounter = 0;

interface TabInfo {
  id: string;
  label: string;
}

export default function TerminalPanel({
  visible,
  defaultShell,
}: TerminalPanelProps) {
  const [tabs, setTabs] = useState<TabInfo[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [height, setHeight] = useState(260);

  const containers = useRef(new Map<string, HTMLDivElement>());
  const terms = useRef(new Map<string, Terminal>());
  const fits = useRef(new Map<string, FitAddon>());
  const shellById = useRef(new Map<string, string>());
  const cleanupById = useRef(new Map<string, () => void>());

  const isDragging = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(260);

  const initTerminal = useCallback((id: string, el: HTMLDivElement) => {
    const term = new Terminal({
      allowProposedApi: true,
      cursorBlink: true,
      cursorStyle: "bar",
      cursorWidth: 2,
      fontFamily: '"Cascadia Code", "JetBrains Mono", Consolas, monospace',
      fontSize: 13,
      lineHeight: 1.3,
      scrollback: 5000,
      smoothScrollDuration: 100,
      theme: XTERM_THEME,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());
    const unicode11 = new Unicode11Addon();
    term.loadAddon(unicode11);
    term.unicode.activeVersion = "11";

    term.open(el);
    terms.current.set(id, term);
    fits.current.set(id, fitAddon);

    const offOutput = EventsOn(`terminal:output:${id}`, (data: unknown) => {
      term.write(String(data));
    });
    const offExit = EventsOn(`terminal:exit:${id}`, () => {
      term.writeln("\r\n\x1b[90m[process exited]\x1b[0m");
    });
    const inputDisposable = term.onData((data) => {
      void TerminalInput(id, data).catch(console.error);
    });

    cleanupById.current.set(id, () => {
      offOutput();
      offExit();
      inputDisposable.dispose();
    });

    const shellCommand = shellById.current.get(id) ?? "";
    void StartTerminal(id, shellCommand)
      .then(() => {
        requestAnimationFrame(() => {
          fitAddon.fit();
          void ResizeTerminal(id, term.cols, term.rows).catch(console.error);
          term.focus();
        });
      })
      .catch((err) => {
        term.writeln(
          `\r\n\x1b[31mFailed to start terminal: ${String(err)}\x1b[0m`,
        );
      });
  }, []);

  const containerRefFor = useCallback(
    (id: string) => (el: HTMLDivElement | null) => {
      if (!el || containers.current.has(id)) return;
      containers.current.set(id, el);
      initTerminal(id, el);
    },
    [initTerminal],
  );

  const addTab = useCallback(() => {
    const shell = resolveShell(defaultShell);
    const id = `term-${++termCounter}`;
    shellById.current.set(id, shell.command);
    setTabs((prev) => [...prev, { id, label: shell.label }]);
    setActiveId(id);
  }, [defaultShell]);

  const closeTab = useCallback((id: string) => {
    void StopTerminal(id).catch(console.error);
    cleanupById.current.get(id)?.();
    cleanupById.current.delete(id);
    terms.current.get(id)?.dispose();
    terms.current.delete(id);
    fits.current.delete(id);
    containers.current.delete(id);
    shellById.current.delete(id);

    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== id);
      setActiveId((current) => {
        if (current !== id) return current;
        const last = next[next.length - 1];
        return last ? last.id : null;
      });
      return next;
    });
  }, []);

  // First terminal, created once.
  useEffect(() => {
    addTab();
    return () => {
      cleanupById.current.forEach((fn) => fn());
      terms.current.forEach((t) => t.dispose());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the active terminal fitted to its container.
  useEffect(() => {
    if (!activeId) return;
    const el = containers.current.get(activeId);
    const fit = fits.current.get(activeId);
    if (!el || !fit) return;

    const resize = () => {
      fit.fit();
      const term = terms.current.get(activeId);
      if (term)
        void ResizeTerminal(activeId, term.cols, term.rows).catch(
          console.error,
        );
    };

    const ro = new ResizeObserver(resize);
    ro.observe(el);
    terms.current.get(activeId)?.focus();

    return () => ro.disconnect();
  }, [activeId]);

  // Re-fit once the show/hide animation settles.
  useEffect(() => {
    if (!visible || !activeId) return;
    const t = setTimeout(() => {
      fits.current.get(activeId)?.fit();
      const term = terms.current.get(activeId);
      if (term)
        void ResizeTerminal(activeId, term.cols, term.rows).catch(
          console.error,
        );
    }, 160);
    return () => clearTimeout(t);
  }, [visible, activeId]);

  const handleDragStart = (e: React.MouseEvent) => {
    isDragging.current = true;
    startY.current = e.clientY;
    startHeight.current = height;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "ns-resize";

    const onMove = (moveEvent: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = startY.current - moveEvent.clientY;
      setHeight(Math.max(120, Math.min(800, startHeight.current + delta)));
    };
    const onUp = () => {
      isDragging.current = false;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <div
      className='w-full bg-canvas border-t border-subtle flex flex-col shrink-0 overflow-hidden'
      style={{
        height: visible ? height : 0,
        transition: isDragging.current ? "none" : "height 150ms ease-in-out",
      }}
    >
      {/* Drag handle */}
      <div
        onMouseDown={handleDragStart}
        className='h-1 w-full shrink-0 cursor-ns-resize hover:bg-blue-500/40'
      />

      {/* Tab bar */}
      <div className='h-8 flex items-center bg-panel border-b border-subtle px-1 gap-0.5 shrink-0'>
        <div className='flex items-center gap-0.5 flex-1 min-w-0 overflow-x-auto'>
          {tabs.map((tab) => (
            <div
              key={tab.id}
              onClick={() => setActiveId(tab.id)}
              className={`group flex items-center gap-1.5 h-6 pl-2 pr-1 rounded text-xs cursor-pointer shrink-0 select-none ${
                tab.id === activeId
                  ? "bg-hover text-primary"
                  : "text-tertiary hover:bg-hover/60"
              }`}
            >
              <SquareTerminal size={12} className='shrink-0' />
              <span className='whitespace-nowrap'>{tab.label}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                className='opacity-0 group-hover:opacity-100 hover:bg-white/10 rounded p-0.5 shrink-0'
                title='Close terminal'
              >
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={addTab}
          className='w-6 h-6 flex items-center justify-center rounded hover:bg-hover text-tertiary hover:text-primary shrink-0'
          title='New Terminal'
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Terminal viewport(s) */}
      <div className='flex-1 min-h-0 relative'>
        {tabs.map((tab) => (
          <div
            key={tab.id}
            ref={containerRefFor(tab.id)}
            className='absolute inset-0 p-1'
            style={{ display: tab.id === activeId ? "block" : "none" }}
          />
        ))}
        {tabs.length === 0 && (
          <div className='flex h-full items-center justify-center text-xs text-tertiary'>
            No terminal open
          </div>
        )}
      </div>
    </div>
  );
}
