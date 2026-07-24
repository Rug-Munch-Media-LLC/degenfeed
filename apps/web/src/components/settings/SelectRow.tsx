'use client';

export function SelectRow({
  label,
  value,
  options,
  onChange,
  id,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
  id: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} className="text-sm text-[var(--color-fg)]">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm text-[var(--color-fg)] focus:border-degen-500 focus:outline-none focus:ring-1 focus:ring-degen-500"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
