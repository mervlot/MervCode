import { motion } from "motion/react";

interface ToggleProps {
  checked: boolean;
  onChange: () => void;
  label?: string;
  desc?: string;
}

export default function Toggle({ checked, onChange, label, desc }: ToggleProps) {
  return (
    <div className='flex items-center justify-between py-2'>
      {(label || desc) && (
        <div>
          {label && <p className='text-sm font-medium text-primary'>{label}</p>}
          {desc && <p className='text-xs text-tertiary mt-0.5'>{desc}</p>}
        </div>
      )}
      <button
        onClick={onChange}
        className='relative w-11 h-6 rounded-full shrink-0 focus:outline-none focus:ring-2 focus:ring-[#DC143C]/40'
        style={{
          backgroundColor: checked ? "#DC143C" : "#2a2a2a",
          transition: "background-color 0.2s ease",
        }}
      >
        <motion.span
          layout
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className='absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm'
          style={{
            left: checked ? "calc(100% - 20px)" : "4px",
          }}
        />
      </button>
    </div>
  );
}
