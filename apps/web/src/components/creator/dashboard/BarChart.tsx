'use client';

export function BarChart({
  data,
  labels,
  color,
  height = 120,
}: {
  data: number[];
  labels: string[];
  color: string;
  height?: number;
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
            <span className="mt-1 text-[9px] text-[var(--color-muted)]">
              {labels[i]?.slice(0, 3)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
