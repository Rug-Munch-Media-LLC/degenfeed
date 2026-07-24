'use client';

export function SectionSkeleton() {
  return (
    <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] overflow-hidden animate-pulse">
      <div className="px-5 py-4 border-b border-[var(--color-glass-border)]">
        <div className="h-5 w-48 skeleton rounded-lg" />
        <div className="mt-1 h-3 w-72 skeleton rounded-lg" />
      </div>
      <div className="p-5 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 skeleton rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export function DataSection({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] overflow-hidden transition-all">
      {(title || subtitle) && (
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--color-glass-border)]">
          {icon && (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-degen-500/10 text-degen-400">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d={icon} />
              </svg>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold text-[var(--color-fg)]">{title}</h2>
            {subtitle && <p className="text-xs text-[var(--color-muted)] mt-0.5">{subtitle}</p>}
          </div>
        </div>
      )}
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}
