import { useState } from "react"
import Editor from "./Editor"
import { javascript } from "@codemirror/lang-javascript"
import { html } from '@codemirror/lang-html'
import { go } from "@codemirror/lang-go"

import Header from "../components/editor/Header"
import LeftBar from "../components/editor/LeftBar"
import Workspace from "../components/editor/Workspace"

const langMap = {
  js: javascript,
  html: html,
  go:go,
}

export default function Home() {
  const [activeTab, setActiveTab] = useState("explorer")

  const [sidebarWidth, setSidebarWidth] = useState(260)
  const [dragging, setDragging] = useState(false)

  // tabs
  const [tabs, setTabs] = useState([]) // {path,name,content,language}
  const [activePath, setActivePath] = useState(null)

  function detectLang(name = "") {
    if (name.endsWith(".js")) return "js"
    
    return "js"
  }

  function openFile(file) {
    setTabs((prev) => {
      const exists = prev.find((t) => t.path === file.path)
      if (exists) return prev
      return [...prev, file]
    })
    setActivePath(file.path)
  }

  function closeTab(path) {
    setTabs((prev) => prev.filter((t) => t.path !== path))
    setActivePath((prevActive) =>
      prevActive === path ? null : prevActive
    )
  }

  const activeFile = tabs.find((t) => t.path === activePath)

  const startResize = () => {
    setDragging(true)

    const onMove = (e) => {
      const newWidth = e.clientX - 48

      if (newWidth >= 180 && newWidth <= 500) {
        setSidebarWidth(newWidth)
      }
    }

    const onUp = () => {
      setDragging(false)
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }

    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
  }

  return (
    <div className="w-full h-screen flex flex-col bg-[#050505] overflow-hidden select-none">
      <Header recent={activeFile?.name || ""} />

      <div className="flex-1 w-full flex min-h-0">
        <LeftBar onTabChange={setActiveTab} />

        {/* WORKSPACE */}
        <div style={{ width: sidebarWidth }} className="h-full shrink-0 relative">
          <Workspace activeTab={activeTab} onFileOpen={openFile} />

          <div
            onMouseDown={startResize}
            className={`absolute top-0 right-0 w-1 h-full cursor-col-resize ${
              dragging ? "bg-cyan-400/40" : "hover:bg-cyan-400/20"
            }`}
          />
        </div>

        {/* EDITOR + TABS */}
        <main className="flex-1 h-full min-w-0 flex flex-col bg-[#282c34]">
          
          {/* TABS BAR */}
          <div className="h-8 flex items-center gap-2 px-2 bg-[#111] overflow-x-auto">
            {tabs.map((t) => (
              <div
                key={t.path}
                onClick={() => setActivePath(t.path)}
                className={`px-2 py-1 text-xs cursor-pointer rounded flex items-center gap-2 ${
                  t.path === activePath
                    ? "bg-cyan-500/20 text-cyan-300"
                    : "text-white/50 hover:bg-white/10"
                }`}
              >
                {t.name}

                <span
                  onClick={(e) => {
                    e.stopPropagation()
                    closeTab(t.path)
                  }}
                  className="ml-2 text-red-400"
                >
                  ×
                </span>
              </div>
            ))}
          </div>

         {/* EDITOR */}
<div className="flex-1 min-h-0">
  {tabs.map((t) => (
    <div
      key={t.path}
      className={`h-full ${t.path === activePath ? "block" : "hidden"}`}
    >
      <Editor
        language={langMap[detectLang(t.name)]}
        doc={t.content}
        filePath={t.path}
      />
    </div>
  ))}
</div>
        </main>
      </div>
    </div>
  )
}