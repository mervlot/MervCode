import type { FileTab } from "../../types";

const LANG_LABELS: Record<string, string> = {
  js: "JavaScript",
  ts: "TypeScript",
  jsx: "React JSX",
  tsx: "React TSX",
  py: "Python",
  go: "Go",
  rs: "Rust",
  html: "HTML",
  css: "CSS",
  json: "JSON",
  md: "Markdown",
  csv: "CSV",
  tsv: "TSV",
};

interface ToolbarProps {
  activeFile: FileTab | undefined;
}

export default function Toolbar({
  activeFile,
}: ToolbarProps) {
  const ext = activeFile?.name.split(".").pop()?.toLowerCase() ?? "txt";
  const lang = LANG_LABELS[ext] ?? ext.toUpperCase();

  const segments = activeFile?.path
    ? activeFile.path.split(/[\\/]/).filter(Boolean)
    : [];
  const crumbs = segments.slice(-4);

  return (
    <div className='h-9 w-full bg-panel border-b border-subtle flex items-center justify-between px-3 shrink-0 gap-2'>
      <div className='flex items-center gap-1 text-[11px] text-tertiary min-w-0'>
        {activeFile ? (
          <>
            <i className='bi bi-folder2 text-[12px] text-tertiary' />
            {crumbs.map((segment, idx) => {
              const isLast = idx === crumbs.length - 1;
              return (
                <span key={idx} className='flex items-center gap-1 min-w-0'>
                  {idx > 0 && <span className='text-faint'>/</span>}
                  <span
                    className={`truncate ${isLast ? "text-secondary" : "text-tertiary"}`}
                  >
                    {segment}
                  </span>
                </span>
              );
            })}
          </>
        ) : (
          <span className='text-faint'>No file open</span>
        )}
      </div>

      <div className='flex items-center gap-2'>
        <span className='flex items-center gap-1 px-2 h-6 rounded text-[11px] text-tertiary bg-surface border border-subtle'>
          <i className='bi bi-code-slash text-[10px]' />
          {lang}
        </span>
      </div>
    </div>
  );
}
