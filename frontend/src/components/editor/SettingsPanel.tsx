import { useMemo, useState } from "react";
import type { EditorSettings } from "../../types";
import Toggle from "../ui/Toggle";
import Slider from "../ui/Slider";
import Select from "../ui/Select";
import {
  SETTINGS_SECTIONS,
  ALL_SETTING_FIELDS,
  type SettingField,
} from "../../editor/settingsSchema";

interface SettingsPanelProps {
  settings: EditorSettings;
  onSettingsChange: (patch: Partial<EditorSettings>) => void;
}

const SHORTCUTS: [string, string][] = [
  ["Command Palette", "Ctrl+Shift+P"],
  ["Save File", "Ctrl+S"],
  ["Close Tab", "Ctrl+W"],
  ["Toggle Terminal", "Ctrl+`"],
  ["Toggle Sidebar", "Ctrl+B"],
  ["Next Tab", "Ctrl+Tab"],
  ["Toggle LSP Inspector", "Ctrl+Shift+L"],
  ["Command Palette (Settings)", "Ctrl+,"],
];

const SHORTCUTS_ID = "shortcuts";

function SettingControl({
  field,
  settings,
  onChange,
}: {
  field: SettingField;
  settings: EditorSettings;
  onChange: (patch: Partial<EditorSettings>) => void;
}) {
  switch (field.type) {
    case "toggle":
      return (
        <Toggle
          label={field.label}
          desc={field.description}
          checked={field.get(settings)}
          onChange={() => onChange(field.set(settings, !field.get(settings)))}
        />
      );
    case "slider":
      return (
        <Slider
          label={field.label}
          desc={field.description}
          min={field.min}
          max={field.max}
          {...(field.step !== undefined ? { step: field.step } : {})}
          {...(field.suffix !== undefined ? { suffix: field.suffix } : {})}
          value={field.get(settings)}
          onChange={(v) => onChange(field.set(settings, v))}
        />
      );
    case "select":
      return (
        <Select
          label={field.label}
          desc={field.description}
          value={field.get(settings)}
          options={field.options}
          onChange={(v) => onChange(field.set(settings, v))}
        />
      );
    default:
      return null;
  }
}

function GroupCard({
  title,
  fields,
  settings,
  onChange,
}: {
  title: string;
  fields: SettingField[];
  settings: EditorSettings;
  onChange: (patch: Partial<EditorSettings>) => void;
}) {
  return (
    <div className="mb-5">
      <h3 className="mb-2 px-0.5 text-[11px] font-semibold uppercase tracking-wider text-faint">
        {title}
      </h3>
      <div className="divide-y divide-(--border) rounded-xl border border-subtle bg-surface px-4">
        {fields.map((field) => (
          <SettingControl
            key={field.id}
            field={field}
            settings={settings}
            onChange={onChange}
          />
        ))}
      </div>
    </div>
  );
}

function ShortcutsSection() {
  return (
    <div className="mb-5">
      <h3 className="mb-2 px-0.5 text-[11px] font-semibold uppercase tracking-wider text-faint">
        Keyboard Shortcuts
      </h3>
      <div className="divide-y divide-(--border) rounded-xl border border-subtle bg-surface px-4">
        {SHORTCUTS.map(([label, keys]) => (
          <div
            key={label}
            className="flex items-center justify-between gap-4 py-2.5"
          >
            <span className="text-[13px] text-secondary">{label}</span>
            <kbd className="shrink-0 rounded border border-subtle-strong px-1.5 py-0.5 text-[11px] text-tertiary">
              {keys}
            </kbd>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SettingsPanel({
  settings,
  onSettingsChange,
}: SettingsPanelProps) {
  const [activeSectionId, setActiveSectionId] = useState(
    SETTINGS_SECTIONS[0]?.id ?? "editor",
  );
  const [searchQuery, setSearchQuery] = useState("");

  const isSearching = searchQuery.trim().length > 0;
  const query = searchQuery.toLowerCase().trim();

  const searchResults = useMemo(() => {
    if (!isSearching) return [];
    return ALL_SETTING_FIELDS.filter(({ field }) => {
      const haystack = `${field.label} ${field.description} ${field.id} ${field.keywords ?? ""}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [isSearching, query]);

  const searchGroups = useMemo(() => {
    const groups: {
      key: string;
      sectionLabel: string;
      groupTitle: string;
      fields: SettingField[];
    }[] = [];
    for (const r of searchResults) {
      const key = `${r.sectionId}::${r.groupTitle}`;
      const existing = groups.find((g) => g.key === key);
      if (existing) {
        existing.fields.push(r.field);
      } else {
        groups.push({
          key,
          sectionLabel: r.sectionLabel,
          groupTitle: r.groupTitle,
          fields: [r.field],
        });
      }
    }
    return groups;
  }, [searchResults]);

  const activeSection = SETTINGS_SECTIONS.find((s) => s.id === activeSectionId);

  function selectSection(id: string) {
    setActiveSectionId(id);
    setSearchQuery("");
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-canvas">
      {/* Header */}
      <div className="shrink-0 border-b border-subtle bg-panel px-5 py-3">
        <div className="mb-3 flex items-center gap-2">
          <i className="bi bi-gear text-[14px] text-accent" />
          <h1 className="text-[13px] font-semibold text-primary">Settings</h1>
        </div>
        <div className="relative">
          <i className="bi bi-search pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-tertiary" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search settings"
            className="w-full rounded-lg border border-subtle bg-surface py-1.5 pl-8 pr-8 text-[12.5px] text-primary outline-none transition-colors placeholder:text-tertiary focus:border-(--accent-border)"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-tertiary hover:text-primary"
            >
              <i className="bi bi-x-lg text-[11px]" />
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Table of contents */}
        <nav className="w-48 shrink-0 overflow-y-auto border-r border-subtle bg-panel py-2">
          {SETTINGS_SECTIONS.map((section) => (
            <button
              key={section.id}
              onClick={() => selectSection(section.id)}
              className={`mx-2 mb-0.5 flex w-[calc(100%-1rem)] items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] font-medium transition-colors ${
                !isSearching && activeSectionId === section.id
                  ? "bg-accent-soft text-accent"
                  : "text-secondary hover:bg-(--bg-hover) hover:text-primary"
              }`}
            >
              <i className={`bi ${section.icon} text-[13px]`} />
              {section.label}
            </button>
          ))}
          <div className="my-2 border-t border-subtle" />
          <button
            onClick={() => selectSection(SHORTCUTS_ID)}
            className={`mx-2 mb-0.5 flex w-[calc(100%-1rem)] items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] font-medium transition-colors ${
              !isSearching && activeSectionId === SHORTCUTS_ID
                ? "bg-accent-soft text-accent"
                : "text-secondary hover:bg-(--bg-hover) hover:text-primary"
            }`}
          >
            <i className="bi bi-keyboard text-[13px]" />
            Shortcuts
          </button>
        </nav>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-2xl px-6 py-5">
            {isSearching ? (
              searchGroups.length > 0 ? (
                searchGroups.map((g) => (
                  <div key={g.key} className="mb-5">
                    <h3 className="mb-2 px-0.5 text-[11px] font-semibold uppercase tracking-wider text-faint">
                      {g.sectionLabel} &rsaquo; {g.groupTitle}
                    </h3>
                    <div className="divide-y divide-(--border) rounded-xl border border-subtle bg-surface px-4">
                      {g.fields.map((field) => (
                        <SettingControl
                          key={field.id}
                          field={field}
                          settings={settings}
                          onChange={onSettingsChange}
                        />
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-tertiary">
                  <i className="bi bi-search mb-3 text-[28px] opacity-40" />
                  <p className="text-[13px]">
                    No results for &ldquo;{searchQuery}&rdquo;
                  </p>
                  <button
                    onClick={() => setSearchQuery("")}
                    className="mt-2 text-[12px] text-accent hover:underline"
                  >
                    Clear search
                  </button>
                </div>
              )
            ) : activeSectionId === SHORTCUTS_ID ? (
              <ShortcutsSection />
            ) : (
              activeSection?.groups.map((group) => (
                <GroupCard
                  key={group.title}
                  title={group.title}
                  fields={group.fields}
                  settings={settings}
                  onChange={onSettingsChange}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
