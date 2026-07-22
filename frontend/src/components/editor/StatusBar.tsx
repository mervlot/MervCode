interface StatusBarProps {
  fileType?: string;
  line?: number;
  column?: number;
  unsavedCount?: number;
  branch?: string;
}

export default function StatusBar({
  fileType = "txt",
  line = 1,
  column = 1,
  unsavedCount = 0,
  branch,
}: StatusBarProps) {
  return (
    <footer className='flex h-6 items-center justify-between border-t border-subtle bg-panel px-3 text-[10.5px] text-tertiary select-none shrink-0'>
      <div className='flex items-center gap-3'>
        {branch && (
          <span className='flex items-center gap-1'>
            <i className='bi bi-git' />
            {branch}
          </span>
        )}
        <span>{fileType.toUpperCase()}</span>
        <span className='text-faint'>·</span>
        <span>Spaces: 2</span>
      </div>
      <div className='flex items-center gap-3'>
        {unsavedCount > 0 && (
          <span className='flex items-center gap-1 text-accent'>
            <span className='h-1.5 w-1.5 rounded-full bg-accent' />
            {unsavedCount} unsaved
          </span>
        )}
        <span>
          Ln {line}, Col {column}
        </span>
        <span className='text-faint'>·</span>
        <span>UTF-8</span>
      </div>
    </footer>
  );
}
