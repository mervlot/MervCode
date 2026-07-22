import { useEffect, useMemo, useRef, useState } from "react";

export interface Command {
  id: string;
  label: string;
  category?: string;
  shortcut?: string;
  icon?: string;
  run: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  commands: Command[];
}

function fuzzyScore(query: string, target: string): number {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (!q) return 1;
  if (t.includes(q)) return 100 - t.indexOf(q);
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length ? 10 : -1;
}

export default function CommandPalette({
  open,
  onClose,
  commands,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery(">");
      setActiveIndex(0);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.setSelectionRange(1, 1);
      });
    }
  }, [open]);

  const searchQuery = query.startsWith(">") ? query.slice(1).trim() : query;

  const filtered = useMemo(() => {
    return commands
      .map((cmd) => ({ cmd, score: fuzzyScore(searchQuery, cmd.label) }))
      .filter((entry) => entry.score >= 0)
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.cmd);
  }, [commands, searchQuery]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!open) return null;

  function runActive() {
    const target = filtered[activeIndex];
    if (target) {
      onClose();
      target.run();
    }
  }

  return (
    <div className='fixed inset-0 z-50' onClick={onClose}>
      <div className='mx-auto mt-[10vh] w-full max-w-[520px]'>
        <div
          onClick={(e) => e.stopPropagation()}
          className='rounded-lg border border-subtle-strong bg-surface shadow-app overflow-hidden'
        >
          <div className='flex items-center gap-2 px-3 h-10'>
            <i className='bi bi-chevron-right text-[12px] text-tertiary' />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                const val = e.target.value;
                if (!val.startsWith(">")) {
                  setQuery(">" + val.replace(/^>+/, ""));
                } else {
                  setQuery(val);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActiveIndex((i) => Math.max(i - 1, 0));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  runActive();
                } else if (e.key === "Escape") {
                  onClose();
                }
              }}
              placeholder='Type a command...'
              className='flex-1 bg-transparent text-[13px] text-primary placeholder-faint outline-none'
            />
            <kbd className='rounded border border-subtle-strong px-1.5 py-0.5 text-[10px] text-tertiary'>
              Esc
            </kbd>
          </div>

          {filtered.length > 0 && (
            <div className='border-t border-subtle max-h-72 overflow-auto py-1'>
              {filtered.map((cmd, idx) => (
                <button
                  key={cmd.id}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => {
                    onClose();
                    cmd.run();
                  }}
                  className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[12.5px] transition-colors ${
                    idx === activeIndex
                      ? "bg-accent-soft text-primary"
                      : "text-secondary hover:bg-hover"
                  }`}
                >
                  <i className={`bi bi-${cmd.icon ?? "chevron-right"} text-[12px] text-tertiary w-4 text-center`} />
                  <span className='flex-1 truncate'>{cmd.label}</span>
                  {cmd.category && (
                    <span className='text-[10px] uppercase tracking-wider text-faint'>
                      {cmd.category}
                    </span>
                  )}
                  {cmd.shortcut && (
                    <kbd className='rounded border border-subtle-strong px-1.5 py-0.5 text-[10px] text-tertiary'>
                      {cmd.shortcut}
                    </kbd>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
