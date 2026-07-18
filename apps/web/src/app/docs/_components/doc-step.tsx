import type { ReactNode } from 'react';

export function Step({
  number,
  label,
  children,
}: {
  number: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex gap-4 rounded-lg border border-[var(--color-glass-border)] bg-white/[0.02] p-4">
      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-degen-500/10 text-xs font-bold text-degen-400">
        {number}
      </span>
      <div>
        <div className="mb-1 text-sm font-semibold text-[var(--color-fg)]">{label}</div>
        <p className="text-sm leading-relaxed text-gray-400">{children}</p>
      </div>
    </div>
  );
}

export function StepList({ children }: { children: ReactNode }) {
  return <div className="mt-4 grid gap-3 sm:grid-cols-2">{children}</div>;
}
