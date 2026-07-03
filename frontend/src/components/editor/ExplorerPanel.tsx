import { useEffect, useMemo, useState } from "react";
import { FolderDialog, ReadDir, ReadFile } from "../../../wailsjs/go/main/App";
import { loadWorkspaceState, saveWorkspaceState } from "../../lib/persistence";
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
import FileIcon from "../../assets/icons/file.svg";
import FolderIcon from "../../assets/icons/folder.svg";
import FolderOpenIcon from "../../assets/icons/folder-open.svg";

interface FileItem {
  path: string;
  name: string;
  isDir: boolean;
  children?: FileItem[];
}

interface RootNode extends FileItem {
  children: FileItem[];
}

interface ExplorerProps {
  activeFile?: FileItem | null;
  onFileOpen?: (file: FileItem & { content: string }) => void;
  onRootChange?: (root: RootNode) => void;
}

const fileIconMap = {
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
  png: FileIcon,
  jpg: FileIcon,
  svg: FileIcon,
  txt: FileIcon,
  exe: ExeIcon,
} as const;

function SafeIcon({
  src,
  className,
}: {
  src: string | React.ComponentType<{ className: string }>;
  className: string;
}) {
  if (typeof src === "function") {
    const Comp = src;
    return <Comp className={className} />;
  }

  return <img src={src} className={className} alt='' />;
}

function FileIconComponent({
  item,
  isOpen,
}: {
  item: FileItem;
  isOpen: boolean;
}) {
  if (item.isDir) {
    const Icon = isOpen ? FolderOpenIcon : FolderIcon;
    return <SafeIcon src={Icon} className='h-4 w-4 shrink-0' />;
  }

  const ext = item.name.split(".").pop()?.toLowerCase() as
    | keyof typeof fileIconMap
    | undefined;
  const icon = ext && ext in fileIconMap ? fileIconMap[ext] : FileIcon;
  return <SafeIcon src={icon} className='h-4 w-4 shrink-0' />;
}

export default function ExplorerPanel({
  activeFile,
  onFileOpen,
  onRootChange,
}: ExplorerProps) {
  const [root, setRoot] = useState<RootNode | null>(null);
  const [openDirs, setOpenDirs] = useState<Record<string, boolean>>({});
  const [cache, setCache] = useState<Record<string, FileItem[]>>({});
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const saved = loadWorkspaceState();
    if (saved.rootPath) {
      void loadRoot(saved.rootPath);
    }
  }, []);

  useEffect(() => {
    const state = loadWorkspaceState();
    saveWorkspaceState({ ...state, rootPath: root?.path || null });
  }, [root]);

  async function loadRoot(path: string) {
    try {
      const items = await ReadDir(path);
      const nextRoot: RootNode = {
        path,
        name: path.split(/[\\/]/).pop() || path,
        isDir: true,
        children: items,
      };
      setRoot(nextRoot);
      setCache((prev) => ({ ...prev, [path]: items }));
      onRootChange?.(nextRoot);
    } catch (error) {
      console.error("Failed to load workspace root", error);
    }
  }

  async function handleOpenFolder() {
    const folder = await FolderDialog();
    if (!folder) return;
    await loadRoot(folder);
    setMenuOpen(false);
  }

  async function toggleDir(item: FileItem) {
    if (!item.isDir) return;
    const isOpen = openDirs[item.path];
    if (!isOpen) {
      const children = await ReadDir(item.path);
      setCache((prev) => ({ ...prev, [item.path]: children }));
    }
    setOpenDirs((prev) => ({ ...prev, [item.path]: !isOpen }));
  }

  async function handleOpenFile(item: FileItem) {
    if (item.isDir) return;
    const content = await ReadFile(item.path);
    onFileOpen?.({ ...item, content });
  }

  const explorerState = useMemo(
    () => ({ root, openDirs, cache }),
    [root, openDirs, cache],
  );

  function Node({ item, depth = 0 }: { item: FileItem; depth?: number }) {
    const isOpen = !!openDirs[item.path];
    const children = cache[item.path] || item.children || [];
    const isActive = activeFile?.path === item.path;

    return (
      <div>
        <div
          role='button'
          tabIndex={0}
          onClick={() => (item.isDir ? toggleDir(item) : handleOpenFile(item))}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              item.isDir ? toggleDir(item) : handleOpenFile(item);
            }
          }}
          style={{ paddingLeft: depth * 12 + 10 }}
          className={`group flex items-center gap-2 rounded-md px-2 py-1 text-[12px] cursor-pointer transition-colors ${
            isActive
              ? "bg-purple-500/15 text-purple-200"
              : "text-white/70 hover:bg-white/5 hover:text-white"
          }`}
        >
          {item.isDir ? (
            <i
              className={`bi bi-caret-right-fill text-[10px] transition-transform ${isOpen ? "rotate-90" : ""}`}
            />
          ) : (
            <span className='w-2.5' />
          )}
          <FileIconComponent item={item} isOpen={isOpen} />
          <span className='truncate'>{item.name}</span>
        </div>
        {item.isDir && isOpen && (
          <div className='mt-0.5'>
            {children.map((child: FileItem) => (
              <Node key={child.path} item={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className='h-full flex flex-col overflow-hidden'>
      <div className='flex items-center justify-between px-3 py-2 border-b border-white/5 text-[11px] uppercase tracking-[0.2em] text-white/35'>
        <span>Explorer</span>
        <button
          className='rounded-md p-1 hover:bg-white/10'
          onClick={() => setMenuOpen((value) => !value)}
        >
          <i className='bi bi-three-dots' />
        </button>
        {menuOpen && (
          <div className='absolute top-9 right-2 z-50 min-w-40 rounded-lg border border-white/10 bg-[#1f213a] p-1 shadow-2xl'>
            <button
              className='flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[12px] text-white/70 hover:bg-white/10'
              onClick={handleOpenFolder}
            >
              <i className='bi bi-folder2-open' /> Open Folder
            </button>
          </div>
        )}
      </div>
      <div className='flex-1 overflow-auto px-1 py-2'>
        {!root && (
          <div className='flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-white/20'>
            <i className='bi bi-folder2-open text-3xl' />
            <div>
              <p className='text-[13px] text-white/50'>No workspace opened</p>
              <p className='mt-1 text-[11px] text-white/30'>
                Open a folder to start working.
              </p>
            </div>
            <button
              className='rounded-md bg-purple-500/20 px-3 py-1.5 text-[11px] text-purple-200'
              onClick={handleOpenFolder}
            >
              Open Folder
            </button>
          </div>
        )}
        {root && <Node item={root} />}
      </div>
    </div>
  );
}
