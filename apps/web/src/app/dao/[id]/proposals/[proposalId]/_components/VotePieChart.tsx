'use client';

export function VotePieChart({
  forVotes,
  againstVotes,
  abstainVotes,
}: {
  forVotes: number;
  againstVotes: number;
  abstainVotes: number;
}) {
  const total = forVotes + againstVotes + abstainVotes || 1;
  const r = 36;
  const cx = 40;
  const cy = 40;
  const circumference = 2 * Math.PI * r;

  const segments = [
    { value: forVotes, color: 'var(--color-accent)' },
    { value: againstVotes, color: '#ef4444' },
    { value: abstainVotes, color: 'var(--color-muted)' },
  ];

  let offset = 0;
  const paths = segments.map((seg, i) => {
    const pct = seg.value / total;
    const length = pct * circumference;
    const path = (
      <circle
        key={i}
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={seg.color}
        strokeWidth="12"
        strokeDasharray={`${length} ${circumference - length}`}
        strokeDashoffset={-offset}
        transform={`rotate(-90 ${cx} ${cy})`}
        className="transition-all duration-700"
      />
    );
    offset += length;
    return path;
  });

  return (
    <svg
      viewBox="0 0 80 80"
      className="h-full w-full"
      role="img"
      aria-label="Vote distribution pie chart"
    >
      {paths}
    </svg>
  );
}
