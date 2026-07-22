import { useState } from "react";
import { motion } from "motion/react";

const TERMINAL_TABS = ["PROBLEMS", "OUTPUT", "TERMINAL", "DEBUG CONSOLE"];

export default function TerminalPanel({ onClose }: { onClose: () => void }) {
  const [activeTermTab, setActiveTermTab] = useState("TERMINAL");

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 180, opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.15, ease: "easeInOut" }}
      className='w-full bg-panel-alt border-t border-subtle-strong flex flex-col overflow-hidden shrink-0'
    >
      <div className='h-8 flex items-center justify-between px-3 border-b border-subtle shrink-0'>
        <div className='flex items-center gap-0'>
          {TERMINAL_TABS.map((tab) => {
            const isActive = tab === activeTermTab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTermTab(tab)}
                className={`px-3 h-8 text-[10.5px] tracking-wide border-b-2 transition-colors ${
                  isActive
                    ? "border-accent text-secondary"
                    : "border-transparent text-faint hover:text-tertiary"
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>

        <div className='flex items-center gap-1 text-faint'>
          <button
            onClick={onClose}
            className='w-6 h-6 flex items-center justify-center hover:text-secondary rounded transition-colors'
          >
            <i className='bi bi-x text-[12px]' />
          </button>
        </div>
      </div>

      <div className='flex-1 overflow-auto px-3 py-2 font-mono text-[11px] text-tertiary'>
        {activeTermTab === "TERMINAL" ? (
          <div className='space-y-0.5'>
            <p>
              <span className='text-accent'>~</span>
              <span className='text-faint ml-2'>ready</span>
            </p>
            <div className='flex items-center gap-1 mt-1'>
              <span className='text-accent'>$</span>
              <span className='w-1.5 h-3.5 bg-accent/60 animate-pulse rounded-sm' />
            </div>
          </div>
        ) : (
          <div className='h-full flex items-center justify-center text-faint text-[11px]'>
            No output
          </div>
        )}
      </div>
    </motion.div>
  );
}
