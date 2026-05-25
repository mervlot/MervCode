import { footerLangMap } from "../../vars/footerLangMap";

const Footer = ({ fileType, line = 1, column = 1 }) => {
  return (
    <footer
      className="
        w-full
        h-7
        bg-[#0b0b0b]
        border-t
        border-cyan-500/10
        flex
        items-center
        justify-between
        px-4
        text-[11px]
        text-white/60
        shrink-0
      "
    >
      {/* LEFT */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1">
          <span className="text-cyan-400">●</span>

          <span className="uppercase tracking-wide">
            {footerLangMap[fileType] || "Unknown"}
          </span>
        </div>
      </div>

      {/* RIGHT */}
      <div className="flex items-center gap-4">
        <span>
          Ln {line}, Col {column}
        </span>

        <span className="text-cyan-400/70">UTF-8</span>

        <span className="text-cyan-400/70">LF</span>
      </div>
    </footer>
  );
};

export default Footer;
