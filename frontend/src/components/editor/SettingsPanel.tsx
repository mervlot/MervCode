import { useTheme } from "../../contexts/ThemeContext";

interface SettingsPanelProps {
  fontSize: number;
  onFontSizeChange: (size: number) => void;
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      role='switch'
      aria-checked={checked}
      onClick={onChange}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
        checked ? "bg-accent" : "bg-chip"
      }`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-surface shadow transition-transform ${
          checked ? "translate-x-4.5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

export default function SettingsPanel({
  fontSize,
  onFontSizeChange,
}: SettingsPanelProps) {
  const { theme, setTheme } = useTheme();

  return (
    <div className='h-full flex flex-col overflow-hidden bg-panel'>
      <div className='flex items-center justify-between px-3 py-2 border-b border-subtle text-[11px] uppercase tracking-wider text-tertiary'>
        <span>Settings</span>
      </div>

      <div className='flex-1 overflow-auto p-3 space-y-4'>
        <section>
          <h3 className='mb-2 text-[11px] uppercase tracking-wider text-faint'>
            Appearance
          </h3>
          <div className='rounded border border-subtle bg-surface p-3 space-y-3'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-[12.5px] text-primary'>Light mode</p>
                <p className='text-[11px] text-tertiary'>
                  Switch between dark and light theme.
                </p>
              </div>
              <Toggle
                checked={theme === "light"}
                onChange={() => setTheme(theme === "dark" ? "light" : "dark")}
              />
            </div>

            <div>
              <div className='flex items-center justify-between mb-1.5'>
                <p className='text-[12.5px] text-primary'>Editor font size</p>
                <span className='text-[11px] text-tertiary tabular-nums'>
                  {fontSize}px
                </span>
              </div>
              <input
                type='range'
                min={10}
                max={22}
                value={fontSize}
                onChange={(e) => onFontSizeChange(Number(e.target.value))}
                className='w-full accent-[#DC143C]'
              />
            </div>
          </div>
        </section>

        <section>
          <h3 className='mb-2 text-[11px] uppercase tracking-wider text-faint'>
            Shortcuts
          </h3>
          <div className='rounded border border-subtle bg-surface divide-y divide-white/5'>
            {[
              ["Command Palette", "Ctrl+Shift+P"],
              ["Save File", "Ctrl+S"],
              ["Close Tab", "Ctrl+W"],
              ["Toggle Terminal", "Ctrl+`"],
              ["Toggle Sidebar", "Ctrl+B"],
              ["Next Tab", "Ctrl+Tab"],
            ].map(([label, keys]) => (
              <div
                key={label}
                className='flex items-center justify-between px-3 py-2 text-[12px]'
              >
                <span className='text-secondary'>{label}</span>
                <kbd className='rounded border border-subtle-strong px-1.5 py-0.5 text-[10px] text-tertiary'>
                  {keys}
                </kbd>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
