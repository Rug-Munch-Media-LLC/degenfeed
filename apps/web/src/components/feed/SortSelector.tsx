'use client';

/**
 * SortSelector — Sort control for the unified feed.
 *
 * Presents the three primary modes ("New", "Trending", "For You") as a
 * segmented control — fast, one-tap, X-like — with the advanced ranking
 * modes (Quality, Most Zapped, Most Engaged) tucked into a compact overflow
 * dropdown so the primary choice stays prominent. The active mode is always
 * visible and reflected back in the control (`aria-pressed`), matching the
 * `?sort=` value sent to the feed.
 */

import { useState } from 'react';
import { type FeedSort, SORT_LABELS } from '../../lib/feedRanking';

export type SortMode = FeedSort;

export interface SortSelectorProps {
  mode: SortMode;
  onChange: (mode: SortMode) => void;
}

/** Primary modes — the three the product wants front and center. */
const PRIMARY_SORTS: FeedSort[] = ['latest', 'trending', 'for-you'];
/** Advanced ranking modes — kept one tap away. */
const EXTRA_SORTS: FeedSort[] = ['quality', 'zapped', 'engaged'];

export function SortSelector({ mode, onChange }: SortSelectorProps) {
  const [extraOpen, setExtraOpen] = useState(false);
  const isExtra = EXTRA_SORTS.includes(mode);

  return (
    <fieldset
      aria-label="Sort feed by"
      className="flex items-center gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-1"
    >
      {PRIMARY_SORTS.map((id) => (
        <button
          key={id}
          type="button"
          aria-pressed={mode === id}
          onClick={() => onChange(id)}
          className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors ${
            mode === id
              ? 'bg-degen-500/15 text-degen-400 shadow-sm'
              : 'text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-overlay)]'
          }`}
        >
          <span className="mr-1" aria-hidden="true">
            {SORT_LABELS[id].icon}
          </span>
          {SORT_LABELS[id].label}
        </button>
      ))}

      {/* Advanced sorts — overflow dropdown keeps the primary row clean */}
      <div className="relative">
        <button
          type="button"
          aria-expanded={extraOpen}
          aria-label="More sort modes"
          title={
            isExtra ? `${SORT_LABELS[mode].label} — ${SORT_LABELS[mode].hint}` : 'More sort modes'
          }
          onClick={() => setExtraOpen((v) => !v)}
          onBlur={() => setExtraOpen(false)}
          className={`flex items-center rounded-lg px-1.5 py-1 text-[11px] transition-colors ${
            isExtra
              ? 'bg-degen-500/15 text-degen-400'
              : 'text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-overlay)]'
          }`}
        >
          {isExtra ? (
            <span aria-hidden="true">{SORT_LABELS[mode].icon}</span>
          ) : (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
              <circle cx="2.5" cy="6" r="1.2" />
              <circle cx="6" cy="6" r="1.2" />
              <circle cx="9.5" cy="6" r="1.2" />
            </svg>
          )}
        </button>

        {extraOpen && (
          <div
            role="menu"
            className="absolute right-0 top-full z-30 mt-1 min-w-[9.5rem] overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-xl"
          >
            {EXTRA_SORTS.map((id) => (
              <button
                key={id}
                type="button"
                role="menuitemradio"
                aria-checked={mode === id}
                onClick={() => {
                  onChange(id);
                  setExtraOpen(false);
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] transition-colors ${
                  mode === id
                    ? 'bg-degen-500/10 text-degen-400'
                    : 'text-[var(--color-muted)] hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)]'
                }`}
              >
                <span aria-hidden="true">{SORT_LABELS[id].icon}</span>
                <span className="font-medium">{SORT_LABELS[id].label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </fieldset>
  );
}
