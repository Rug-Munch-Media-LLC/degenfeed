'use client';

export default function AllocationPieChart({ treasuryPct, creatorPct }: { treasuryPct: number; creatorPct: number }) {
  const w = 140, h = 140, cx = w / 2, cy = h / 2, r = 55;
  const liquidityPct = 60;
  const communityPct = 100 - treasuryPct - creatorPct - liquidityPct;
  const segments = [
    { pct: liquidityPct, color: '#00ff41', label: 'Liquidity' },
    { pct: communityPct, color: '#8b5cf6', label: 'Community' },
    { pct: treasuryPct, color: '#f59e0b', label: 'Treasury' },
    { pct: creatorPct, color: '#3b82f6', label: 'Creator' },
  ].filter((s) => s.pct > 0);

  const polarToCartesian = (angle: number) => ({
    x: cx + r * Math.cos((angle - 90) * (Math.PI / 180)),
    y: cy + r * Math.sin((angle - 90) * (Math.PI / 180)),
  });

  let currentAngle = 0;
  const paths = segments.map((seg) => {
    const angle = (seg.pct / 100) * 360;
    const start = polarToCartesian(currentAngle);
    const end = polarToCartesian(currentAngle + angle);
    const largeArc = angle > 180 ? 1 : 0;
    const d = `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
    currentAngle += angle;
    return { ...seg, d };
  });

  return (
    <div className="flex flex-col items-center gap-3">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        {paths.map((p) => <path key={p.label} d={p.d} fill={p.color} opacity="0.7" stroke="#111" strokeWidth="1" />)}
        <circle cx={cx} cy={cy} r={r * 0.35} fill="var(--color-card)" />
        <text x={cx} y={cy - 2} textAnchor="middle" fill="var(--color-fg)" fontSize="10" fontWeight="bold" fontFamily="monospace">100%</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fill="var(--color-muted)" fontSize="6" fontFamily="monospace">Total</text>
      </svg>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 text-[10px]">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="text-[var(--color-muted)]">{s.label} ({s.pct}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}
