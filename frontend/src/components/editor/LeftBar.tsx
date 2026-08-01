import tabs from "../../vars/sideBarTabs";

interface LeftBarProps {
  activeTab: string;
  onTabChange?: (tabId: string) => void;
  onOpenSettingsTab?: () => void;
}

export default function LeftBar({ activeTab, onTabChange, onOpenSettingsTab }: LeftBarProps) {
  const handleTabClick = (tabId: string) => {
    if (onTabChange) onTabChange(tabId);
  };

  return (
    <aside className='no-drag w-12 h-full border-r border-subtle bg-panel flex flex-col items-center select-none shrink-0'>
      <div className='flex-1 w-full flex flex-col items-center justify-center gap-7'>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              title={tab.label}
              className={`relative w-9 h-9 flex items-center justify-center rounded text-[15px] transition-all duration-100 ${
                isActive
                  ? "text-primary bg-active"
                  : "text-tertiary hover:text-secondary hover:bg-(--bg-hover)"
              }`}
            >
              <i className={tab.iconClass} />
              {isActive && (
                <div className='absolute left-0 top-2 bottom-2 w-0.5 bg-accent rounded-r' />
              )}
            </button>
          );
        })}
      </div>

      <div className='w-full flex flex-col items-center gap-1 py-3'>
        <button
          onClick={onOpenSettingsTab}
          title='Settings'
          className='relative w-9 h-9 flex items-center justify-center rounded text-[15px] transition-all duration-100 text-tertiary hover:text-secondary hover:bg-(--bg-hover)'
        >
          <i className='bi bi-gear' />
        </button>
      </div>
    </aside>
  );
}
