import { useState, useMemo } from "react";

interface ImageViewerProps {
  path: string;
  name: string;
  content?: string;
}

export default function ImageViewer({ path, name, content }: ImageViewerProps) {
  const [scale, setScale] = useState(1);

  const imgSrc = useMemo(() => {
    if (!content) return "";
    if (content.startsWith("data:")) return content;

    const trimmed = content.trim();
    if (trimmed.startsWith("<svg") || trimmed.startsWith("<?xml")) {
      return `data:image/svg+xml;utf8,${encodeURIComponent(trimmed)}`;
    }

    const ext = name.split(".").pop()?.toLowerCase() ?? "";

    if (ext === "svg") {
      return `data:image/svg+xml;base64,${content}`;
    } else if (
      ["png", "jpg", "jpeg", "gif", "webp", "bmp", "ico"].includes(ext)
    ) {
      const mimeType = ext === "jpg" ? "jpeg" : ext;
      return `data:image/${mimeType};base64,${content}`;
    }

    return content;
  }, [content, name]);

  return (
    <div className='w-full h-full bg-canvas flex flex-col select-none'>
      <div className='h-9 border-b border-subtle bg-panel flex items-center justify-between px-4 text-[11px] text-tertiary shrink-0'>
        <span className='truncate max-w-62.5 font-mono text-secondary'>
          {name}
        </span>

        <div className='flex items-center gap-3'>
          <button
            onClick={() => setScale((s) => Math.max(0.1, s - 0.15))}
            className='hover:text-primary transition-colors flex items-center'
            title='Zoom Out'
          >
            <i className='bi bi-zoom-out text-[13px]' />
          </button>

          <span className='font-mono min-w-11.25 text-center text-secondary'>
            {Math.round(scale * 100)}%
          </span>

          <button
            onClick={() => setScale((s) => Math.min(6, s + 0.15))}
            className='hover:text-primary transition-colors flex items-center'
            title='Zoom In'
          >
            <i className='bi bi-zoom-in text-[13px]' />
          </button>

          <div className='w-px h-3 bg-subtle' />

          <button
            onClick={() => setScale(1)}
            className='hover:text-primary text-[10px] uppercase tracking-wider font-semibold transition-colors'
          >
            Reset
          </button>
        </div>
      </div>

      <div className='flex-1 overflow-auto flex items-center justify-center p-8 relative design-checkerboard'>
        <style>{`
          .design-checkerboard {
            background-color: var(--bg-canvas);
            background-image: linear-gradient(45deg, var(--bg-surface) 25%, transparent 25%),
                              linear-gradient(-45deg, var(--bg-surface) 25%, transparent 25%),
                              linear-gradient(45deg, transparent 75%, var(--bg-surface) 75%),
                              linear-gradient(-45deg, transparent 75%, var(--bg-surface) 75%);
            background-size: 16px 16px;
            background-position: 0 0, 0 8px, 8px -8px, -8px 0px;
          }
        `}</style>

        {imgSrc && (
          <img
            src={imgSrc}
            alt={name}
            style={{ transform: `scale(${scale})` }}
            className='max-w-full max-h-full object-contain transition-transform duration-75 ease-out origin-center rounded'
          />
        )}
      </div>
    </div>
  );
}
