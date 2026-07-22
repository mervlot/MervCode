// import { motion } from "motion/react";
// import type { FileTab } from "../../types";

// const Tabs = (
//   t: FileTab,
//   isActive: boolean,
//   isDragging: boolean,
//   isDropTarget:  "" | boolean | null,
// ) => {
//   return (
//     <motion.div
//       key={t.path}
//       initial={{ opacity: 0, x: -6 }}
//       animate={{ opacity: 1, x: 0 }}
//       exit={{ opacity: 0, x: -6 }}
//       transition={{ duration: 0.12 }}
//       layout
//       draggable
//       onClick={() => setActivePath(t.path)}
//       onContextMenu={(event) => handleContextMenu(event, t.path)}
//       onDragStartCapture={(event) => handleTabDragStart(event, t.path)}
//       onDragOverCapture={(event) => handleTabDragOver(event, t.path)}
//       onDropCapture={(event) => handleTabDrop(event, t.path)}
//       onDragEndCapture={handleTabDragEnd}
//       className={`group flex w-42 shrink-0 items-center gap-2 rounded-t-md border-t-2 px-2.5 py-2 text-[12px] leading-none relative cursor-pointer transition-colors duration-150 ${
//         isActive
//           ? "border-t-accent bg-canvas text-primary"
//           : "border-t-transparent bg-tab text-secondary hover-bg hover:text-primary"
//       } ${isDragging ? "opacity-80 scale-[0.99]" : ""} ${isDropTarget ? "border-t-accent/40 bg-accent-soft" : ""}`}
//     >
//       <div
//         title={t.name}
//         className='flex min-w-0 flex-1 items-center gap-2 overflow-hidden'
//       >
//         <span className='shrink-0'>
//           <FileTabIcon name={t.name} />
//         </span>
//         <span className='truncate whitespace-nowrap'>{t.name}</span>
//       </div>

//       {/* Unsaved-dot / close-button swap, VS Code style */}
//       <div className='relative flex h-6 w-6 items-center justify-center shrink-0'>
//         {dirty && (
//           <span
//             className='absolute h-2 w-2 rounded-full bg-accent transition-opacity group-hover:opacity-0'
//             title='Unsaved changes'
//           />
//         )}
//         <button
//           onClick={(e) => {
//             e.stopPropagation();
//             closeTab(t.path);
//           }}
//           className={`flex h-6 w-6 items-center justify-center rounded-sm text-faint transition-all hover:bg-active hover:text-primary ${
//             dirty ? "opacity-0 group-hover:opacity-100" : "opacity-100"
//           }`}
//           title='Close tab'
//         >
//           <span className='material-symbols-rounded text-[13px]'>close</span>
//         </button>
//       </div>
//     </motion.div>
//   );
// };