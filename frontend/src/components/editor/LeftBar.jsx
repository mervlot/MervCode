import { useState } from "react";
import tabs from "../../vars/sideBarTabs";

export default function LeftBar({ onTabChange }) {
  const [activeTab, setActiveTab] = useState("explorer");



  const handleTabClick = (tabId) => {
    setActiveTab(tabId);
    if (onTabChange) onTabChange(tabId);
  };

  return (
    <aside
      className="
        no-drag
        w-12
        h-[calc(100vh-2.5rem)]
        border-r
        border-cyan-500/20
        bg-[#050505]
        flex
        flex-col
        items-center
        justify-between
        py-2
        select-none
      "
    >
      {/* TOP NAVIGATION TABS */}
      <div className="w-full flex flex-col items-center gap-1">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              title={tab.label}
              className={`
                relative
                w-10
                h-10
                flex
                items-center
                justify-center
                rounded-md
                text-lg
                transition-all
                duration-200
                group
                ${isActive 
                  ? "text-cyan-400 bg-cyan-500/10" 
                  : "text-white/40 hover:text-white/80 hover:bg-white/5"
                }
              `}
            >
              <i className={tab.iconClass} />

              {/* Cyan indicator line on the left side of active button */}
              {isActive && (
                <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-cyan-400 rounded-r" />
              )}
            </button>
          );
        })}
      </div>

      {/* BOTTOM UTILITY TABS */}
      <div className="w-full flex flex-col items-center">
        <button
          onClick={() => handleTabClick("settings")}
          title="Settings"
          className={`
            relative
            w-10
            h-10
            flex
            items-center
            justify-center
            rounded-md
            text-lg
            transition-all
            duration-200
            ${activeTab === "settings" 
              ? "text-cyan-400 bg-cyan-500/10" 
              : "text-white/40 hover:text-white/80 hover:bg-white/5"
            }
          `}
        >
          <i className="bi bi-gear" />
          {activeTab === "settings" && (
            <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-cyan-400 rounded-r" />
          )}
        </button>
      </div>
    </aside>
  );
}