import type { DragEvent as ReactDragEvent, MouseEvent as ReactMouseEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { FileTabIcon } from "./FileTabIcons";
import type { FileTab } from "../../types";

interface TabBarProps {
  tabs: FileTab[];
  activePath: string | null;
  draggedTabPath: string | null;
  dropTargetPath: string | null;
  isDirty: (path: string) => boolean;
  onTabClick: (path: string) => void;
  onTabClose: (path: string) => void;
  onContextMenu: (e: ReactMouseEvent<HTMLDivElement>, path: string) => void;
  onDragStart: (e: ReactDragEvent<HTMLDivElement>, path: string) => void;
  onDragOver: (e: ReactDragEvent<HTMLDivElement>, path: string) => void;
  onDrop: (e: ReactDragEvent<HTMLDivElement>, path: string) => void;
  onDragEnd: () => void;
}

export default function TabBar({
  tabs,
  activePath,
  draggedTabPath,
  dropTargetPath,
  isDirty,
  onTabClick,
  onTabClose,
  onContextMenu,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: TabBarProps) {
  return (
    <div className='flex min-w-0 items-center gap-px overflow-x-auto border-b border-subtle-strong bg-panel shrink-0'>
      <AnimatePresence>
        {tabs.map((t) => {
          const isActive = t.path === activePath;
          const isDragging = draggedTabPath === t.path;
          const isDropTarget =
            dropTargetPath === t.path &&
            draggedTabPath &&
            draggedTabPath !== t.path;
          const dirty = isDirty(t.path);
          return (
            <motion.div
              key={t.path}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -4 }}
              transition={{ duration: 0.1 }}
              layout
              draggable
              onClick={() => onTabClick(t.path)}
              onContextMenu={(e) => onContextMenu(e, t.path)}
              onDragStartCapture={(e) => onDragStart(e, t.path)}
              onDragOverCapture={(e) => onDragOver(e, t.path)}
              onDropCapture={(e) => onDrop(e, t.path)}
              onDragEndCapture={onDragEnd}
              className={`group flex w-40 shrink-0 items-center gap-2 text-[12px] relative cursor-pointer transition-colors duration-100 border-r border-subtle ${
                isActive
                  ? "bg-canvas text-primary"
                  : "bg-tab text-secondary hover:bg-hover hover:text-primary"
              } ${isDragging ? "opacity-70" : ""} ${isDropTarget ? "bg-accent-soft" : ""}`}
            >
              <div
                title={t.name}
                className='flex min-w-0 flex-1 items-center gap-2 overflow-hidden px-3 h-8'
              >
                <span className='shrink-0'>
                  <FileTabIcon name={t.name} />
                </span>
                <span className='truncate whitespace-nowrap'>
                  {t.name}
                </span>
              </div>

              <div className='relative flex h-6 w-6 items-center justify-center shrink-0 mr-1'>
                {dirty && (
                  <span
                    className='absolute h-1.5 w-1.5 rounded-full bg-accent transition-opacity group-hover:opacity-0'
                    title='Unsaved changes'
                  />
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onTabClose(t.path);
                  }}
                  className={`flex h-5 w-5 items-center justify-center rounded text-faint transition-all hover:bg-active hover:text-primary ${
                    dirty
                      ? "opacity-0 group-hover:opacity-100"
                      : "opacity-100"
                  }`}
                  title='Close tab'
                >
                  <i className='bi bi-x text-[13px]' />
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
