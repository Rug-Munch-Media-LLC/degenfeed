'use client';

export function HorizontalVoteBar({
  forVotes,
  againstVotes,
  abstainVotes,
}: {
  forVotes: number;
  againstVotes: number;
  abstainVotes: number;
}) {
  const total = forVotes + againstVotes + abstainVotes || 1;
  const f = (forVotes / total) * 100;
  const a = (againstVotes / total) * 100;
  const ab = (abstainVotes / total) * 100;

  return (
    <div
      className="flex h-8 w-full overflow-hidden rounded-lg bg-[var(--color-muted-bg)]"
      role="progressbar"
      aria-valuenow={forVotes}
      aria-valuemin={0}
      aria-valuemax={total}
    >
      <div
        className="flex h-full items-center justify-center bg-degen-500 text-[9px] font-bold text-black transition-all duration-700"
        style={{ width: `${f}%` }}
      >
        {f > 8 ? `${f.toFixed(0)}%` : ''}
      </div>
      <div
        className="flex h-full items-center justify-center bg-red-500/80 text-[9px] font-bold text-white transition-all duration-700"
        style={{ width: `${a}%` }}
      >
        {a > 8 ? `${a.toFixed(0)}%` : ''}
      </div>
      <div
        className="flex h-full items-center justify-center bg-[var(--color-muted)]/40 text-[9px] font-bold text-[var(--color-muted)] transition-all duration-700"
        style={{ width: `${ab}%` }}
      >
        {ab > 8 ? `${ab.toFixed(0)}%` : ''}
      </div>
    </div>
  );
}
