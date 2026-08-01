import { useCallback, useRef, useState } from "react";

interface SliderProps {
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  label?: string;
  desc?: string;
  suffix?: string;
}

export default function Slider({
  min,
  max,
  step = 1,
  value,
  onChange,
  label,
  desc,
  suffix = "",
}: SliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const pct = ((value - min) / (max - min)) * 100;

  const updateFromClient = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      let p = (clientX - rect.left) / rect.width;
      p = Math.max(0, Math.min(1, p));
      const val = Math.round((min + p * (max - min)) / step) * step;
      onChange(Math.round(val * 100) / 100);
    },
    [min, max, step, onChange],
  );

  const handlePointerDown = (e: React.PointerEvent) => {
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updateFromClient(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    updateFromClient(e.clientX);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  return (
    <div className='flex items-center justify-between gap-4 py-2.5'>
      {(label || desc) && (
        <div className='flex-1 min-w-0'>
          {label && <p className='text-[13px] font-medium text-primary'>{label}</p>}
          {desc && <p className='text-[12px] text-tertiary mt-0.5 leading-snug'>{desc}</p>}
        </div>
      )}
      <div className='flex items-center gap-3 shrink-0'>
        <div
          ref={trackRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className='relative w-28 h-6 flex items-center cursor-pointer select-none'
        >
          <div className='absolute w-full h-1 rounded-full bg-surface-2 overflow-hidden'>
            <div
              className='h-full rounded-full'
              style={{
                width: `${pct}%`,
                backgroundColor: "var(--accent)",
              }}
            />
          </div>
          <div
            className='absolute w-4 h-4 rounded-full bg-white shadow-md pointer-events-none'
            style={{
              left: `calc(${pct}% - 8px)`,
              transition: dragging ? "none" : "left 0.1s ease",
              boxShadow: dragging
                ? "0 0 0 6px var(--accent-soft-strong)"
                : "0 1px 3px var(--shadow-color)",
            }}
          />
        </div>
        <span className='text-[12.5px] text-secondary w-12 text-right tabular-nums'>
          {value}
          {suffix}
        </span>
      </div>
    </div>
  );
}
