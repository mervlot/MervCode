import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

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
    <div className='flex items-center justify-between py-2'>
      {(label || desc) && (
        <div className='flex-1 min-w-0 mr-4'>
          {label && <p className='text-sm font-medium text-primary'>{label}</p>}
          {desc && <p className='text-xs text-tertiary mt-0.5'>{desc}</p>}
        </div>
      )}
      <div ref={ref} className='relative shrink-0'>
        <button
          onClick={() => setOpen(!open)}
          className='flex items-center gap-2 px-3 py-1.5 min-w-[130px] text-sm text-primary bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg hover:border-[#DC143C]/40 transition-colors'
        >
          <span className='flex-1 text-left'>{selected?.label ?? value}</span>
          <ChevronDown
            size={14}
            className={`text-tertiary transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
        {open && (
          <div className='absolute top-full right-0 mt-1 min-w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-xl z-50 py-1 overflow-hidden'>
            {options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`block w-full text-left px-3 py-1.5 text-sm transition-colors ${
                  opt.value === value
                    ? "text-[#DC143C] bg-[#DC143C]/10"
                    : "text-secondary hover:text-primary hover:bg-white/5"
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
