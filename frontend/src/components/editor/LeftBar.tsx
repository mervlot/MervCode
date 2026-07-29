import { Settings } from "lucide-react";
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
    <aside className='no-drag w-12 h-full border-r border-subtle bg-panel flex flex-col items-center justify-between py-2 select-none shrink-0'>
      <div className='w-full flex flex-col items-center gap-0.5'>
        <button
          title='Home'
          className='w-5 h-6.7 flex items-center justify-center rounded text-secondary hover:text-primary hover:bg-hover transition-all mb-1'
        >
          <i className='bi  text-[15px]' />
        </button>

        <div className='w-full h-px mb-1' />

        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              title={tab.label}
              className={`
                relative w-9 h-9 flex my-6 items-center justify-center rounded text-[15px]
                transition-all duration-100
                ${
                  isActive
                    ? "text-primary bg-active"
                    : "text-tertiary hover:text-secondary hover:bg-hover"
                }
              `}
            >
              <i className={tab.iconClass} />
              {isActive && (
                <div className='absolute left-0 top-2 bottom-2 w-0.5 bg-accent rounded-r' />
              )}
            </button>
          );
        })}
      </div>

      <div className='w-full flex flex-col items-center gap-1'>
        <button
          onClick={onOpenSettingsTab}
          title='Settings'
          className={`
            relative w-9 h-9 flex items-center justify-center rounded text-[15px] transition-all duration-100
            text-tertiary hover:text-secondary hover:bg-hover
          `}
        >
          <Settings size={18} />
        </button>
      </div>
    </aside>
  );
}
