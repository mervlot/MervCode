import { useState } from "react";

export default function Header({ recent }) {
  const [isMaximized, setIsMaximized] = useState(false);

  // Minimise handler
  const handleMinimise = () => {
    try {
      window.runtime.WindowMinimise();
    } catch (err) {
      console.error("Failed to minimize window:", err);
    }
  };

  // Toggle Maximise/Restore handler
  const handleToggleMaximize = async () => {
    try {
      const maximized = await window.runtime.WindowIsMaximised();
      if (maximized) {
        window.runtime.WindowUnmaximise();
        setIsMaximized(false);
      } else {
        window.runtime.WindowMaximise();
        setIsMaximized(true);
      }
    } catch (err) {
      console.error("Failed to toggle maximize state:", err);
    }
  };

  // Close handler
  const handleClose = () => {
    try {
      window.runtime.WindowClose();
    } catch (err) {
      console.error("Failed to close window:", err);
    }
  };

  return (
    <header
      className="
        draggable h-10 w-full border-b border-cyan-500/20 bg-[#050505]
        flex items-center justify-between px-3 select-none
      "
    >
      {/* LEFT */}
      <div className="flex items-center gap-3 min-w-55">
        <div className="w-4 h-4 rotate-45 border border-cyan-400 flex items-center justify-center">
          <div className="w-1.5 h-1.5 bg-cyan-400" />
        </div>

        <span className="text-sm font-semibold tracking-wide text-white">
          MervCode
        </span>

        {recent && (
          <span className="text-xs text-white/40 truncate max-w-75">
            {recent}
          </span>
        )}
      </div>

      {/* CENTER */}
      <div className="flex-1 flex justify-center px-5">
        <div className="no-drag relative w-full max-w-105 flex items-center text-white/40 focus-within:text-cyan-400">
          <i className="bi bi-search absolute left-3 text-xs pointer-events-none" />
          <input
            type="text"
            placeholder="Search or type command..."
            className="
              w-full h-7 rounded-md border border-cyan-500/20
              bg-white/3 pl-8 pr-3 text-sm text-white outline-none
              focus:border-cyan-500/50 transition-colors duration-200
            "
          />
        </div>
      </div>

      {/* RIGHT */}
      <div className="no-drag flex items-center h-full text-sm">
        <button
          onClick={handleMinimise}
          className="h-full w-11 text-white/70 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors"
          title="Minimize"
        >
          <i className="bi bi-dash-lg" />
        </button>

        <button
          onClick={handleToggleMaximize}
          className="h-full w-11 text-white/70 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors"
          title={isMaximized ? "Restore Down" : "Maximize"}
        >
          <i className={isMaximized ? "bi bi-window-stack" : "bi bi-window"} />
        </button>

        <button
          onClick={handleClose}
          className="h-full w-11 text-white/70 hover:text-white hover:bg-red-500 flex items-center justify-center transition-colors"
          title="Close"
        >
          <i className="bi bi-x-lg text-base" />
        </button>
      </div>
    </header>
  );
}