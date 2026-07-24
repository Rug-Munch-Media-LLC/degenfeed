'use client';

export function BarChart({
  data,
  labels,
  color,
  height = 120,
  compact,
}: {
  data: number[];
  labels: string[];
  color: string;
  height?: number;
  compact?: boolean;
}) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-[3px]" style={{ height }}>
      {data.map((v, i) => {
        const pct = (v / max) * 100;
        return (
          <div
            key={`bar-${i}`}
            className="group relative flex flex-1 flex-col items-center justify-end h-full"
          >
            <div
              className="w-full rounded-t-sm transition-all duration-500 ease-out hover:opacity-80"
              style={{
                height: `${pct}%`,
                background: `linear-gradient(180deg, ${color}, ${color}44)`,
                minHeight: pct > 0 ? 2 : 0,
              }}
            />
            {!compact && (
              <span className="mt-1 vertical-labels text-[9px] text-[var(--color-muted)]">
                {labels[i]?.slice(0, 3)}
              </span>
            )}
            <div className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-[var(--color-card)] px-2 py-1 text-[10px] text-[var(--color-fg)] opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
              {labels[i]}: {v}
            </div>
          </div>
        );
      })}
    </div>
  );
}
