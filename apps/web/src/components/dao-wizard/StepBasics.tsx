'use client';

import type { DAOFormState } from './types';
import { CATEGORY_TAGS } from './constants';

interface StepBasicsProps {
  form: DAOFormState;
  update: <K extends keyof DAOFormState>(key: K, value: DAOFormState[K]) => void;
  toggleTag: (tag: string) => void;
}

export default function StepBasics({ form, update, toggleTag }: StepBasicsProps) {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
        <h2 className="mb-4 text-sm font-bold text-[var(--color-fg)]">DAO Identity</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-[var(--color-fg)]">DAO Name *</span>
            <input type="text" placeholder='e.g. "Degen Capital DAO"' value={form.name}
              onChange={(e) => update('name', e.target.value)} className="input text-sm w-full" maxLength={64}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-[var(--color-fg)]">Mission Statement / Description</span>
            <textarea placeholder="What does your DAO do?" value={form.description}
              onChange={(e) => update('description', e.target.value)}
              className="input text-sm w-full min-h-[80px] resize-y" maxLength={2000}
            />
            <span className="mt-0.5 block text-right text-[9px] text-[var(--color-muted)]">{form.description.length}/2000</span>
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-[var(--color-fg)]">DAO Avatar</span>
            <div className="flex items-center gap-3">
              {form.avatarUrl ? (
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-[var(--color-glass-border)]">
                  <img src={form.avatarUrl} alt="DAO avatar preview" className="h-full w-full object-cover" />
                </div>
              ) : (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-dashed border-[var(--color-glass-border)] text-xl text-[var(--color-muted)]">🏛️</div>
              )}
              <input type="text" placeholder="Paste image URL..." value={form.avatarUrl}
                onChange={(e) => update('avatarUrl', e.target.value)} className="input text-sm flex-1"
              />
            </div>
          </label>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
        <h2 className="mb-3 text-sm font-bold text-[var(--color-fg)]">Category Tags</h2>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_TAGS.map((tag) => (
            <button key={tag} type="button" onClick={() => toggleTag(tag)}
              className={`rounded-full border px-3 py-1.5 text-[11px] font-medium capitalize transition-all ${
                form.tags.includes(tag)
                  ? 'border-[var(--color-accent)]/30 bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
                  : 'border-[var(--color-glass-border)] text-[var(--color-muted)] hover:border-[var(--color-accent)]/20'
              }`}
            >{tag}</button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
        <h2 className="mb-4 text-sm font-bold text-[var(--color-fg)]">Social Links</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-[10px] font-medium text-[var(--color-muted)]">𝕏 Twitter</span>
            <input type="text" placeholder="https://twitter.com/..." value={form.twitter}
              onChange={(e) => update('twitter', e.target.value)} className="input text-sm w-full"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-medium text-[var(--color-muted)]">💬 Discord</span>
            <input type="text" placeholder="https://discord.gg/..." value={form.discord}
              onChange={(e) => update('discord', e.target.value)} className="input text-sm w-full"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-medium text-[var(--color-muted)]">✈️ Telegram</span>
            <input type="text" placeholder="https://t.me/..." value={form.telegram}
              onChange={(e) => update('telegram', e.target.value)} className="input text-sm w-full"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-medium text-[var(--color-muted)]">🌐 Website</span>
            <input type="text" placeholder="https://..." value={form.website}
              onChange={(e) => update('website', e.target.value)} className="input text-sm w-full"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
