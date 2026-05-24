import { useState } from "react"
import { FolderDialog, ReadDir, ReadFile } from "../../../wailsjs/go/main/App"

export default function Workspace({ activeTab, onFileOpen, activeFile }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [root, setRoot] = useState(null)
  const [openDirs, setOpenDirs] = useState({})
  const [cache, setCache] = useState({})

  async function openFolder() {
    const folder = await FolderDialog()
    if (!folder) return

    const items = await ReadDir(folder)

    setRoot({
      path: folder,
      name: folder.split(/[\\/]/).pop(),
      isDir: true,
      children: items,
    })

    setCache({ [folder]: items })
    setMenuOpen(false)
  }

  async function loadDir(path) {
    if (cache[path]) return cache[path]

    const items = await ReadDir(path)
    setCache((p) => ({ ...p, [path]: items }))
    return items
  }

  async function toggleDir(item) {
    if (!item.isDir) return

    const isOpen = openDirs[item.path]

    if (!isOpen) await loadDir(item.path)

    setOpenDirs((p) => ({ ...p, [item.path]: !isOpen }))
  }

  async function openFile(item) {
    if (item.isDir) return

    const content = await ReadFile(item.path)

    onFileOpen?.({
      path: item.path,
      name: item.name,
      content,
    })
  }

  function Node({ item, depth = 0 }) {
    const isOpen = openDirs[item.path]
    const children = cache[item.path] || item.children || []
    const isActive = activeFile?.path === item.path

    return (
      <div>
        <div
          onClick={() => (item.isDir ? toggleDir(item) : openFile(item))}
          style={{ paddingLeft: depth * 12 }}
          className={`
            flex items-center gap-2 px-2 py-1 rounded cursor-pointer
            text-sm
            ${isActive ? "bg-cyan-500/10 text-cyan-300" : "text-white/70"}
            hover:bg-white/5
          `}
        >
          <i
            className={
              item.isDir
                ? isOpen
                  ? "bi bi-folder2-open text-cyan-400"
                  : "bi bi-folder text-cyan-400"
                : "bi bi-file-earmark-code"
            }
          />
          <span>{item.name}</span>
        </div>

        {item.isDir && isOpen && (
          <div>
            {children.map((c) => (
              <Node key={c.path} item={c} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <aside className="h-full border-r border-cyan-500/10 bg-[#0a0a0a] flex flex-col overflow-hidden relative">

      {/* TOP */}
      <div className="h-10 px-4 flex items-center justify-between text-[11px] uppercase tracking-wider text-white/40 relative">
        <span>{activeTab}</span>

        <button
          className="text-white/30 hover:text-cyan-400"
          onClick={() => setMenuOpen((v) => !v)}
        >
          <i className="bi bi-three-dots" />
        </button>

        {menuOpen && (
          <div className="absolute top-10 right-2 bg-[#111] border border-cyan-500/10 rounded shadow-lg z-50 min-w-40">
            <button
              onClick={openFolder}
              className="w-full px-4 py-2 text-left text-sm text-white/70 hover:bg-cyan-500/10 hover:text-cyan-400"
            >
              <i className="bi bi-folder2-open mr-2" />
              Open Folder
            </button>
          </div>
        )}
      </div>

      {/* TREE */}
      <div className="flex-1 overflow-auto p-2 text-sm">
        {activeTab !== "explorer" && (
          <div className="h-full flex items-center justify-center text-white/20">
            Empty Panel
          </div>
        )}

        {activeTab === "explorer" && root && <Node item={root} />}
      </div>
    </aside>
  )
}