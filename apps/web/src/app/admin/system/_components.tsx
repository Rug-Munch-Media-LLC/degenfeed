// === Sub-components ===
// Auto-extracted from page.tsx

export function ResourceCard({
  label,
  usage,
  detail,
  color,
}: {
  label: string;
  usage: number;
  detail: string;
  color: 'green' | 'yellow' | 'red';
}) {
  const colorMap = {
    green: { bar: 'bg-degen-500', text: 'text-degen-400' },
    yellow: { bar: 'bg-yellow-500', text: 'text-yellow-400' },
    red: { bar: 'bg-red-500', text: 'text-red-400' },
  };
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--color-fg)]">{label}</h3>
        <span className={`text-lg font-bold ${colorMap[color].text}`}>{usage.toFixed(1)}%</span>
      </div>
      <div className="mb-2 h-3 overflow-hidden rounded-full bg-[var(--color-muted)]">
        <div
          className={`h-full rounded-full transition-all duration-700 ${colorMap[color].bar}`}
          style={{ width: `${Math.min(usage, 100)}%` }}
        />
      </div>
      <p className="text-xs text-[var(--color-muted)]">{detail}</p>
    </div>
  );
}

export function InfoBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3">
      <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
        {label}
      </p>
      <p className="text-xs font-medium text-[var(--color-fg)] truncate">{value}</p>
    </div>
  );
}
