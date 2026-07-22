import { AnimatePresence, motion } from "motion/react";

interface TabContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onCloseTab: () => void;
  onCloseOthers: () => void;
  onCloseToRight: () => void;
  onCloseAll: () => void;
  onRevealInExplorer: () => void;
  onCopyPath: () => void;
}

export default function TabContextMenu({
  x,
  y,
  onClose,
  onCloseTab,
  onCloseOthers,
  onCloseToRight,
  onCloseAll,
  onRevealInExplorer,
  onCopyPath,
}: TabContextMenuProps) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: -4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: -4 }}
        transition={{ duration: 0.1 }}
        className='fixed z-40 min-w-44 rounded-lg border border-subtle-strong bg-surface p-1 shadow-app'
        style={{ top: y, left: x }}
      >
        <button
          onClick={onCloseTab}
          className='flex w-full items-center gap-2 rounded px-3 py-1.5 text-left text-[12px] text-secondary transition-colors hover-bg'
        >
          <i className='bi bi-x-lg text-[11px] text-tertiary w-4 text-center' />
          <span>Close</span>
        </button>
        <button
          onClick={onCloseOthers}
          className='flex w-full items-center gap-2 rounded px-3 py-1.5 text-left text-[12px] text-secondary transition-colors hover-bg'
        >
          <i className='bi bi-x text-[11px] text-tertiary w-4 text-center' />
          <span>Close Others</span>
        </button>
        <button
          onClick={onCloseToRight}
          className='flex w-full items-center gap-2 rounded px-3 py-1.5 text-left text-[12px] text-secondary transition-colors hover-bg'
        >
          <i className='bi bi-arrow-right-from-line text-[11px] text-tertiary w-4 text-center' />
          <span>Close to the Right</span>
        </button>
        <button
          onClick={onCloseAll}
          className='flex w-full items-center gap-2 rounded px-3 py-1.5 text-left text-[12px] text-secondary transition-colors hover-bg'
        >
          <i className='bi bi-x-lg text-[11px] text-tertiary w-4 text-center' />
          <span>Close All</span>
        </button>
        <div className='my-1 h-px bg-white/8' />
        <button
          onClick={onRevealInExplorer}
          className='flex w-full items-center gap-2 rounded px-3 py-1.5 text-left text-[12px] text-secondary transition-colors hover-bg'
        >
          <i className='bi bi-folder2-open text-[11px] text-tertiary w-4 text-center' />
          <span>Reveal in Explorer</span>
        </button>
        <button
          onClick={onCopyPath}
          className='flex w-full items-center gap-2 rounded px-3 py-1.5 text-left text-[12px] text-secondary transition-colors hover-bg'
        >
          <i className='bi bi-clipboard text-[11px] text-tertiary w-4 text-center' />
          <span>Copy Path</span>
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
