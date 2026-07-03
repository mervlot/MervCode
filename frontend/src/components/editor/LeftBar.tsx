import tabs from "../../vars/sideBarTabs";

interface LeftBarProps {
  activeTab: string;
  onTabChange?: (tabId: string) => void;
}

export default function LeftBar({ activeTab, onTabChange }: LeftBarProps) {
  const handleTabClick = (tabId: string) => {
    if (onTabChange) onTabChange(tabId);
  };

  return (
    <aside className='no-drag w-12 h-full border-r border-white/5 bg-[#12121f] flex flex-col items-center justify-between py-2 select-none shrink-0'>
      {/* TOP — home icon */}
      <div className='w-full flex flex-col items-center gap-0.5'>
        <button
          title='Home'
          className='w-9 h-9 flex items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/8 transition-all mb-1'
        >
          <svg width='16' height='16' viewBox='0 0 16 16' fill='none'>
            <path
              d='M2 6.5L8 2l6 4.5V14H10v-3H6v3H2V6.5z'
              stroke='currentColor'
              strokeWidth='1.3'
              strokeLinejoin='round'
            />
          </svg>
        </button>

        {/* Divider */}
        <div className='w-6 h-px bg-white/8 mb-1' />

        {/* Nav tabs */}
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              title={tab.label}
              className={`
                relative w-9 h-9 flex items-center justify-center rounded-lg text-base
                transition-all duration-150
                ${
                  isActive
                    ? "text-white bg-white/10"
                    : "text-white/35 hover:text-white/70 hover:bg-white/6"
                }
              `}
            >
              <i className={tab.iconClass} />
              {isActive && (
                <div className='absolute left-0 top-2 bottom-2 w-0.5 bg-purple-400 rounded-r' />
              )}
            </button>
          );
        })}
      </div>

      {/* BOTTOM — settings */}
      <div className='w-full flex flex-col items-center gap-1'>
        <button
          onClick={() => handleTabClick("settings")}
          title='Settings'
          className={`
            relative w-9 h-9 flex items-center justify-center rounded-lg text-base transition-all duration-150
            ${
              activeTab === "settings"
                ? "text-white bg-white/10"
                : "text-white/35 hover:text-white/70 hover:bg-white/6"
            }
          `}
        >
          <i className='bi bi-gear' />
          {activeTab === "settings" && (
            <div className='absolute left-0 top-2 bottom-2 w-0.5 bg-purple-400 rounded-r' />
          )}
        </button>
      </div>
    </aside>
  );
}
