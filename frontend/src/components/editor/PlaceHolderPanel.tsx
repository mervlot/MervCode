interface PlaceholderPanelProps {
  activeTab: string;
  onBack: () => void;
}

export default function PlaceholderPanel({
  activeTab,
  onBack,
}: PlaceholderPanelProps) {
  const panelName = activeTab.replace(/-/g, " ");
  return (
    <div className='h-full bg-panel flex flex-col'>
      <div className='flex items-center justify-between px-3 py-2 border-b border-subtle text-[11px] uppercase tracking-wider text-tertiary'>
        <span>{panelName}</span>
        <button className='rounded p-1 hover:bg-hover text-[11px]' onClick={onBack}>
          Back
        </button>
      </div>
      <div className='flex-1 overflow-auto p-4 text-secondary'>
        <div className='rounded border border-subtle bg-surface p-4 space-y-3'>
          <div className='flex items-center gap-3'>
            <div className='flex h-10 w-10 items-center justify-center rounded bg-surface-2 text-tertiary'>
              <i className='bi bi-info-circle text-lg' />
            </div>
            <div>
              <p className='text-sm text-primary'>
                Not wired up yet
              </p>
              <p className='text-[12px] text-tertiary'>
                The {panelName} panel doesn't have a backend yet.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
