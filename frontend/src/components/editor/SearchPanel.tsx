import { useEffect, useRef, useState } from "react";
import { SearchInWorkspace } from "../../../wailsjs/go/main/App";

interface SearchMatch {
  path: string;
  line: number;
  column: number;
  preview: string;
}

interface SearchPanelProps {
  rootPath?: string | null;
  onResultOpen: (path: string, line: number) => void;
}

export default function SearchPanel({
  rootPath,
  onResultOpen,
}: SearchPanelProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim() || !rootPath) {
      setResults([]);
      setError(null);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const matches = await SearchInWorkspace(rootPath, query);
        setResults(matches ?? []);
      } catch {
        setError("Search failed.");
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, rootPath]);

  const grouped = results.reduce<Record<string, SearchMatch[]>>(
    (acc, match) => {
      (acc[match.path] ??= []).push(match);
      return acc;
    },
    {},
  );

  return (
    <div className='h-full flex flex-col overflow-hidden bg-panel'>
      <div className='flex items-center justify-between px-3 py-2 border-b border-subtle text-[11px] uppercase tracking-wider text-tertiary'>
        <span>Search</span>
      </div>

      <div className='p-2 border-b border-subtle'>
        <div className='relative flex items-center'>
          <i className='bi bi-search text-[12px] absolute left-2.5 text-faint' />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              rootPath ? "Search in workspace..." : "Open a folder to search"
            }
            disabled={!rootPath}
            className='w-full h-7 bg-surface border border-subtle-strong rounded pl-7 pr-2 text-[12px] text-primary placeholder-faint outline-none focus:border-accent transition-colors disabled:opacity-40'
          />
        </div>
      </div>

      <div className='flex-1 overflow-auto px-1 py-1'>
        {loading && (
          <div className='px-3 py-2 text-[11px] text-tertiary'>
            Searching...
          </div>
        )}
        {error && (
          <div className='px-3 py-2 text-[11px] text-danger'>{error}</div>
        )}
        {!loading && !error && query && results.length === 0 && (
          <div className='px-3 py-2 text-[11px] text-tertiary'>
            No results for "{query}"
          </div>
        )}

        {Object.entries(grouped).map(([path, matches]) => {
          const name = path.split(/[\\/]/).pop() ?? path;
          return (
            <div key={path} className='mb-1'>
              <div className='flex items-center gap-1.5 px-2 py-1 text-[11px] text-secondary font-medium truncate'>
                <i className='bi bi-file-earmark text-[11px] text-tertiary' />
                <span className='truncate'>{name}</span>
                <span className='text-faint'>({matches.length})</span>
              </div>
              {matches.map((m, idx) => (
                <button
                  key={`${path}-${idx}`}
                  onClick={() => onResultOpen(path, m.line)}
                  className='flex w-full items-start gap-2 rounded px-3 py-1 text-left text-[11px] hover:bg-hover transition-colors'
                >
                  <span className='mt-0.5 shrink-0 text-faint tabular-nums w-6 text-right'>
                    {m.line}
                  </span>
                  <span className='truncate text-tertiary font-mono'>
                    {m.preview}
                  </span>
                </button>
              ))}
            </div>
          );
        })}

        {!query && rootPath && (
          <div className='px-3 py-6 text-center text-[11px] text-faint'>
            Type to search file contents across the workspace.
          </div>
        )}
      </div>
    </div>
  );
}
