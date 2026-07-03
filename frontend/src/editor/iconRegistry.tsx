import { useState } from "react";
import { FolderDialog, ReadDir, ReadFile } from "../../wailsjs/go/main/App";

/* -----------------------------
   ICON IMPORTS
   (these may be URLs OR components depending on bundler)
------------------------------ */
import JSIcon from "../../assets/icons/javascript.svg";
import TSIcon from "../../assets/icons/typescript.svg";
import ReactIcon from "../../assets/icons/react.svg";
import JSONIcon from "../../assets/icons/json.svg";
import MarkdownIcon from "../../assets/icons/markdown.svg";
import HTMLIcon from "../../assets/icons/html.svg";
import CSSIcon from "../../assets/icons/css.svg";
import PythonIcon from "../../assets/icons/python.svg";
import GoIcon from "../../assets/icons/go.svg";
import RustIcon from "../../assets/icons/rust.svg";
import PHPIcon from "../../assets/icons/php.svg";
import ExeIcon from "../../assets/icons/exe.svg";
import FileIcon_ from "../../assets/icons/file.svg";
import FolderIcon from "../../assets/icons/folder.svg";
import FolderOpenIcon from "../../assets/icons/folder-open.svg";

/* -----------------------------
   FILE ICON MAP
------------------------------ */
type IconSource = string | ((props: { className?: string | undefined }) => JSX.Element);

const fileIconMap: Record<string, IconSource> = {
  js: JSIcon,
  jsx: ReactIcon,
  ts: TSIcon,
  tsx: ReactIcon,
  json: JSONIcon,
  md: MarkdownIcon,
  html: HTMLIcon,
  css: CSSIcon,
  py: PythonIcon,
  go: GoIcon,
  rs: RustIcon,
  php: PHPIcon,
  png: FileIcon_,
  jpg: FileIcon_,
  svg: FileIcon_,
  txt: FileIcon_,
  exe: ExeIcon,
};

/* -----------------------------
   SAFE ICON RENDERER
------------------------------ */
type SafeIconProps = {
  src: string | ((props: { className?: string | undefined }) => JSX.Element);
  className?: string;
};

function SafeIcon({ src, className }: SafeIconProps) {
  // if it's a React component (function)
  if (typeof src === "function") {
    const Comp = src;
    return <Comp className={className} />;
  }

  // otherwise assume it's a URL string
  return <img src={src} className={className} alt='' />;
}

/* -----------------------------
   FILE ICON COMPONENT
------------------------------ */
type FileIconComponentProps = {
  item: ExplorerItem;
  isOpen: boolean;
};

function FileIconComponent({ item, isOpen }: FileIconComponentProps) {
  if (item.isDir) {
    const Icon = isOpen ? FolderOpenIcon : FolderIcon;
    return <SafeIcon src={Icon} className='w-4 h-4 shrink-0' />;
  }

  const ext = item.name.split(".").pop();
  const icon = ext ? fileIconMap[ext.toLowerCase()] || FileIcon_ : FileIcon_;

  return <SafeIcon src={icon} className='w-4 h-4 shrink-0' />;
}

/* -----------------------------
   UI ICONS
------------------------------ */
function MenuIcon() {
  return (
    <svg
      width='16'
      height='16'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
    >
      <circle cx='12' cy='5' r='1' />
      <circle cx='12' cy='12' r='1' />
      <circle cx='12' cy='19' r='1' />
    </svg>
  );
}

function InboxIcon() {
  return (
    <svg
      width='32'
      height='32'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='1.5'
    >
      <path d='M5 5h14v11H5z' />
      <path d='M5 5L9 1h6l4 4' />
      <path d='M5 16l2 2h10l2-2' />
    </svg>
  );
}

function FolderOpenEmptyIcon() {
  return (
    <svg
      width='32'
      height='32'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='1.5'
    >
      <path d='M3 7v11c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V7' />
      <path d='M3 7h8L13 3h8c1.1 0 2 .9 2 2v2' />
    </svg>
  );
}

/* -----------------------------
   WORKSPACE
------------------------------ */
type ExplorerItem = {
  path: string;
  name: string;
  isDir: boolean;
  children?: ExplorerItem[];
};

type WorkspaceProps = {
  activeTab: "explorer" | "search" | "source-control" | "extensions";
  onFileOpen?: (file: { path: string; name: string; content: string }) => void;
  activeFile?: { path?: string } | null;
};

export default function Workspace({
  activeTab,
  onFileOpen,
  activeFile,
}: WorkspaceProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [root, setRoot] = useState<ExplorerItem | null>(null);
  const [openDirs, setOpenDirs] = useState<Record<string, boolean>>({});
  const [cache, setCache] = useState<Record<string, ExplorerItem[]>>({});

  async function loadDir(path: string) {
    if (cache[path]) return cache[path];
    const items = await ReadDir(path);
    setCache((p) => ({ ...p, [path]: items }));
    return items;
  }

  async function toggleDir(item: ExplorerItem) {
    if (!item.isDir) return;
    const isOpen = openDirs[item.path];
    if (!isOpen) await loadDir(item.path);
    setOpenDirs((p) => ({ ...p, [item.path]: !isOpen }));
  }

  async function openFile(item: ExplorerItem) {
    if (item.isDir) return;
    const content = await ReadFile(item.path);
    onFileOpen?.({ path: item.path, name: item.name, content });
  }

  async function openFolder() {
    const folder = await FolderDialog();
    if (!folder) return;

    const items = await ReadDir(folder);

    setRoot({
      path: folder,
      name: folder.split(/[\\/]/).pop() ?? "",
      isDir: true,
      children: items,
    });

    setCache({ [folder]: items });
    setMenuOpen(false);
  }

  const tabs = [
    {
      id: "explorer",
      label: "Explorer",
      tab_func: [{ id: "openfolder", func: openFolder }],
    },
    { id: "search", label: "Search" },
    { id: "source-control", label: "Source Control" },
    { id: "extensions", label: "Extensions" },
  ];

  type NodeProps = {
    item: ExplorerItem;
    depth?: number;
  };

  function Node({ item, depth = 0 }: NodeProps) {
    const isOpen = !!openDirs[item.path];
    const children = cache[item.path] || item.children || [];
    const isActive = activeFile?.path === item.path;

    return (
      <div>
        <div
          onClick={() => (item.isDir ? toggleDir(item) : openFile(item))}
          style={{ paddingLeft: depth * 10 + 8 }}
          className={`
            group flex items-center gap-1.5 py-0.75 pr-2 rounded-sm cursor-pointer text-[12.5px]
            transition-colors duration-100
            ${
              isActive
                ? "bg-purple-500/15 text-purple-200"
                : "text-white/55 hover:text-white/85 hover:bg-white/5"
            }
          `}
        >
          {item.isDir ? (
            <svg
              width='10'
              height='10'
              viewBox='0 0 10 10'
              fill='none'
              className={`shrink-0 transition-transform duration-150 ${
                isOpen ? "rotate-90" : ""
              }`}
            >
              <path d='M3 2l4 3-4 3V2z' fill='currentColor' opacity='0.5' />
            </svg>
          ) : (
            <span className='w-2.5 shrink-0' />
          )}

          <FileIconComponent item={item} isOpen={isOpen} />

          <span className='truncate leading-relaxed'>{item.name}</span>

          {isActive && !item.isDir && (
            <span className='ml-auto w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0' />
          )}
        </div>

        {item.isDir && isOpen && (
          <div>
            {children.map((c: any) => (
              <Node key={c.path} item={c} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <aside className='h-full border-r border-white/5 bg-[#12121f] flex flex-col overflow-hidden relative'>
      <div className='h-9 px-3 flex items-center justify-between text-[10px] uppercase tracking-widest text-white/30 font-medium shrink-0'>
        <span>{activeTab}</span>

        <button
          className='text-white/25 hover:text-white/60'
          onClick={() => setMenuOpen((v) => !v)}
        >
          <MenuIcon />
        </button>

        {menuOpen && (
          <div className='absolute top-9 right-2 bg-[#1e1e32] border border-white/8 rounded-lg shadow-2xl z-50 min-w-44 py-1'>
            {tabs
              .find((t) => t.id === activeTab)
              ?.tab_func?.map((t) => (
                <button
                  key={t.id}
                  onClick={t.func}
                  className='w-full px-3 py-2 text-left text-[12px] text-white/60 hover:bg-purple-500/15 hover:text-white/90'
                >
                  Open Folder
                </button>
              ))}
          </div>
        )}
      </div>

      <div className='flex-1 overflow-auto py-1 text-sm'>
        {activeTab !== "explorer" && (
          <div className='h-full flex flex-col items-center justify-center text-white/15 gap-2'>
            <InboxIcon />
            <span className='text-[11px]'>Empty Panel</span>
          </div>
        )}

        {activeTab === "explorer" && !root && (
          <div className='h-full flex flex-col items-center justify-center text-white/15 gap-3 px-4'>
            <FolderOpenEmptyIcon />
            <span className='text-[11px] text-center'>
              Open a folder to get started
            </span>

            <button
              onClick={openFolder}
              className='px-3 py-1.5 rounded-md bg-purple-500/20 text-purple-300 text-[11px]'
            >
              Open Folder
            </button>
          </div>
        )}

        {activeTab === "explorer" && root && <Node item={root} />}
      </div>
    </aside>
  );
}
