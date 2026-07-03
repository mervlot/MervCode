import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import Editor from "./Editor.js";

import Header from "../components/editor/Header.jsx";
import LeftBar from "../components/editor/LeftBar.jsx";
import ExplorerPanel from "../components/editor/ExplorerPanel.jsx";
import StatusBar from "../components/editor/StatusBar.jsx";

import { detectLang } from "../editor/detectLang.js";
import { buildExtensions } from "../editor/buildExtensions.js";
import { loadWorkspaceState, saveWorkspaceState } from "../lib/persistence.js";

// ── Interfaces ────────────────────────────────────────────────────────────────
interface FileTab {
  name: string;
  path: string;
  content?: string;
}

interface WorkspaceRoot {
  name: string;
  path: string;
}

// ── File-type icon colours (matches Workspace) ───────────────────────────────
const FILE_COLORS = {
  js: "bg-yellow-400",
  ts: "bg-blue-400",
  jsx: "bg-cyan-400",
  tsx: "bg-cyan-400",
  json: "bg-yellow-300",
  md: "bg-white/40",
  html: "bg-orange-400",
  css: "bg-blue-300",
  py: "bg-green-400",
  go: "bg-cyan-300",
  rs: "bg-orange-300",
  php: "bg-purple-300",
  png: "bg-pink-300",
  jpg: "bg-pink-300",
  svg: "bg-yellow-300",
  txt: "bg-white/30",
  exe: "bg-red-400",
} as const;

function FileTabIcon({ name }: { name: string }) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "txt";
  const color = FILE_COLORS[ext as keyof typeof FILE_COLORS] ?? "bg-white/30";
  const label = ext.slice(0, 2).toUpperCase();
  return (
    <span
      className={`w-3.5 h-3.5 rounded-sm ${color} flex items-center justify-center text-[7px] font-bold text-[#0e0e1c] shrink-0`}
    >
      {label}
    </span>
  );
}

// ── Toolbar buttons ───────────────────────────────────────────────────────────
const TOOLBAR_ACTIONS = [{ id: "debug", icon: "bug_report", label: "lay" }];

function Toolbar({ activeFile }: { activeFile?: FileTab | undefined }) {
  const ext = activeFile?.name.split(".").pop()?.toLowerCase() ?? "txt";
  const langLabels: Record<string, string> = {
    js: "JavaScript",
    ts: "TypeScript",
    jsx: "React JSX",
    tsx: "React TSX",
    py: "Python",
    go: "Go",
    rs: "Rust",
    html: "HTML",
    css: "CSS",
    json: "JSON",
    md: "Markdown",
  };
  const lang = langLabels[ext] ?? ext.toUpperCase();

  return (
    <div className='h-10 w-full bg-[#16162a] border-b border-white/5 flex items-center justify-between px-3 shrink-0 gap-2'>
      {/* Left — breadcrumb */}
      <div className='flex items-center gap-1.5 text-[11px] text-white/35 min-w-0'>
        {activeFile && (
          <>
            <span className='material-symbols-rounded text-[13px] text-purple-400/60'>
              folder
            </span>
            <span className='text-white/25'>›</span>
            <FileTabIcon name={activeFile.name} />
            <span className='text-white/55 truncate'>{activeFile.name}</span>
            <span className='text-white/25'>…</span>
          </>
        )}
      </div>

      {/* Center — action buttons */}
      <div className='flex items-center gap-1'>
        {TOOLBAR_ACTIONS.map((action) => (
          <button
            key={action.id}
            className='flex items-center gap-1.5 px-2.5 h-7 rounded-md text-[11px] text-white/50 hover:text-white/85 hover:bg-white/6 transition-all border border-transparent hover:border-white/8'
          >
            <span className='material-symbols-rounded text-[13px]'>
              {action.icon}
            </span>
            {action.label}
          </button>
        ))}
      </div>

      {/* Right — language selector */}
      <button className='flex items-center gap-1.5 px-2.5 h-7 rounded-md bg-purple-500/15 border border-purple-500/20 text-purple-300 text-[11px] hover:bg-purple-500/25 transition-colors shrink-0'>
        <span className='material-symbols-rounded text-[13px]'>code</span>
        {lang}
        <svg width='10' height='10' viewBox='0 0 10 10' fill='none'>
          <path
            d='M2 3.5l3 3 3-3'
            stroke='currentColor'
            strokeWidth='1.2'
            strokeLinecap='round'
          />
        </svg>
      </button>
    </div>
  );
}

// ── Terminal panel ────────────────────────────────────────────────────────────
const TERMINAL_TABS = ["PROBLEMS", "OUTPUT", "TERMINAL", "DEBUG CONSOLE"];

function TerminalPanel({ onClose }: { onClose: () => void }) {
  const [activeTermTab, setActiveTermTab] = useState("TERMINAL");

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 180, opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.18, ease: "easeInOut" }}
      className='w-full bg-[#0e0e1c] border-t border-white/6 flex flex-col overflow-hidden shrink-0'
    >
      {/* tab bar */}
      <div className='h-8 flex items-center justify-between px-3 border-b border-white/5 shrink-0'>
        <div className='flex items-center gap-0'>
          {TERMINAL_TABS.map((tab) => {
            const isActive = tab === activeTermTab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTermTab(tab)}
                className={`px-3 h-8 text-[10.5px] tracking-wide border-b-2 transition-colors
                  ${
                    isActive
                      ? "border-purple-400 text-white/80"
                      : "border-transparent text-white/30 hover:text-white/55"
                  }`}
              >
                {tab}
                {tab === "PROBLEMS" && (
                  <span className='ml-1.5 px-1 py-0.5 rounded text-[9px] bg-orange-500/70 text-white font-semibold'>
                    16
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className='flex items-center gap-1 text-white/25'>
          <button className='w-6 h-6 flex items-center justify-center hover:text-white/60 rounded transition-colors'>
            <svg width='12' height='12' viewBox='0 0 12 12' fill='none'>
              <path
                d='M6 2v4l3 1.5'
                stroke='currentColor'
                strokeWidth='1.2'
                strokeLinecap='round'
              />
              <circle
                cx='6'
                cy='6'
                r='5'
                stroke='currentColor'
                strokeWidth='1.2'
              />
            </svg>
          </button>
          <button className='w-6 h-6 flex items-center justify-center hover:text-white/60 rounded transition-colors'>
            <svg width='12' height='12' viewBox='0 0 12 12' fill='none'>
              <rect
                x='2'
                y='2'
                width='8'
                height='8'
                rx='1'
                stroke='currentColor'
                strokeWidth='1.2'
              />
              <path d='M5 2v8' stroke='currentColor' strokeWidth='1.2' />
            </svg>
          </button>
          <button className='w-6 h-6 flex items-center justify-center hover:text-white/60 rounded transition-colors'>
            <svg width='12' height='12' viewBox='0 0 12 12' fill='none'>
              <rect
                x='2'
                y='2'
                width='8'
                height='8'
                rx='1'
                stroke='currentColor'
                strokeWidth='1.2'
              />
            </svg>
          </button>
          <button className='w-6 h-6 flex items-center justify-center hover:text-white/60 rounded transition-colors'>
            <svg width='10' height='10' viewBox='0 0 10 10' fill='none'>
              <path
                d='M2 4l3-3 3 3M2 6l3 3 3-3'
                stroke='currentColor'
                strokeWidth='1.2'
                strokeLinecap='round'
              />
            </svg>
          </button>
          <button
            onClick={onClose}
            className='w-6 h-6 flex items-center justify-center hover:text-white/80 rounded transition-colors'
          >
            <svg width='10' height='10' viewBox='0 0 10 10' fill='none'>
              <path
                d='M2 2l6 6M8 2L2 8'
                stroke='currentColor'
                strokeWidth='1.3'
                strokeLinecap='round'
              />
            </svg>
          </button>

          {/* Node selector */}
          <div className='ml-2 flex items-center gap-1 px-2 py-1 rounded border border-white/8 text-[10px] text-white/40'>
            <span>1: Node</span>
            <svg width='8' height='8' viewBox='0 0 8 8' fill='none'>
              <path
                d='M1 2.5l3 3 3-3'
                stroke='currentColor'
                strokeWidth='1.1'
                strokeLinecap='round'
              />
            </svg>
          </div>

          {/* + icon */}
          <button className='w-6 h-6 flex items-center justify-center hover:text-white/60 rounded transition-colors'>
            <svg width='12' height='12' viewBox='0 0 12 12' fill='none'>
              <path
                d='M6 2v8M2 6h8'
                stroke='currentColor'
                strokeWidth='1.3'
                strokeLinecap='round'
              />
            </svg>
          </button>
        </div>
      </div>

      {/* content */}
      <div className='flex-1 overflow-auto px-3 py-2 font-mono text-[11px] text-white/50'>
        {activeTermTab === "TERMINAL" && (
          <div className='space-y-0.5'>
            <p>
              <span className='text-purple-400'>[Jul 20 2020, 23:11:30]</span>
              <span className='text-white/35 ml-2'>
                Python 3.8.5 (default) [GCC 9.3.0] on linux
              </span>
            </p>
            <p>
              <span className='text-purple-400'>[Jul 20 2020, 23:11:30]</span>
              <span className='text-white/35 ml-2'>
                Type "help" for more information. &gt;&gt;&gt;
              </span>
            </p>
            <div className='flex items-center gap-1 mt-1'>
              <span className='text-purple-400'>›</span>
              <span className='w-1.5 h-3.5 bg-purple-400/70 animate-pulse rounded-sm' />
            </div>
          </div>
        )}
        {activeTermTab !== "TERMINAL" && (
          <div className='h-full flex items-center justify-center text-white/15 text-[11px]'>
            No output
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Main Home ─────────────────────────────────────────────────────────────────
export default function Home() {
  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const [activeTab, setActiveTab] = useState("explorer");
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [dragging, setDragging] = useState(false);
  const [tabs, setTabs] = useState<FileTab[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [terminalOpen, setTerminalOpen] = useState(true);
  const [workspaceRoot, setWorkspaceRoot] = useState<WorkspaceRoot | null>(
    null,
  );

  useEffect(() => {
    const saved = loadWorkspaceState();
    if (saved.activePath) {
      setActivePath(saved.activePath);
    }
    if (saved.tabs) {
      setTabs(saved.tabs);
    }
  }, []);

  useEffect(() => {
    saveWorkspaceState({
      activePath,
      tabs,
      rootPath: workspaceRoot?.path || null,
    });
  }, [activePath, tabs, workspaceRoot]);

  function openFile(file: FileTab) {
    setTabs((prev) => {
      const exists = prev.find((t) => t.path === file.path);
      if (exists) return prev;
      return [...prev, file];
    });
    setActivePath(file.path);
  }

  function closeTab(path: string) {
    setTabs((prev) => prev.filter((t) => t.path !== path));
    setActivePath((prevActive) => (prevActive === path ? null : prevActive));
  }

  const activeFile = tabs.find((t) => t.path === activePath);

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

  const activeExtensions = useMemo(() => {
    if (!activeFile) return [];
    const langKey = detectLang(activeFile.name);
    return buildExtensions(langKey);
  }, [activeFile]);

  return (
    <div className='w-full h-screen flex flex-col bg-[#0e0e1c] overflow-hidden select-none'>
      <Header recent={activeFile?.name || workspaceRoot?.name || ""} />

      <div className='flex-1 w-full flex min-h-0'>
        <LeftBar activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Sidebar */}
        <div
          style={{ width: sidebarWidth }}
          className='h-full shrink-0 relative'
        >
          {activeTab === "explorer" ? (
            <ExplorerPanel
              activeFile={activeFile ? { ...activeFile, isDir: false } : null}
              onFileOpen={openFile}
              onRootChange={setWorkspaceRoot}
            />
          ) : (
            <div className='h-full bg-[#12121f] flex flex-col'>
              <div className='flex items-center justify-between px-3 py-2 border-b border-white/5 text-[11px] uppercase tracking-[0.2em] text-white/35'>
                <span>{activeTab.replace(/-/g, " ")}</span>
                <button
                  className='rounded-md p-1 hover:bg-white/10'
                  onClick={() => setActiveTab("explorer")}
                >
                  Back
                </button>
              </div>
              <div className='flex-1 overflow-auto p-4 text-white/60'>
                <div className='rounded-2xl border border-white/10 bg-[#17182d] p-4 space-y-3'>
                  <div className='flex items-center gap-3'>
                    <div className='flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-300'>
                      <span className='text-lg'>?</span>
                    </div>
                    <div>
                      <p className='text-sm text-white/80 font-semibold'>
                        Demo panel
                      </p>
                      <p className='text-[12px] text-white/40'>
                        This is a placeholder for the{" "}
                        {activeTab.replace(/-/g, " ")} panel.
                      </p>
                    </div>
                  </div>
                  <div className='rounded-xl bg-[#0d0d1c] border border-white/5 p-3'>
                    {activeTab === "search" && (
                      <>
                        <div className='text-[12px] text-white/70 mb-2'>
                          Search across files
                        </div>
                        <input
                          className='w-full rounded-md border border-white/10 bg-[#12121f] px-3 py-2 text-sm text-white outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400/30'
                          placeholder='Search in workspace…'
                        />
                      </>
                    )}
                    {activeTab === "source-control" && (
                      <>
                        <div className='text-[12px] text-white/70 mb-2'>
                          Source control overview
                        </div>
                        <div className='space-y-2 text-[12px]'>
                          <div className='rounded-lg bg-[#16162a] p-3'>
                            No changes yet
                          </div>
                          <div className='rounded-lg bg-[#16162a] p-3'>
                            Branch: <span className='text-white/80'>main</span>
                          </div>
                        </div>
                      </>
                    )}
                    {activeTab === "extensions" && (
                      <>
                        <div className='text-[12px] text-white/70 mb-2'>
                          Extensions marketplace demo
                        </div>
                        <div className='space-y-2'>
                          <div className='rounded-lg bg-[#16162a] p-3'>
                            <div className='text-white/80'>Code formatter</div>
                            <div className='text-white/40 text-[11px]'>
                              Install extension to enable prettier and linting.
                            </div>
                          </div>
                          <div className='rounded-lg bg-[#16162a] p-3'>
                            <div className='text-white/80'>Git integration</div>
                            <div className='text-white/40 text-[11px]'>
                              Manage branches and commits from the sidebar.
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          <div
            onMouseDown={startResize}
            className={`absolute top-0 right-0 w-1 h-full cursor-col-resize transition-colors ${
              dragging ? "bg-purple-400/40" : "hover:bg-purple-400/20"
            }`}
          />
        </div>

        {/* Main editor area */}
        <main className='flex-1 h-full min-w-0 flex flex-col bg-[#1a1a2e]'>
          {/* Toolbar */}
          <Toolbar activeFile={activeFile} />

          {/* Tab bar */}
          <div className='h-8 flex items-center gap-0 px-0 bg-[#12121f] border-b border-white/5 overflow-x-auto shrink-0'>
            <AnimatePresence>
              {tabs.map((t) => {
                const isActive = t.path === activePath;
                return (
                  <motion.div
                    key={t.path}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.12 }}
                    onClick={() => setActivePath(t.path)}
                    className={`flex items-center gap-1.5 px-3 h-full cursor-pointer text-[11.5px] border-r border-white/5 relative shrink-0 transition-colors
                      ${
                        isActive
                          ? "bg-[#1a1a2e] text-white/85"
                          : "text-white/35 hover:text-white/60 hover:bg-white/3"
                      }`}
                  >
                    {isActive && (
                      <div className='absolute top-0 left-0 right-0 h-0.5 bg-purple-400' />
                    )}
                    <FileTabIcon name={t.name} />
                    <span>{t.name}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        closeTab(t.path);
                      }}
                      className='ml-1 text-white/20 hover:text-white/70 transition-colors leading-none'
                    >
                      ×
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* + new tab */}
            <button className='w-8 h-full flex items-center justify-center text-white/20 hover:text-white/50 transition-colors shrink-0'>
              <svg width='12' height='12' viewBox='0 0 12 12' fill='none'>
                <path
                  d='M6 2v8M2 6h8'
                  stroke='currentColor'
                  strokeWidth='1.3'
                  strokeLinecap='round'
                />
              </svg>
            </button>
          </div>

          {/* Editor + terminal wrapper */}
          <div className='flex-1 min-h-0 flex flex-col'>
            {/* Editor */}
            <div className='flex-1 min-h-0'>
              {tabs.length === 0 && (
                <div className='flex h-full flex-col items-center justify-center gap-4 bg-[radial-gradient(circle_at_top,rgba(168,85,247,0.14),transparent_60%)] text-white/15'>
                  <div className='flex h-16 w-16 items-center justify-center rounded-2xl border border-purple-400/20 bg-purple-500/10'>
                    <span className='material-symbols-rounded text-4xl text-purple-300'>
                      code
                    </span>
                  </div>
                  <div className='max-w-sm text-center'>
                    <p className='text-[13px] text-white/70'>
                      Start with a workspace folder
                    </p>
                    <p className='mt-1 text-[12px] text-white/35'>
                      Open a folder from the explorer to begin editing and
                      browsing files.
                    </p>
                  </div>
                </div>
              )}
              {tabs.map((t) => (
                <div
                  key={t.path}
                  className={`h-full overflow-scroll ${t.path === activePath ? "block" : "hidden"}`}
                >
                  <Editor
                    doc={t.content ?? ""}
                    extensions={activeExtensions}
                    onCursorChange={setCursor}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Open terminal button when closed */}
          {!terminalOpen && (
            <button
              onClick={() => setTerminalOpen(true)}
              className='absolute bottom-6 right-6 px-3 py-1.5 rounded-lg bg-purple-500/20 border border-purple-500/25 text-purple-300 text-[11px] hover:bg-purple-500/30 transition-colors'
            >
              Open Terminal
            </button>
          )}
        </main>
      </div>

      <StatusBar
        fileType={activeFile ? detectLang(activeFile.name) : "txt"}
        line={cursor.line}
        column={cursor.column}
      />
    </div>
  );
}
