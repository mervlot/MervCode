import { footerLangMap } from "../../vars/footerLangMap";

const Footer = ({ fileType, line = 1, column = 1 }: { fileType: string; line: number; column: number }) => {
  const langLabel = footerLangMap[fileType as keyof typeof footerLangMap] || "Plain Text";

  return (
    <footer className="w-full h-6 bg-[#0e0e1c] border-t border-white/5 flex items-center justify-between px-3 text-[10.5px] text-white/40 select-none shrink-0">
      {/* LEFT */}
      <div className="flex items-center gap-3">
        {/* git / errors */}
        <div className="flex items-center gap-1.5">
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <circle
              cx="5.5"
              cy="5.5"
              r="4.5"
              stroke="currentColor"
              strokeWidth="1.1"
            />
            <path
              d="M3.5 5.5h4M5.5 3.5v4"
              stroke="currentColor"
              strokeWidth="1.1"
              strokeLinecap="round"
            />
          </svg>
          <span>A 4</span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <circle
              cx="5.5"
              cy="5.5"
              r="4.5"
              stroke="currentColor"
              strokeWidth="1.1"
            />
            <path
              d="M5.5 3.5v3M5.5 7.5v.5"
              stroke="currentColor"
              strokeWidth="1.1"
              strokeLinecap="round"
            />
          </svg>
          <span>0</span>
        </div>

        <div className="w-px h-3 bg-white/10" />

        <div className="flex items-center gap-1">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path
              d="M1 5l2.5 2.5L9 2"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>Live share</span>
        </div>

        <div className="w-px h-3 bg-white/10" />

        <span className="text-white/25">● Auto saved: 5 min ago</span>
      </div>

      {/* RIGHT */}
      <div className="flex items-center gap-3">
        <span>{langLabel} 3.8.5 64-bit</span>

        <div className="w-px h-3 bg-white/10" />

        <span>
          Ln {line}, Col {column}
        </span>

        <div className="w-px h-3 bg-white/10" />

        <span>Spaces: 4</span>

        <div className="w-px h-3 bg-white/10" />

        <span className="text-white/50">UTF-8</span>

        <span className="text-white/50">CRLF</span>

        <span className="text-purple-400/80">{langLabel}</span>
      </div>
    </footer>
  );
};

export default Footer;
