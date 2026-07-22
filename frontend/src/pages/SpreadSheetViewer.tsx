import { useMemo, useState } from "react";

interface SpreadsheetViewerProps {
  content?: string;
  name: string;
}

export default function SpreadsheetViewer({
  content = "",
  name,
}: SpreadsheetViewerProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const { headers, rows } = useMemo(() => {
    if (!content) return { headers: [], rows: [] };

    const isTsv = name.endsWith(".tsv");
    const delimiter = isTsv ? "\t" : ",";

    const lines = content.split(/\r?\n/).filter((line) => line.trim() !== "");
    if (lines.length === 0) return { headers: [], rows: [] };

    const parseLine = (line: string) => {
      return line
        .split(delimiter)
        .map((cell) => cell.replace(/^["']|["']$/g, "").trim());
    };

    const [headerLine, ...dataLines] = lines;
    if (!headerLine) return { headers: [], rows: [] };

    const headers = parseLine(headerLine);
    const rows = dataLines.map((line) => parseLine(line));

    return { headers, rows };
  }, [content, name]);

  const filteredRows = useMemo(() => {
    if (!searchQuery) return rows;
    const query = searchQuery.toLowerCase();
    return rows.filter((row) =>
      row.some((cell) => cell.toLowerCase().includes(query)),
    );
  }, [rows, searchQuery]);

  function getColumnLabel(index: number): string {
    let label = "";
    while (index >= 0) {
      label = String.fromCharCode((index % 26) + 65) + label;
      index = Math.floor(index / 26) - 1;
    }
    return label;
  }

  return (
    <div className='w-full h-full bg-canvas flex flex-col text-white/80 select-text'>
      <div className='h-10 border-b border-subtle bg-panel flex items-center justify-between px-3 shrink-0'>
        <div className='flex items-center gap-2 text-[11px] text-tertiary'>
          <i className='bi bi-table text-[13px] text-success' />
          <span className='text-secondary font-medium truncate max-w-45'>
            {name}
          </span>
          <span className='text-faint'>|</span>
          <span>{rows.length} rows</span>
          <span>{headers.length} columns</span>
        </div>

        <div className='relative flex items-center'>
          <i className='bi bi-search text-[12px] absolute left-2.5 text-faint' />
          <input
            type='text'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder='Filter...'
            className='h-6 w-48 bg-surface border border-subtle-strong rounded px-2 pl-7 text-[11px] text-primary placeholder-faint outline-none focus:border-accent transition-colors'
          />
        </div>
      </div>

      <div className='flex-1 overflow-auto relative'>
        {headers.length === 0 ? (
          <div className='h-full flex flex-col items-center justify-center text-faint text-xs gap-1.5'>
            <i className='bi bi-grid text-2xl' />
            Dataset is empty or invalid
          </div>
        ) : (
          <table className='w-full border-collapse text-left font-sans text-[11.5px] table-fixed'>
            <thead>
              <tr className='bg-panel sticky top-0 z-20 shadow-[0_1px_0_rgba(255,255,255,0.05)]'>
                <th className='w-12 bg-panel text-center border-r border-b border-subtle text-[9px] text-faint font-bold select-none h-6'></th>
                {headers.map((_, idx) => (
                  <th
                    key={idx}
                    className='px-3 border-r border-b border-subtle text-[9px] text-tertiary font-bold h-6 bg-panel select-none min-w-32.5'
                  >
                    {getColumnLabel(idx)}
                  </th>
                ))}
              </tr>
              <tr className='bg-panel sticky top-6 z-10 shadow-[0_1px_0_rgba(255,255,255,0.05)]'>
                <th className='w-12 text-center border-r border-b border-subtle text-[10px] text-faint font-mono select-none h-7 bg-panel'>
                  #
                </th>
                {headers.map((header, idx) => (
                  <th
                    key={idx}
                    className='px-3 border-r border-b border-subtle text-[11px] text-secondary font-semibold truncate h-7 bg-panel min-w-32.5'
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, rIdx) => (
                <tr
                  key={rIdx}
                  className='hover:bg-hover border-b border-subtle transition-colors group'
                >
                  <td className='w-12 text-center bg-surface border-r border-subtle text-[10px] font-mono text-faint group-hover:text-tertiary select-none h-7 sticky left-0 z-0'>
                    {rIdx + 1}
                  </td>
                  {row.map((cell, cIdx) => (
                    <td
                      key={cIdx}
                      className='px-3 border-r border-subtle truncate max-w-55 h-7 text-secondary font-mono whitespace-nowrap overflow-hidden text-ellipsis hover:bg-hover hover:text-primary transition-colors'
                      title={cell}
                    >
                      {cell}
                    </td>
                  ))}
                  {row.length < headers.length &&
                    Array.from({ length: headers.length - row.length }).map(
                      (_, idx) => (
                        <td
                          key={`pad-${idx}`}
                          className='px-3 border-r border-subtle h-7'
                        />
                      ),
                    )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
