'use client';

export function SettingsSection({
  title,
  description,
  children,
  danger,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-5 ${
        danger
          ? 'border-red-500/20 bg-red-500/5'
          : 'border-[var(--color-glass-border)] bg-[var(--color-card)]'
      }`}
    >
      <h2
        className={`text-sm font-bold mb-1 ${danger ? 'text-red-400' : 'text-[var(--color-fg)]'}`}
      >
        {danger && '⚠️ '}
        {title}
      </h2>
      {description && <p className="mb-4 text-xs text-[var(--color-muted)]">{description}</p>}
      {children}
    </div>
  );
}
