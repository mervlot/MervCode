interface EmptyStateProps {
  onOpenFolder: () => void;
}

export default function EmptyState({ onOpenFolder }: EmptyStateProps) {
  return (
    <div className='flex h-full flex-col items-center justify-center gap-4 text-faint'>
      <div className='flex h-14 w-14 items-center justify-center rounded-lg border border-subtle-strong bg-surface'>
        <i className='bi bi-code-slash text-2xl text-tertiary' />
      </div>
      <div className='text-center'>
        <p className='text-[13px] text-secondary mb-2'>
          No file open
        </p>
        <button
          onClick={onOpenFolder}
          className='rounded border border-subtle-strong bg-surface px-3 py-1.5 text-[11px] text-secondary hover:text-primary hover:bg-hover transition-colors'
        >
          Open Folder
        </button>
      </div>
    </div>
  );
}
