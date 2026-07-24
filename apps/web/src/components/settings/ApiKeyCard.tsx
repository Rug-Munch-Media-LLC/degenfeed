'use client';

export function ApiKeyCard({
  name,
  keyPreview,
  created,
  onRevoke,
}: {
  name: string;
  keyPreview: string;
  created: string;
  onRevoke: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-overlay)] px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-[var(--color-fg)]">{name}</div>
        <code className="text-xs font-mono text-[var(--color-muted)]">{keyPreview}</code>
        <div className="text-[10px] text-[var(--color-muted)]">Created {created}</div>
      </div>
      <button
        type="button"
        onClick={onRevoke}
        className="shrink-0 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-colors"
      >
        Revoke
      </button>
    </div>
  );
}
