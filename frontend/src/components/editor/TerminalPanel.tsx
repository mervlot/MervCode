import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { Unicode11Addon } from "@xterm/addon-unicode11";
import { ClipboardAddon } from "@xterm/addon-clipboard";
import { WebglAddon } from "@xterm/addon-webgl";
import "@xterm/xterm/css/xterm.css";
import {
  CreateTerminal,
  WriteTerminal,
  KillTerminal,
  ResizeTerminal,
  ListAvailableShells,
} from "../../../wailsjs/go/main/App";
import { EventsOn, EventsOff } from "../../../wailsjs/runtime/runtime";
import type { EditorSettings } from "../../types";

interface TerminalTab {
  id: string;
  label: string;
  shell: string;
}

interface TerminalPanelProps {
  onClose: () => void;
  workingDir?: string;
  settings: EditorSettings;
}

let terminalCounter = 0;

export default function TerminalPanel({ onClose, workingDir, settings }: TerminalPanelProps) {
  const [termTabs, setTermTabs] = useState<TerminalTab[]>([]);
  const [activeTermId, setActiveTermId] = useState<string | null>(null);
  const [activePanelTab, setActivePanelTab] = useState("TERMINAL");
  const [shellDropdownOpen, setShellDropdownOpen] = useState(false);
  const [availableShells, setAvailableShells] = useState<string[]>([]);
  const containersRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const panelRef = useRef<HTMLDivElement>(null);
  const termInstances = useRef<Map<string, Terminal>>(new Map());
  const fitAddons = useRef<Map<string, FitAddon>>(new Map());
  const initialized = useRef(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ListAvailableShells().then(setAvailableShells).catch(() => {});
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShellDropdownOpen(false);
      }
    }
    if (shellDropdownOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [shellDropdownOpen]);

  const createNewTerminal = useCallback((shellOverride?: string) => {
    const id = `term-${++terminalCounter}`;
    const shell = shellOverride ?? settings.defaultShell;
    const name = shell ? shell.split(/[/\\]/).pop() || "shell" : "shell";
    const label = shellOverride
      ? name
      : settings.defaultShell
        ? name
        : "pwsh";

    setTermTabs((prev) => [...prev, { id, label, shell }]);
    setActiveTermId(id);
    setActivePanelTab("TERMINAL");

    requestAnimationFrame(() => {
      const el = containersRef.current.get(id);
      if (!el) return;

      const term = new Terminal({
        theme: {
          background: "#000000",
          foreground: "#d4d4d4",
          cursor: "#DC143C",
          cursorAccent: "#000000",
          selectionBackground: "#DC143C44",
          selectionForeground: "#ffffff",
          black: "#000000",
          red: "#DC143C",
          green: "#4EC9B0",
          yellow: "#DCDCAA",
          blue: "#569CD6",
          magenta: "#C586C0",
          cyan: "#9CDCFE",
          white: "#d4d4d4",
        },
        fontFamily: "'Monaspace Argon', 'Cascadia Code', 'Fira Code', monospace",
        fontSize: 13,
        lineHeight: 1.3,
        cursorBlink: true,
        cursorStyle: "block",
        scrollback: 5000,
        convertEol: true,
        allowProposedApi: true,
        macOptionIsMeta: true,
        windowsMode: navigator.platform.includes("Win"),
      });

      const fitAddon = new FitAddon();
      const webLinksAddon = new WebLinksAddon();
      const unicode11 = new Unicode11Addon();
      const clipboardAddon = new ClipboardAddon();
      const webglAddon = new WebglAddon();

      term.loadAddon(fitAddon);
      term.loadAddon(webLinksAddon);
      term.loadAddon(unicode11);
      term.loadAddon(clipboardAddon);
      term.loadAddon(webglAddon);
      term.unicode.activeVersion = "11";

      webglAddon.onContextLoss(() => {
        webglAddon.dispose();
      });

      term.open(el);
      fitAddon.fit();

      termInstances.current.set(id, term);
      fitAddons.current.set(id, fitAddon);

      CreateTerminal(id, workingDir || "", shell)
        .then(() => {
          term.onData((data) => {
            WriteTerminal(id, data);
          });

          term.onResize(({ cols, rows }) => {
            ResizeTerminal(id, cols, rows);
          });
        })
        .catch((err) => {
          term.write(`\r\n\x1b[31mFailed to start shell: ${err}\x1b[0m\r\n`);
        });

      EventsOn(`terminal:output:${id}`, (data: string) => {
        term.write(data);
      });

      EventsOn(`terminal:exit:${id}`, () => {
        term.write("\r\n\x1b[90m[Process exited]\x1b[0m\r\n");
      });

      term.focus();
    });
  }, [workingDir, settings.defaultShell]);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      createNewTerminal();
    }
  }, [createNewTerminal]);

  useEffect(() => {
    if (activeTermId) {
      const el = containersRef.current.get(activeTermId);
      if (!el) return;
      const observer = new ResizeObserver(() => {
        const fit = fitAddons.current.get(activeTermId);
        fit?.fit();
      });
      observer.observe(el);
      return () => observer.disconnect();
    }
  }, [activeTermId]);

  useEffect(() => {
    if (activeTermId) {
      const term = termInstances.current.get(activeTermId);
      term?.focus();
      const fit = fitAddons.current.get(activeTermId);
      requestAnimationFrame(() => fit?.fit());
    }
  }, [activeTermId]);

  const closeTerminal = useCallback((id: string) => {
    KillTerminal(id);
    EventsOff(`terminal:output:${id}`);
    EventsOff(`terminal:exit:${id}`);

    const term = termInstances.current.get(id);
    term?.dispose();
    termInstances.current.delete(id);
    fitAddons.current.delete(id);

    setTermTabs((prev) => {
      const next = prev.filter((t) => t.id !== id);
      if (activeTermId === id && next.length > 0) {
        setActiveTermId(next[next.length - 1].id);
      } else if (next.length === 0) {
        setActiveTermId(null);
      }
      return next;
    });
  }, [activeTermId]);

  useEffect(() => {
    return () => {
      termInstances.current.forEach((term, id) => {
        KillTerminal(id);
        EventsOff(`terminal:output:${id}`);
        EventsOff(`terminal:exit:${id}`);
        term.dispose();
      });
      termInstances.current.clear();
      fitAddons.current.clear();
    };
  }, []);

  function switchTermTab(dir: 1 | -1) {
    if (termTabs.length < 2) return;
    const idx = termTabs.findIndex((t) => t.id === activeTermId);
    const next = (idx + dir + termTabs.length) % termTabs.length;
    setActiveTermId(termTabs[next].id);
  }

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        switchTermTab(e.shiftKey ? -1 : 1);
        return;
      }
      if (e.ctrlKey && e.key === "w") {
        if (activeTermId) {
          e.preventDefault();
          e.stopPropagation();
          closeTerminal(activeTermId);
        }
        return;
      }
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "c") {
        const term = activeTermId ? termInstances.current.get(activeTermId) : undefined;
        if (term?.hasSelection()) {
          e.preventDefault();
          navigator.clipboard.writeText(term.getSelection());
        }
        return;
      }
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "v") {
        e.preventDefault();
        navigator.clipboard.readText().then((text) => {
          const term = activeTermId ? termInstances.current.get(activeTermId) : undefined;
          if (term && text) {
            term.paste(text);
          }
        }).catch(() => {});
        return;
      }
    }

    el.addEventListener("keydown", onKeyDown);
    return () => el.removeEventListener("keydown", onKeyDown);
  }, [activeTermId, termTabs, closeTerminal]);

  function handleShellPick(shell: string) {
    setShellDropdownOpen(false);
    createNewTerminal(shell);
  }

  const PANEL_TABS = ["PROBLEMS", "OUTPUT", "TERMINAL", "DEBUG CONSOLE"];

  return (
    <motion.div
      ref={panelRef}
      tabIndex={-1}
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 220, opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.15, ease: "easeInOut" }}
      className='w-full bg-[#000000] border-t border-subtle-strong flex flex-col overflow-hidden shrink-0 outline-none'
    >
      <div className='h-8 flex items-center justify-between px-2 border-b border-subtle shrink-0 bg-panel-alt'>
        <div className='flex items-center gap-0'>
          {PANEL_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActivePanelTab(tab)}
              className={`px-3 h-8 text-[10.5px] tracking-wide border-b-2 transition-colors ${
                tab === activePanelTab
                  ? "border-accent text-secondary"
                  : "border-transparent text-faint hover:text-tertiary"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className='flex items-center gap-1'>
          {activePanelTab === "TERMINAL" && (
            <div className='flex items-center gap-0 mr-2'>
              {termTabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTermId(t.id)}
                  className={`group flex items-center gap-1 px-2 py-0.5 rounded text-[10px] transition-colors ${
                    t.id === activeTermId
                      ? "bg-white/10 text-secondary"
                      : "text-faint hover:text-tertiary hover:bg-white/5"
                  }`}
                >
                  <i className='bi bi-terminal text-[9px]' />
                  {t.label}
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTerminal(t.id);
                    }}
                    className='opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity ml-0.5'
                  >
                    ×
                  </span>
                </button>
              ))}

              <div className='flex items-center border-l border-white/10 ml-1 pl-1 gap-0'>
                <button
                  onClick={() => createNewTerminal()}
                  className='w-5 h-5 flex items-center justify-center text-faint hover:text-secondary hover:bg-white/5 rounded transition-colors'
                  title='New Terminal'
                >
                  <i className='bi bi-plus text-[12px]' />
                </button>
                <div ref={dropdownRef} className='relative'>
                  <button
                    onClick={() => setShellDropdownOpen((v) => !v)}
                    className='w-4 h-5 flex items-center justify-center text-faint hover:text-secondary hover:bg-white/5 rounded transition-colors'
                    title='New Terminal With Shell...'
                  >
                    <i className='bi bi-chevron-down text-[9px]' />
                  </button>

                  {shellDropdownOpen && (
                    <div className='absolute top-full right-0 mt-1 w-44 py-1 rounded-lg border border-white/12 bg-[#141414] shadow-app z-50'>
                      <button
                        onClick={() => handleShellPick("")}
                        className='flex w-full items-center gap-2 px-3 py-1.5 text-[12px] text-secondary hover:text-primary hover:bg-white/5 transition-colors'
                      >
                        <i className='bi bi-terminal text-[10px]' />
                        Auto-detect
                      </button>
                      <div className='mx-2 my-1 h-px bg-white/8' />
                      {availableShells.map((shell) => (
                        <button
                          key={shell}
                          onClick={() => handleShellPick(shell)}
                          className='flex w-full items-center gap-2 px-3 py-1.5 text-[12px] text-secondary hover:text-primary hover:bg-white/5 transition-colors'
                        >
                          <i className='bi bi-cpu text-[10px]' />
                          {shell}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <button
            onClick={onClose}
            className='w-6 h-6 flex items-center justify-center hover:text-secondary rounded transition-colors text-faint'
          >
            <i className='bi bi-x text-[12px]' />
          </button>
        </div>
      </div>

      <div className='flex-1 min-h-0 relative' onClick={() => {
        const term = activeTermId ? termInstances.current.get(activeTermId) : undefined;
        term?.focus();
      }}>
        {activePanelTab === "TERMINAL" ? (
          termTabs.map((t) => (
            <div
              key={t.id}
              ref={(el) => {
                if (el) containersRef.current.set(t.id, el);
                else containersRef.current.delete(t.id);
              }}
              className={`absolute inset-0 ${t.id === activeTermId ? "" : "hidden"}`}
            />
          ))
        ) : (
          <div className='h-full flex items-center justify-center text-faint text-[11px]'>
            No output
          </div>
        )}
      </div>
    </motion.div>
  );
}
