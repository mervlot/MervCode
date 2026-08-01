import { motion } from "motion/react";

interface ToggleProps {
  checked: boolean;
  onChange: () => void;
  label?: string;
  desc?: string;
}

export default function Toggle({ checked, onChange, label, desc }: ToggleProps) {
  return (
    <div className='flex items-center justify-between gap-4 py-2.5'>
      {(label || desc) && (
        <div className='min-w-0'>
          {label && <p className='text-[13px] font-medium text-primary'>{label}</p>}
          {desc && <p className='text-[12px] text-tertiary mt-0.5 leading-snug'>{desc}</p>}
        </div>
      )}
      <button
        onClick={onChange}
        aria-pressed={checked}
        className='relative w-10 h-5.5 rounded-full shrink-0 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-(--border-focus)'
        style={{
          backgroundColor: checked ? "var(--accent)" : "var(--bg-surface-2)",
        }}
      >
        <motion.span
          layout
          transition={{ type: "spring", stiffness: 500, damping: 32 }}
          className='absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white shadow-sm'
          style={{
            left: checked ? "calc(100% - 20px)" : "2px",
          }}
        />
      </button>
    </div>
  );
}
