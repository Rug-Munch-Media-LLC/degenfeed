'use client';

export function Toggle({
  checked,
  onChange,
  label,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  id: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} className="text-sm text-[var(--color-fg)] cursor-pointer">
        {label}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        data-checked={checked}
        onClick={() => onChange(!checked)}
        className="toggle-track focus-visible:outline-2 focus-visible:outline-degen-500 focus-visible:outline-offset-2"
      >
        <span className="toggle-thumb" />
      </button>
    </div>
  );
}
