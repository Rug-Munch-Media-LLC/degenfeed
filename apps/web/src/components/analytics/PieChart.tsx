'use client';

import { formatCompact } from './utils';

export function PieChart({
  data,
  colorMap,
  size = 160,
}: {
  data: Record<string, number>;
  colorMap: Record<string, string>;
  size?: number;
}) {
  const total = Object.values(data).reduce((s, v) => s + v, 0);
  if (total === 0)
    return (
      <div
        className="flex items-center justify-center text-xs text-[var(--color-muted)]"
        style={{ width: size, height: size }}
      >
        No data
      </div>
    );

  const segments = Object.entries(data).filter(([, v]) => v > 0);
  const conic = segments
    .reduce(
      (acc, [key, val], i) => {
        const pct = (val / total) * 360;
        const start = i === 0 ? 0 : acc.reduce((s, [, p]) => s + p, 0);
        const end = start + pct;
        acc.push([key, pct, start, end] as [string, number, number, number]);
        return acc;
      },
      [] as [string, number, number, number][],
    )
    .map(([key, _pct, start, end]) => `${colorMap[key] || '#666'} ${start}deg ${end}deg`)
    .join(', ');

  return (
    <div className="flex items-center gap-6">
      <div
        className="shrink-0 rounded-full"
        style={{ width: size, height: size, background: `conic-gradient(${conic})` }}
        role="img"
        aria-label={`Pie chart with ${segments.length} segments`}
      />
      <div className="flex flex-col gap-1.5">
        {segments.map(([key, val]) => (
          <div key={key} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: colorMap[key] || '#666' }}
            />
            <span className="text-xs text-[var(--color-muted)] capitalize">{key}</span>
            <span className="ml-auto text-xs font-medium tabular-nums text-[var(--color-fg)]">
              {formatCompact(val)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
