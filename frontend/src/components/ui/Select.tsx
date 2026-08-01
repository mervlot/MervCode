import { useState, useRef, useEffect } from "react";

interface Option {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  label?: string;
  desc?: string;
}

export default function Select({
  value,
  onChange,
  options,
  label,
  desc,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className='flex items-center justify-between gap-4 py-2.5'>
      {(label || desc) && (
        <div className='flex-1 min-w-0'>
          {label && <p className='text-[13px] font-medium text-primary'>{label}</p>}
          {desc && <p className='text-[12px] text-tertiary mt-0.5 leading-snug'>{desc}</p>}
        </div>
      )}
      <div ref={ref} className='relative shrink-0'>
        <button
          onClick={() => setOpen(!open)}
          className='flex items-center gap-2 px-3 py-1.5 min-w-36 text-[12.5px] text-primary bg-surface-2 border border-subtle rounded-lg hover:bg-(--bg-hover) hover:border-(--accent-border) transition-colors'
        >
          <span className='flex-1 text-left truncate'>{selected?.label ?? value}</span>
          <i
            className={`bi bi-chevron-down text-[10px] text-tertiary transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
        {open && (
          <div className='absolute top-full right-0 mt-1 min-w-full max-w-72 bg-surface border border-subtle-strong rounded-lg shadow-app z-50 py-1 overflow-hidden max-h-64 overflow-y-auto'>
            {options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`block w-full text-left px-3 py-1.5 text-[12.5px] transition-colors whitespace-nowrap ${
                  opt.value === value
                    ? "text-accent bg-accent-soft"
                    : "text-secondary hover:text-primary hover:bg-(--bg-hover)"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
