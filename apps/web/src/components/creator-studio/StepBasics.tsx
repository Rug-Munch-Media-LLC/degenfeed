'use client';

import { CATEGORY_TAGS } from './constants';
import type { CoinFormState } from './types';

interface StepBasicsProps {
  form: CoinFormState;
  update: <K extends keyof CoinFormState>(key: K, value: CoinFormState[K]) => void;
  toggleTag: (tag: string) => void;
}

export default function StepBasics({ form, update, toggleTag }: StepBasicsProps) {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
        <h2 className="mb-4 text-sm font-bold text-[var(--color-fg)]">Coin Identity</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[var(--color-fg)]">
              Coin Name *
            </span>
            <input
              type="text"
              placeholder='e.g. "Alice Coin"'
              value={form.name}
              onChange={(e) => {
                update('name', e.target.value);
                if (!form.symbol && e.target.value) {
                  const auto = e.target.value
                    .replace(/[^a-zA-Z0-9]/g, '')
                    .toUpperCase()
                    .slice(0, 5);
                  if (auto.length >= 2) update('symbol', auto);
                }
              }}
              className="input text-sm w-full"
              maxLength={64}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[var(--color-fg)]">
              Symbol ($TICKER) *
            </span>
            <input
              type="text"
              placeholder="$TICKER"
              value={form.symbol}
              onChange={(e) =>
                update(
                  'symbol',
                  e.target.value
                    .toUpperCase()
                    .replace(/[^A-Z0-9]/g, '')
                    .slice(0, 5),
                )
              }
              className="input text-sm w-full font-mono"
              maxLength={5}
            />
          </label>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
        <h2 className="mb-4 text-sm font-bold text-[var(--color-fg)]">Description & Media</h2>
        <label className="mb-3 block">
          <span className="mb-1 block text-xs font-medium text-[var(--color-fg)]">
            Bio / Description
          </span>
          <textarea
            placeholder="Tell the world about your coin..."
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            className="input text-sm w-full min-h-[80px] resize-y"
            maxLength={1000}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-[var(--color-fg)]">
            Profile Image
          </span>
          <div className="flex items-center gap-3">
            {form.imagePreview ? (
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-[var(--color-glass-border)]">
                <img src={form.imagePreview} alt="Preview" className="h-full w-full object-cover" />
              </div>
            ) : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[var(--color-glass-border)] text-xl text-[var(--color-muted)]">
                🪙
              </div>
            )}
            <input
              type="text"
              placeholder="Paste image URL or upload..."
              value={form.imagePreview}
              onChange={(e) => update('imagePreview', e.target.value)}
              className="input text-sm flex-1"
            />
          </div>
        </label>
      </div>

      <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
        <h2 className="mb-4 text-sm font-bold text-[var(--color-fg)]">Category Tags</h2>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className={`rounded-full border px-3 py-1.5 text-[11px] font-medium capitalize transition-all ${
                form.tags.includes(tag)
                  ? 'border-degen-500/30 bg-degen-500/15 text-degen-400'
                  : 'border-[var(--color-glass-border)] text-[var(--color-muted)] hover:border-degen-500/20'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
