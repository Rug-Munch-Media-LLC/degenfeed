'use client';

export function UsageGauge({
  used,
  total,
  percent,
}: {
  used: string;
  total: string;
  percent: number;
}) {
  const color = percent >= 90 ? '#ff4444' : percent >= 75 ? '#ffaa00' : '#00ff41';

  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <svg
          width="140"
          height="140"
          viewBox="0 0 140 140"
          className="-rotate-90"
          aria-hidden="true"
        >
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke="var(--color-glass-border)"
            strokeWidth="8"
          />
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.8s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-black tabular-nums text-[var(--color-fg)]">{percent}%</span>
          <span className="text-[9px] text-[var(--color-muted)]">used</span>
        </div>
      </div>
      <div className="mt-2 text-center">
        <p className="text-xs font-medium text-[var(--color-fg)]">{used}</p>
        <p className="text-[10px] text-[var(--color-muted)]">of {total} free</p>
      </div>
    </div>
  );
}
