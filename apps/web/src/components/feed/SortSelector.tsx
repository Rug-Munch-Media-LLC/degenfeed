'use client';

/**
 * SortSelector — Sort dropdown for the unified feed.
 *
 * Presents "Latest", "Trending", "Quality", "Most Zapped", "Most Engaged"
 * as the primary feed ordering. Uses a styled native <select> for
 * accessibility (keyboard, screen readers) and mobile friendliness.
 */

import { type FeedSort, SORT_LABELS } from '../../lib/feedRanking';

export type SortMode = FeedSort;

export interface SortSelectorProps {
  mode: SortMode;
  onChange: (mode: SortMode) => void;
}

const SORT_OPTIONS = (Object.keys(SORT_LABELS) as FeedSort[]).map((id) => ({
  id,
  ...SORT_LABELS[id],
}));

export function SortSelector({ mode, onChange }: SortSelectorProps) {
  return (
    <label className="relative inline-flex items-center" aria-label="Sort feed by">
      <span
        className="pointer-events-none absolute left-2.5 text-[0.9em] text-[var(--color-muted)]"
        aria-hidden="true"
      >
        {SORT_LABELS[mode].icon}
      </span>
      <select
        value={mode}
        onChange={(e) => onChange(e.target.value as SortMode)}
        className="appearance-none rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card-bg)] py-2 pl-8 pr-8 text-xs font-semibold text-[var(--color-fg)] outline-none transition-colors hover:border-[var(--color-glass-border)] focus:border-degen-500/50"
      >
        {SORT_OPTIONS.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.label}
          </option>
        ))}
      </select>
      <span
        className="pointer-events-none absolute right-2.5 text-[0.7em] text-[var(--color-muted)]"
        aria-hidden="true"
      >
        ▾
      </span>
    </label>
  );
}
