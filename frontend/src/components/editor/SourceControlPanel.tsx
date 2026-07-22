import { useCallback, useEffect, useState } from "react";
import { GitStatus } from "../../../wailsjs/go/main/App";

interface GitFileStatus {
  path: string;
  rel: string;
  status: string;
}

interface GitStatusResult {
  isRepo: boolean;
  branch: string;
  files: GitFileStatus[];
}

interface SourceControlPanelProps {
  rootPath?: string | null;
  onFileOpen: (path: string) => void;
}

function statusMeta(status: string) {
  if (status.includes("A"))
    return { label: "A", color: "text-success", title: "Added" };
  if (status.includes("D"))
    return { label: "D", color: "text-danger", title: "Deleted" };
  if (status.includes("R"))
    return { label: "R", color: "text-accent", title: "Renamed" };
  if (status === "??")
    return { label: "U", color: "text-tertiary", title: "Untracked" };
  return { label: "M", color: "text-warning", title: "Modified" };
}

export default function SourceControlPanel({
  rootPath,
  onFileOpen,
}: SourceControlPanelProps) {
  const [status, setStatus] = useState<GitStatusResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!rootPath) {
      setStatus(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await GitStatus(rootPath);
      setStatus(result);
    } catch {
      setError("Couldn't read git status.");
    } finally {
      setLoading(false);
    }
  }, [rootPath]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className='h-full flex flex-col overflow-hidden bg-panel'>
      <div className='flex items-center justify-between px-3 py-2 border-b border-subtle text-[11px] uppercase tracking-wider text-tertiary'>
        <span>Source Control</span>
        <button
          onClick={() => void refresh()}
          title='Refresh'
          className='rounded p-1 hover:bg-hover'
        >
          <i className='bi bi-arrow-clockwise text-[12px]' />
        </button>
      </div>

      <div className='flex-1 overflow-auto'>
        {!rootPath && (
          <div className='px-4 py-6 text-center text-[11px] text-faint'>
            Open a folder to see its source control status.
          </div>
        )}

        {rootPath && loading && !status && (
          <div className='px-4 py-6 text-center text-[11px] text-tertiary'>
            Checking repository...
          </div>
        )}

        {error && (
          <div className='px-4 py-3 text-[11px] text-danger'>{error}</div>
        )}

        {rootPath && status && !status.isRepo && (
          <div className='px-4 py-6 text-center text-[11px] text-faint'>
            This folder isn't a git repository.
          </div>
        )}

        {status?.isRepo && (
          <>
            <div className='flex items-center gap-2 px-3 py-2 text-[11.5px] text-secondary border-b border-subtle'>
              <i className='bi bi-git text-[12px] text-tertiary' />
              <span className='truncate'>{status.branch || "detached"}</span>
            </div>

            {status.files.length === 0 ? (
              <div className='px-4 py-6 text-center text-[11px] text-faint'>
                No changes.
              </div>
            ) : (
              <div className='py-1'>
                <div className='px-3 py-1 text-[10px] uppercase tracking-wider text-faint'>
                  Changes ({status.files.length})
                </div>
                {status.files.map((file) => {
                  const meta = statusMeta(file.status);
                  return (
                    <button
                      key={file.path}
                      onClick={() => onFileOpen(file.path)}
                      title={file.rel}
                      className='flex w-full items-center gap-2 px-3 py-1 text-left text-[12px] hover:bg-hover transition-colors'
                    >
                      <span
                        className={`w-4 shrink-0 text-center text-[10px] font-bold ${meta.color}`}
                        title={meta.title}
                      >
                        {meta.label}
                      </span>
                      <span className='truncate text-secondary'>
                        {file.rel}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
