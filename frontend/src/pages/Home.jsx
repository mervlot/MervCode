import { useState, useMemo } from "react";
import Editor from "./Editor";

import Header from "../components/editor/Header";
import LeftBar from "../components/editor/LeftBar";
import Workspace from "../components/editor/Workspace";
import Footer from "../components/editor/Footer";

import { detectLang } from "../editor/detectLang";
import { buildExtensions } from "../editor/buildExtensions";

export default function Home() {
  const [cursor, setCursor] = useState({
    line: 1,
    column: 1,
  });

  const [activeTab, setActiveTab] = useState("explorer");

  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [dragging, setDragging] = useState(false);

  const [tabs, setTabs] = useState([]);
  const [activePath, setActivePath] = useState(null);

  function openFile(file) {
    setTabs((prev) => {
      const exists = prev.find((t) => t.path === file.path);
      if (exists) return prev;
      return [...prev, file];
    });
    setActivePath(file.path);
  }

  function closeTab(path) {
    setTabs((prev) => prev.filter((t) => t.path !== path));
    setActivePath((prevActive) => (prevActive === path ? null : prevActive));
  }

  const activeFile = tabs.find((t) => t.path === activePath);

  const startResize = () => {
    setDragging(true);

    const onMove = (e) => {
      const newWidth = e.clientX - 48;

      if (newWidth >= 180 && newWidth <= 500) {
        setSidebarWidth(newWidth);
      }
    };

    const onUp = () => {
      setDragging(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // ✅ FIXED DEPENDENCY (this was missing activeFile)
  const activeExtensions = useMemo(() => {
    if (!activeFile) return [];
    const langKey = detectLang(activeFile.name);
    return buildExtensions(langKey);
  }, [activeFile]);

  return (
    <div className="w-full h-screen flex flex-col bg-[#050505] overflow-hidden select-none">
      <Header recent={activeFile?.name || ""} />

      <div className="flex-1 w-full flex min-h-0">
        <LeftBar onTabChange={setActiveTab} />

        <div
          style={{ width: sidebarWidth }}
          className="h-full shrink-0 relative"
        >
          <Workspace activeTab={activeTab} onFileOpen={openFile} />

          <div
            onMouseDown={startResize}
            className={`absolute top-0 right-0 w-1 h-full cursor-col-resize ${
              dragging ? "bg-cyan-400/40" : "hover:bg-cyan-400/20"
            }`}
          />
        </div>

        <main className="flex-1 h-full min-w-0 flex flex-col bg-[#282c34]">
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
                    e.stopPropagation();
                    closeTab(t.path);
                  }}
                  className="ml-2 text-red-400"
                >
                  ×
                </span>
              </div>
            ))}
          </div>

          <div className="flex-1 min-h-0">
            {tabs.map((t) => (
              <div
                key={t.path}
                className={`h-full overflow-scroll ${
                  t.path === activePath ? "block" : "hidden"
                }`}
              >
                <Editor
                  doc={t.content}
                  extensions={activeExtensions}
                  filePath={t.path}
                  onCursorChange={setCursor}
                />
              </div>
            ))}
          </div>
        </main>
      </div>

      <Footer
        fileType={activeFile ? detectLang(activeFile.name) : "txt"}
        line={cursor.line}
        column={cursor.column}
      />
    </div>
  );
}
