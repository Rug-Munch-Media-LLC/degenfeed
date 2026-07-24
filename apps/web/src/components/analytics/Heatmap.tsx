'use client';

export function Heatmap({
  data,
  labels,
  color,
}: {
  data: number[];
  labels: string[];
  color: string;
}) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex gap-1.5">
      {data.map((v, i) => {
        const intensity = v / max;
        return (
          <div key={`hm-${i}`} className="flex flex-1 flex-col items-center gap-1">
            <div
              className="w-full rounded-md transition-all duration-300"
              style={{
                height: `${20 + intensity * 40}px`,
                backgroundColor: `${color}${Math.round(15 + intensity * 50)
                  .toString(16)
                  .padStart(2, '0')}`,
                border: `1px solid ${color}${Math.round(30 + intensity * 40)
                  .toString(16)
                  .padStart(2, '0')}`,
              }}
              title={`${labels[i]}: ${v} posts`}
            />
            <span className="text-[9px] font-medium text-[var(--color-muted)]">
              {labels[i]?.slice(0, 2)}
            </span>
            <span className="text-[9px] tabular-nums text-[var(--color-muted)]">{v}</span>
          </div>
        );
      })}
    </div>
  );
}
