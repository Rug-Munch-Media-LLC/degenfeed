'use client';

export function StepDots({ current, total }: { current: number; total: number }) {
  const percent = Math.round(((current + 1) / total) * 100);
  return (
    <div className="flex flex-col items-end gap-1">
      <span className="font-mono text-[10px] font-medium tracking-wider text-degen-400/80">
        Step {current + 1} of {total} — {percent}%
      </span>
      <div
        className="h-1 w-24 overflow-hidden rounded-full bg-white/5"
        role="progressbar"
        aria-valuenow={current + 1}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-label={`Step ${current + 1} of ${total}`}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-degen-500 to-degen-400 transition-all duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
