import { useEffect, useMemo, useRef, useState } from "react";
import { loadWorkspaceState, saveWorkspaceState } from "../../lib/persistence";
import iconRegistry from "../../vars/icon.json";
import { EventsOn } from "../../../wailsjs/runtime/runtime";
import {
  FolderDialog,
  ReadDir,
  CreateFile,
  CreateFolder,
  Rename,
  Delete,
  StartWatcher,
} from "../../../wailsjs/go/main/App";

// ⚡ Optimization: Extract lookup tables outside the component scope
// to ensure an O(1) object lookup reference that doesn't trigger object allocations on render.
const folderNames = (iconRegistry as any).folderNames || {};
const folderNamesExpanded = (iconRegistry as any).folderNamesExpanded || {};
const fileNames = (iconRegistry as any).fileNames || {};
const fileExtensions = (iconRegistry as any).fileExtensions || {};
const iconDefinitions = (iconRegistry as any).iconDefinitions || {};
const defaultFolder = (iconRegistry as any).folder || "folder";
const defaultFolderExpanded =
  (iconRegistry as any).folderExpanded || "folder-open";
const defaultFile = (iconRegistry as any).file || "file";

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
  // Made content optional so cloud-files don't break the type contract
  onFileOpen?: (file: FileItem & { content?: string }) => void;
  onRootChange?: (root: RootNode) => void;
}

function dirname(path: string) {
  return path.replace(/[\\/][^\\/]+$/, "");
}

function sortItems(items: FileItem[]): FileItem[] {
  return [...items].sort((a, b) => {
    if (a.isDir && !b.isDir) return -1;
    if (!a.isDir && b.isDir) return 1;
    return a.name.localeCompare(b.name, undefined, {
      sensitivity: "base",
      numeric: true,
    });
  });
}

// ⚡ Optimized SafeIcon: Resolves assets statically via public/ with fallback state handling
function SafeIcon({ src, className }: { src: string; className: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <img src='/icons/file.svg' className={className} alt='' />;
  }

  return (
    <img
      src={src}
      className={className}
      alt=''
      onError={() => setFailed(true)}
      loading='lazy'
      draggable={false}
    />
  );
}

// ⚡ Optimized FileIconComponent: Performs lightweight key evaluation from lookups
function FileIconComponent({
  item,
  isOpen,
}: {
  item: FileItem;
  isOpen: boolean;
}) {
  let iconName: string | undefined;
  const normalizedName = item.name.toLowerCase();

  if (item.isDir) {
    if (isOpen) {
      iconName =
        folderNamesExpanded[normalizedName] ||
        folderNamesExpanded[item.name] ||
        defaultFolderExpanded;
    } else {
      iconName =
        folderNames[normalizedName] || folderNames[item.name] || defaultFolder;
    }
  } else {
    iconName = fileNames[normalizedName] || fileNames[item.name];

    if (!iconName) {
      const ext = item.name.split(".").pop()?.toLowerCase();
      if (ext) {
        iconName = fileExtensions[ext];
      }
    }

    if (!iconName) {
      iconName = defaultFile;
    }
  }

  const iconDef = iconDefinitions[iconName || ""];
  let iconSrc = "/icons/file.svg";

  if (iconDef?.iconPath) {
    iconSrc = `/icons/${iconDef.iconPath.split("/").pop()}`;
  } else if (item.isDir) {
    iconSrc = isOpen ? "/icons/folder-open.svg" : "/icons/folder.svg";
  }

  return <SafeIcon src={iconSrc} className='h-4 w-4 shrink-0' />;
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
  const [dragOverItem, setDragOverItem] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    item: FileItem;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  useEffect(() => {
    if (!root) return;

    const unsubscribe = EventsOn("workspace-changed", (data) => {
      console.log("File system event caught:", data);
      void refreshExplorer();
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [root, openDirs, cache]);

  // "Reveal in Explorer" — Home.tsx dispatches this event from the tab context
  // menu; expand every ancestor directory of the target path and scroll to it.
  useEffect(() => {
    if (!root) return;

    async function handleReveal(event: Event) {
      const detail = (event as CustomEvent<{ path: string }>).detail;
      if (!detail?.path || !root) return;

      const ancestors: string[] = [];
      let current = dirname(detail.path);
      while (current && current.length >= root.path.length) {
        ancestors.unshift(current);
        if (current === root.path) break;
        current = dirname(current);
      }

      for (const dirPath of ancestors) {
        if (!cache[dirPath]) {
          try {
            const children = await ReadDir(dirPath);
            setCache((prev) => ({ ...prev, [dirPath]: sortItems(children) }));
          } catch {
            // directory may no longer exist — ignore and keep revealing what we can
          }
        }
      }

      setOpenDirs((prev) => {
        const next = { ...prev };
        ancestors.forEach((dirPath) => {
          next[dirPath] = true;
        });
        return next;
      });

      requestAnimationFrame(() => {
        const el = containerRef.current?.querySelector(
          `[data-path="${CSS.escape(detail.path)}"]`,
        );
        el?.scrollIntoView({ block: "center", behavior: "smooth" });
      });
    }

    window.addEventListener(
      "mervcode:reveal-in-explorer",
      handleReveal as EventListener,
    );
    return () =>
      window.removeEventListener(
        "mervcode:reveal-in-explorer",
        handleReveal as EventListener,
      );
  }, [root, cache]);

  async function refreshDir(path: string) {
    try {
      const items = await ReadDir(path);
      const sortedItems = sortItems(items);

      setCache((prev) => ({
        ...prev,
        [path]: sortedItems,
      }));

      await Promise.all(
        sortedItems
          .filter((item) => item.isDir && openDirs[item.path])
          .map((item) => refreshDir(item.path)),
      );
    } catch (error) {
      console.error(`Failed to refresh directory ${path}:`, error);
    }
  }

  async function refreshExplorer() {
    if (!root) return;

    try {
      const items = await ReadDir(root.path);
      const sortedItems = sortItems(items);

      setRoot((prev) =>
        prev
          ? {
              ...prev,
              children: sortedItems,
            }
          : null,
      );

      setCache((prev) => ({
        ...prev,
        [root.path]: sortedItems,
      }));

      await Promise.all(
        sortedItems
          .filter((item) => item.isDir && openDirs[item.path])
          .map((item) => refreshDir(item.path)),
      );
    } catch (error) {
      console.error("Failed to refresh explorer:", error);
    }
  }

  useEffect(() => {
    if (!root) return;

    const interval = setInterval(() => {
      void refreshExplorer();
    }, 30000);

    return () => clearInterval(interval);
  }, [root, openDirs]);

  async function loadRoot(path: string) {
    try {
      const items = await ReadDir(path);
      const sortedItems = sortItems(items);
      const nextRoot: RootNode = {
        path,
        name: path.split(/[\\/]/).pop() || path,
        isDir: true,
        children: sortedItems,
      };
      setRoot(nextRoot);
      setCache((prev) => ({ ...prev, [path]: sortedItems }));
      onRootChange?.(nextRoot);

      await StartWatcher(path);
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

  // Lets the command palette (and anything else) trigger the folder picker
  // without needing a direct reference into this component.
  useEffect(() => {
    const handler = () => void handleOpenFolder();
    window.addEventListener("mervcode:open-folder", handler);
    return () => window.removeEventListener("mervcode:open-folder", handler);
  }, []);

  async function toggleDir(item: FileItem) {
    if (!item.isDir) return;
    const isOpen = openDirs[item.path];
    if (!isOpen) {
      try {
        const children = await ReadDir(item.path);
        setCache((prev) => ({ ...prev, [item.path]: sortItems(children) }));
      } catch (err) {
        console.warn(
          `Could not read directory (possibly cloud placeholder): ${item.path}`,
          err,
        );
      }
    }
    setOpenDirs((prev) => ({ ...prev, [item.path]: !isOpen }));
  }

  async function handleOpenFile(item: FileItem) {
    if (item.isDir) return;

    onFileOpen?.(item);
  }

  async function handleMoveItem(sourcePath: string, targetItem: FileItem) {
    if (!sourcePath || sourcePath === targetItem.path) return;

    const destinationDir = targetItem.isDir
      ? targetItem.path
      : dirname(targetItem.path);

    if (
      destinationDir.startsWith(sourcePath + "/") ||
      destinationDir === sourcePath
    ) {
      return;
    }

    const fileName = sourcePath.split(/[\\/]/).pop();
    const destinationPath = `${destinationDir}/${fileName}`;

    try {
      await Rename(sourcePath, destinationPath);

      const sourceParent = dirname(sourcePath);
      setCache((prev) => {
        const updated = { ...prev };
        delete updated[sourceParent];
        delete updated[destinationDir];
        return updated;
      });

      if (targetItem.isDir) {
        setOpenDirs((prev) => ({ ...prev, [targetItem.path]: true }));
      }

      await refreshExplorer();
    } catch (error) {
      console.error("Failed to commit absolute drag move cycle:", error);
    }
  }

  function Node({ item, depth = 0 }: { item: FileItem; depth?: number }) {
    const isOpen = !!openDirs[item.path];
    const children = cache[item.path] || item.children || [];
    const isActive = activeFile?.path === item.path;
    const isRootNode = root?.path === item.path;

    return (
      <div
        draggable={!isRootNode}
        onDragStart={(e) => {
          e.stopPropagation();
          e.dataTransfer.setData("text/plain", item.path);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!isRootNode && dragOverItem !== item.path) {
            setDragOverItem(item.path);
          }
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          if (dragOverItem === item.path) {
            setDragOverItem(null);
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOverItem(null);
          const sourcePath = e.dataTransfer.getData("text/plain");
          void handleMoveItem(sourcePath, item);
        }}
      >
        <div
          role='button'
          tabIndex={0}
          data-path={item.path}
          onClick={() => (item.isDir ? toggleDir(item) : handleOpenFile(item))}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setContextMenu({
              x: e.clientX,
              y: e.clientY,
              item,
            });
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              item.isDir ? toggleDir(item) : handleOpenFile(item);
            }
          }}
          style={{ paddingLeft: depth * 12 + 10 }}
          className={`group flex items-center gap-2 rounded px-2 py-1 text-[12px] cursor-pointer transition-colors border border-transparent ${
            dragOverItem === item.path ? "bg-accent-soft border-accent!" : ""
          } ${
            isActive
              ? "bg-accent-soft text-primary"
              : "text-secondary hover:bg-hover hover:text-primary"
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
    <div
      ref={containerRef}
      className='h-full flex flex-col overflow-hidden relative bg-panel'
    >
      <div className='flex items-center justify-between px-3 py-2 border-b border-subtle text-[11px] uppercase tracking-wider text-tertiary'>
        <span>Explorer</span>

        <div className='flex items-center gap-1'>
          <button
            className='rounded-md p-1 hover-bg'
            onClick={() => void refreshExplorer()}
            title='Refresh Explorer'
          >
            <i className='bi bi-arrow-clockwise' />
          </button>

          <button
            className='rounded-md p-1 hover-bg'
            onClick={() => setMenuOpen((value) => !value)}
          >
            <i className='bi bi-three-dots' />
          </button>
        </div>

        {menuOpen && (
          <div className='absolute top-9 right-2 z-50 min-w-40 rounded border border-subtle-strong bg-surface p-1 shadow-app'>
            <button
              className='flex w-full items-center gap-2 rounded px-2 py-2 text-left text-[12px] text-secondary hover:bg-hover'
              onClick={handleOpenFolder}
            >
              <i className='bi bi-folder2-open' /> Open Folder
            </button>
          </div>
        )}
      </div>
      <div className='flex-1 overflow-auto px-1 py-2'>
        {!root && (
          <div className='flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-faint'>
            <i className='bi bi-folder2-open text-3xl' />
            <div>
              <p className='text-[13px] text-secondary'>No workspace opened</p>
              <p className='mt-1 text-[11px] text-tertiary'>
                Open a folder to start working.
              </p>
            </div>
            <button
              className='rounded border border-subtle-strong bg-surface px-3 py-1.5 text-[11px] text-secondary hover:text-primary hover:bg-hover transition-colors'
              onClick={handleOpenFolder}
            >
              Open Folder
            </button>
          </div>
        )}
        {root && <Node item={root} />}
      </div>

      {contextMenu && (
        <div
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
          className='fixed z-50 bg-surface rounded border border-subtle-strong py-1 shadow-app min-w-40 flex flex-col'
        >
          <button
            className='flex items-center gap-2 px-3 py-1.5 text-[12px] text-secondary hover:bg-hover hover:text-primary text-left'
            onClick={async () => {
              const name = prompt("File name");
              if (!name) return;
              const targetDir = contextMenu.item.isDir
                ? contextMenu.item.path
                : dirname(contextMenu.item.path);
              await CreateFile(`${targetDir}/${name}`);
              await refreshExplorer();
            }}
          >
            <i className='bi bi-file-earmark-plus' /> New File
          </button>

          <button
            className='flex items-center gap-2 px-3 py-1.5 text-[12px] text-secondary hover:bg-hover hover:text-primary text-left'
            onClick={async () => {
              const name = prompt("Folder name");
              if (!name) return;
              const targetDir = contextMenu.item.isDir
                ? contextMenu.item.path
                : dirname(contextMenu.item.path);
              await CreateFolder(`${targetDir}/${name}`);
              if (contextMenu.item.isDir) {
                setOpenDirs((prev) => ({
                  ...prev,
                  [contextMenu.item.path]: true,
                }));
              }
              await refreshExplorer();
            }}
          >
            <i className='bi bi-folder-plus' /> New Folder
          </button>

          <div className='my-1 border-t border-subtle' />

          <button
            className='flex items-center gap-2 px-3 py-1.5 text-[12px] text-secondary hover:bg-hover hover:text-primary text-left'
            onClick={async () => {
              const name = prompt("Rename", contextMenu.item.name);
              if (!name) return;
              await Rename(
                contextMenu.item.path,
                `${dirname(contextMenu.item.path)}/${name}`,
              );
              await refreshExplorer();
            }}
          >
            <i className='bi bi-pencil' /> Rename
          </button>

          <button
            className='flex items-center gap-2 px-3 py-1.5 text-[12px] text-danger hover:bg-danger-soft text-left'
            onClick={async () => {
              if (!confirm(`Delete "${contextMenu.item.name}"?`)) return;
              await Delete(contextMenu.item.path);
              await refreshExplorer();
            }}
          >
            <i className='bi bi-trash' /> Delete
          </button>
        </div>
      )}
    </div>
  );
}
