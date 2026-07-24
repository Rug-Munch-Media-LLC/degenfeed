'use client';

export function StepIndicator({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="mb-6 flex items-center justify-center gap-0">
      {steps.map((label, i) => (
        <div key={label} className="flex items-center">
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all ${
              i === current
                ? 'bg-degen-500 text-black shadow-[0_0_8px_var(--color-accent-glow)]'
                : i < current
                  ? 'bg-degen-500/20 text-degen-400'
                  : 'border border-[var(--color-glass-border)] text-[var(--color-muted)]'
            }`}
          >
            {i < current ? '✓' : i + 1}
          </div>
          <span
            className={`hidden text-xs sm:inline ${
              i === current ? 'font-medium text-[var(--color-fg)]' : 'text-[var(--color-muted)]'
            }`}
          >
            {label}
          </span>
          {i < steps.length - 1 && (
            <div
              className={`mx-1 h-px w-6 ${
                i < current ? 'bg-degen-500/40' : 'bg-[var(--color-glass-border)]'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}
