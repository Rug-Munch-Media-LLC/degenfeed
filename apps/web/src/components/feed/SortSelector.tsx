'use client';

/**
 * SortSelector — Sort options for the unified feed.
 *
 * Presents "Latest", "Trending", "Most Active" as sort modes.
 * Uses a segmented control layout.
 */

export type SortMode = 'latest' | 'trending' | 'most-active';

export interface SortSelectorProps {
  mode: SortMode;
  onChange: (mode: SortMode) => void;
}

const SORT_OPTIONS: { id: SortMode; label: string; icon: string }[] = [
  { id: 'latest', label: 'Latest', icon: '\u23F1' },
  { id: 'trending', label: 'Trending', icon: '\uD83D\uDD25' },
  { id: 'most-active', label: 'Most Active', icon: '\u26A1' },
];

export function SortSelector({ mode, onChange }: SortSelectorProps) {
  return (
    <div
      className="flex rounded-xl border border-[var(--color-glass-border)] p-0.5"
      role="radiogroup"
      aria-label="Sort by"
    >
      {SORT_OPTIONS.map((opt) => {
        const isActive = mode === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(opt.id)}
            className={`
              flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium
              transition-all duration-200
              ${isActive ? 'shadow-sm' : 'hover:text-[var(--color-fg)]'}
            `}
            style={{
              backgroundColor: isActive ? 'var(--color-accent-glow)' : 'transparent',
              color: isActive ? 'var(--color-accent)' : 'var(--color-muted)',
            }}
          >
            <span aria-hidden="true" className="text-[0.85em]">
              {opt.icon}
            </span>
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
