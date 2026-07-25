'use client';

export function PrivacyToggle({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-overlay)] px-4 py-3">
      <div className="flex-1 min-w-0">
        <label htmlFor={id} className="text-sm font-medium text-[var(--color-fg)]">
          {label}
        </label>
        <p className="text-xs text-[var(--color-muted)] mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        data-checked={checked}
        onClick={() => onChange(!checked)}
        className="toggle-track shrink-0"
      >
        <span className="toggle-thumb" />
      </button>
    </div>
  );
}
