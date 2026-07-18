import type { ReactNode } from 'react';

interface Column {
  header: string;
  key: string;
  render?: (value: unknown, row: Record<string, unknown>) => ReactNode;
}

interface DocTableProps {
  columns: Column[];
  data: Record<string, unknown>[];
}

export function DocTable({ columns, data }: DocTableProps) {
  return (
    <div className="my-4 overflow-x-auto rounded-lg border border-[var(--color-glass-border)]">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--color-glass-border)] bg-white/[0.02]">
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-4 py-2.5 font-semibold text-[var(--color-muted)] text-xs uppercase tracking-wider"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-glass-border)]">
          {data.map((row, i) => (
            <tr key={i} className="transition-colors hover:bg-white/[0.01]">
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-2.5 text-sm text-[var(--color-muted)]">
                  {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: 'bg-green-900/30 text-green-400',
    POST: 'bg-yellow-900/30 text-yellow-400',
    PUT: 'bg-blue-900/30 text-blue-400',
    DELETE: 'bg-red-900/30 text-red-400',
    PATCH: 'bg-purple-900/30 text-purple-400',
  };
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${colors[method] ?? 'bg-black/30 text-[var(--color-muted)]'}`}
    >
      {method}
    </span>
  );
}
