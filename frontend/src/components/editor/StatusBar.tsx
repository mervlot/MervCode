export default function StatusBar({ fileType = "txt", line = 1, column = 1 }) {
  return (
    <footer className='flex h-7 items-center justify-between border-t border-white/5 bg-[#11121d] px-3 text-[10.5px] text-white/45'>
      <div className='flex items-center gap-3'>
        <span className='rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-300'>
          ● Live
        </span>
        <span>{fileType.toUpperCase()}</span>
        <span className='text-white/20'>•</span>
        <span>Spaces: 2</span>
      </div>
      <div className='flex items-center gap-3'>
        <span>
          Ln {line}, Col {column}
        </span>
        <span className='text-white/20'>•</span>
        <span>UTF-8</span>
        <span className='text-white/20'>•</span>
        <span className='text-purple-300'>MervCode</span>
      </div>
    </footer>
  );
}
