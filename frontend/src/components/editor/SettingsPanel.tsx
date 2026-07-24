import type { EditorSettings } from "../../types";

interface SettingsPanelProps {
  settings: EditorSettings;
  onSettingsChange: (patch: Partial<EditorSettings>) => void;
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
  settings,
  onSettingsChange,
}: SettingsPanelProps) {
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
            <div>
              <div className='flex items-center justify-between mb-1.5'>
                <p className='text-[12.5px] text-primary'>Editor font size</p>
                <span className='text-[11px] text-tertiary tabular-nums'>
                  {settings.fontSize}px
                </span>
              </div>
              <input
                type='range'
                min={10}
                max={22}
                value={settings.fontSize}
                onChange={(e) => onSettingsChange({ fontSize: Number(e.target.value) })}
                className='w-full accent-[#DC143C]'
              />
            </div>

            <div>
              <div className='flex items-center justify-between mb-1.5'>
                <p className='text-[12.5px] text-primary'>Tab size</p>
                <span className='text-[11px] text-tertiary tabular-nums'>
                  {settings.tabSize}
                </span>
              </div>
              <input
                type='range'
                min={1}
                max={8}
                value={settings.tabSize}
                onChange={(e) => onSettingsChange({ tabSize: Number(e.target.value) })}
                className='w-full accent-[#DC143C]'
              />
            </div>
          </div>
        </section>

        <section>
          <h3 className='mb-2 text-[11px] uppercase tracking-wider text-faint'>
            Editor
          </h3>
          <div className='rounded border border-subtle bg-surface p-3 space-y-3'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-[12.5px] text-primary'>Insert spaces</p>
                <p className='text-[11px] text-tertiary'>Use spaces when pressing Tab.</p>
              </div>
              <Toggle
                checked={settings.insertSpaces}
                onChange={() => onSettingsChange({ insertSpaces: !settings.insertSpaces })}
              />
            </div>

            <div className='flex items-center justify-between'>
              <div>
                <p className='text-[12.5px] text-primary'>Word wrap</p>
              </div>
              <select
                value={settings.wordWrap}
                onChange={(e) => onSettingsChange({ wordWrap: e.target.value as EditorSettings["wordWrap"] })}
                className='bg-chip border border-subtle rounded px-2 py-1 text-[11px] text-primary'
              >
                <option value='off'>Off</option>
                <option value='on'>On</option>
                <option value='wordWrapColumn'>Column</option>
                <option value='bounded'>Bounded</option>
              </select>
            </div>

            <div className='flex items-center justify-between'>
              <div>
                <p className='text-[12.5px] text-primary'>Minimap</p>
              </div>
              <Toggle
                checked={settings.minimap}
                onChange={() => onSettingsChange({ minimap: !settings.minimap })}
              />
            </div>

            <div className='flex items-center justify-between'>
              <div>
                <p className='text-[12.5px] text-primary'>Font ligatures</p>
              </div>
              <Toggle
                checked={settings.fontLigatures}
                onChange={() => onSettingsChange({ fontLigatures: !settings.fontLigatures })}
              />
            </div>

            <div className='flex items-center justify-between'>
              <div>
                <p className='text-[12.5px] text-primary'>Line numbers</p>
              </div>
              <select
                value={settings.lineNumbers}
                onChange={(e) => onSettingsChange({ lineNumbers: e.target.value as EditorSettings["lineNumbers"] })}
                className='bg-chip border border-subtle rounded px-2 py-1 text-[11px] text-primary'
              >
                <option value='on'>On</option>
                <option value='off'>Off</option>
                <option value='relative'>Relative</option>
                <option value='interval'>Interval</option>
              </select>
            </div>
          </div>
        </section>

        <section>
          <h3 className='mb-2 text-[11px] uppercase tracking-wider text-faint'>
            Formatting
          </h3>
          <div className='rounded border border-subtle bg-surface p-3 space-y-3'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-[12.5px] text-primary'>Auto save</p>
                <p className='text-[11px] text-tertiary'>Save after 1s of inactivity.</p>
              </div>
              <Toggle
                checked={settings.autoSave}
                onChange={() => onSettingsChange({ autoSave: !settings.autoSave })}
              />
            </div>

            <div className='flex items-center justify-between'>
              <div>
                <p className='text-[12.5px] text-primary'>Format on save</p>
                <p className='text-[11px] text-tertiary'>Format document on save.</p>
              </div>
              <Toggle
                checked={settings.formatOnSave}
                onChange={() => onSettingsChange({ formatOnSave: !settings.formatOnSave })}
              />
            </div>

            <div className='flex items-center justify-between'>
              <div>
                <p className='text-[12.5px] text-primary'>Format on paste</p>
              </div>
              <Toggle
                checked={settings.formatOnPaste}
                onChange={() => onSettingsChange({ formatOnPaste: !settings.formatOnPaste })}
              />
            </div>

            <div className='flex items-center justify-between'>
              <div>
                <p className='text-[12.5px] text-primary'>Format on type</p>
              </div>
              <Toggle
                checked={settings.formatOnType}
                onChange={() => onSettingsChange({ formatOnType: !settings.formatOnType })}
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
