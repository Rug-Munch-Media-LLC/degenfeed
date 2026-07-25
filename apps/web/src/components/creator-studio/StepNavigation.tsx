'use client';

export default function StepNavigation({
  current,
  total,
  steps,
}: {
  current: number;
  total: number;
  steps: string[];
}) {
  return (
    <div>
      <div className="mb-6 flex items-center gap-2">
        {Array.from({ length: total }, (_, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                i <= current
                  ? 'bg-degen-500/20 text-degen-400 border border-degen-500/30'
                  : 'bg-[var(--color-card)] text-[var(--color-muted)] border border-[var(--color-glass-border)]'
              }`}
            >
              {i < current ? '✓' : i + 1}
            </div>
            {i < total - 1 && (
              <div
                className={`h-px w-6 ${i < current ? 'bg-degen-500/30' : 'bg-[var(--color-glass-border)]'}`}
              />
            )}
          </div>
        ))}
      </div>
      <div className="mb-6 flex justify-between text-[10px] font-medium text-[var(--color-muted)]">
        {steps.map((label, i) => (
          <span key={label} className={current >= i ? 'text-degen-400' : ''}>
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
