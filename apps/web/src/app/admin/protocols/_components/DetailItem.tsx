export function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)] px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
        {label}
      </p>
      <p className="text-sm font-medium text-[var(--color-fg)]">{value}</p>
    </div>
  );
}
