'use client';

import { CATEGORY_EMOJIS, CATEGORY_LABELS, type FeddyCategory } from './types';

const CATEGORIES = Object.keys(CATEGORY_LABELS) as FeddyCategory[];

export function CategoryBrowser({
  selected,
  onSelect,
}: {
  selected?: FeddyCategory;
  onSelect: (category: FeddyCategory | undefined) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {/* All button */}
      <button
        type="button"
        onClick={() => onSelect(undefined)}
        className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
          !selected
            ? 'bg-degen-500/15 text-degen-400'
            : 'border border-[var(--color-border)] bg-[var(--color-overlay)] text-[var(--color-muted)] hover:text-[var(--color-fg)]'
        }`}
      >
        All
      </button>

      {CATEGORIES.map((cat) => (
        <button
          key={cat}
          type="button"
          onClick={() => onSelect(selected === cat ? undefined : cat)}
          className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
            selected === cat
              ? 'bg-purple-500/15 text-purple-400'
              : 'border border-[var(--color-border)] bg-[var(--color-overlay)] text-[var(--color-muted)] hover:text-[var(--color-fg)]'
          }`}
        >
          <span>{CATEGORY_EMOJIS[cat]}</span>
          <span>{CATEGORY_LABELS[cat]}</span>
        </button>
      ))}
    </div>
  );
}
