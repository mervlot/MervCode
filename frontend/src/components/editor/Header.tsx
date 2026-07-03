import { useState } from "react";
import { Quit } from "../../../wailsjs/go/main/App";

declare global {
  interface Window {
    runtime?: {
      WindowMinimise?: () => void;
      WindowIsMaximised?: () => Promise<boolean>;
      WindowUnmaximise?: () => void;
      WindowMaximise?: () => void;
    };
  }
}

export default function Header({ recent }: { recent: string }) {
  const [isMaximized, setIsMaximized] = useState(false);

  const handleMinimise = () => {
    try {
      window.runtime?.WindowMinimise?.();
    } catch (err) {
      console.error("Failed to minimize window:", err);
    }
  };

  const handleToggleMaximize = async () => {
    try {
      const maximized = await window.runtime?.WindowIsMaximised?.();
      if (maximized) {
        window.runtime?.WindowUnmaximise?.();
        setIsMaximized(false);
      } else {
        window.runtime?.WindowMaximise?.();
        setIsMaximized(true);
      }
    } catch (err) {
      console.error("Failed to toggle maximize state:", err);
    }
  };

  const handleClose = () => {
    try {
      Quit();
    } catch (err) {
      console.error("Failed to close window:", err);
    }
  };

  return (
    <header className='draggable h-8 w-full bg-[#1a1a2e] border-b border-white/5 flex items-center justify-between px-3 select-none shrink-0'>
      {/* LEFT — High-Fidelity macOS Traffic Lights */}
      {/* LEFT — Micro-Interacted macOS Traffic Lights */}
      <div className='no-drag flex items-center gap-2'>
        {/* Close Button (Red) */}
        <button
          onClick={handleClose}
          title='Close'
          className='group w-3 h-3 rounded-full bg-[#ff5f56] active:bg-[#bf433e] border border-[#e0443e] flex items-center justify-center transition-all'
        >
          <svg
            viewBox='0 0 12 12'
            className='w-1.5 h-1.5 opacity-0 group-hover:opacity-65 stroke-[#4a0000] transition-opacity duration-150'
            strokeWidth='1.2'
            strokeLinecap='round'
          >
            <line x1='2.5' y1='2.5' x2='9.5' y2='9.5' />
            <line x1='9.5' y1='2.5' x2='2.5' y2='9.5' />
          </svg>
        </button>

        {/* Minimize Button (Yellow) */}
        <button
          onClick={handleMinimise}
          title='Minimize'
          className='group w-3 h-3 rounded-full bg-[#ffbd2e] active:bg-[#c28e22] border border-[#dfa224] flex items-center justify-center transition-all'
        >
          <svg
            viewBox='0 0 12 12'
            className='w-1.75 h-1.75 opacity-0 group-hover:opacity-70 stroke-[#5c3e00] transition-opacity duration-150'
            strokeWidth='1.4'
            strokeLinecap='round'
          >
            <line x1='2' y1='6' x2='10' y2='6' />
          </svg>
        </button>

        {/* Maximize / Fullscreen Button (Green) */}
        <button
          onClick={handleToggleMaximize}
          title={isMaximized ? "Restore" : "Maximize"}
          className='group w-3 h-3 rounded-full bg-[#27c93f] active:bg-[#1a942b] border border-[#1cb133] flex items-center justify-center transition-all'
        >
          {isMaximized ? (
            /* Collapse / Restore Icon */
            <svg
              viewBox='0 0 12 12'
              className='w-1.5 h-1.5 opacity-0 group-hover:opacity-65 fill-[#004d0f] transition-opacity duration-150'
            >
              <path d='M10.5 4.5H7.5V1.5L9 3 l2-2L12 2l-2 2 1.5 1.5ZM1.5 7.5H4.5V10.5L3 9 l-2 2L0 10l2-2-1.5-1.5Z' />
            </svg>
          ) : (
            /* Expand / Maximize Icon */
            <svg
              viewBox='0 0 12 12'
              className='w-1.5 h-1.5 opacity-0 group-hover:opacity-65 fill-[#004d0f] transition-opacity duration-150'
            >
              <path d='M11 4V1H8L9.5 2.5l-3 3 1 1 3-3L11 4ZM1 8v3h3L2.5 9.5l3-3-1-1-3 3L1 8Z' />
            </svg>
          )}
        </button>
      </div>
      {/* CENTER — File Tabs */}
      <div className='no-drag flex-1 flex items-center h-full ml-2 overflow-x-auto scrollbar-none'>
        {recent && (
          <div className='flex items-center gap-1.5 h-full px-3 bg-[#252540] border-t-2 border-t-purple-400 text-white/80 text-xs cursor-pointer min-w-0'>
            <span className='truncate max-w-28'>{recent}</span>
          </div>
        )}
      </div>

      {/* RIGHT — Actions */}
      <div className='no-drag flex items-center gap-2 text-xs text-white/50'>
        <button className='w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold hover:bg-indigo-500 transition-colors'>
          J
        </button>
      </div>
    </header>
  );
}
