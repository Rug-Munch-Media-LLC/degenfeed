'use client';

type DensityMode = 'dense' | 'comfortable' | 'visual';

interface DensityToggleProps {
  value: DensityMode;
  onChange: (mode: DensityMode) => void;
  color?: string;
}

const MODES: { id: DensityMode; label: string; icon: string; desc: string }[] = [
  { id: 'dense', label: 'Dense', icon: '⊟', desc: 'More posts, compact view' },
  { id: 'comfortable', label: 'Comfortable', icon: '⊞', desc: 'Balanced layout' },
  { id: 'visual', label: 'Visual', icon: '⊠', desc: 'Larger cards, more media' },
];

export function DensityToggle({ value, onChange, color = 'var(--degen-500)' }: DensityToggleProps) {
  return (
    <div
      className="flex items-center gap-0.5 rounded-lg border p-0.5"
      style={{ borderColor: 'var(--color-glass-border)' }}
      role="radiogroup"
      aria-label="Content density"
    >
      {MODES.map((mode) => {
        const isActive = value === mode.id;
        return (
          <button
            key={mode.id}
            type="button"
            onClick={() => onChange(mode.id)}
            className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-all ${
              isActive
                ? 'text-[var(--color-fg)] shadow-sm'
                : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
            }`}
            style={
              isActive
                ? {
                    backgroundColor: `${color}18`,
                    color,
                  }
                : undefined
            }
            role="radio"
            aria-checked={isActive}
            title={mode.desc}
            aria-label={`${mode.label} — ${mode.desc}`}
          >
            <span className="text-xs">{mode.icon}</span>
            <span className="hidden sm:inline">{mode.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export type { DensityMode };
