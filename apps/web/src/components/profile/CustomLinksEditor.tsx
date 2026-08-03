'use client';

/**
 * CustomLinksEditor — linktree-style custom link editor.
 *
 * Add/remove labeled links (e.g. "My newsletter", "Support me") shown on the
 * profile page. Persistence is handled by the caller (settings page writes
 * to `degenfeed:settings`).
 */

import { useState } from 'react';

export interface CustomLink {
  label: string;
  url: string;
}

interface CustomLinksEditorProps {
  value: CustomLink[];
  onChange: (links: CustomLink[]) => void;
}

export function CustomLinksEditor({ value, onChange }: CustomLinksEditorProps) {
  const [draftLabel, setDraftLabel] = useState('');
  const [draftUrl, setDraftUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  const addLink = () => {
    const label = draftLabel.trim();
    const url = draftUrl.trim();
    if (!label || !url) {
      setError('Both label and URL are required.');
      return;
    }
    if (!/^https?:\/\//i.test(url)) {
      setError('URL must start with http:// or https://');
      return;
    }
    if (value.length >= 12) {
      setError('Maximum of 12 custom links.');
      return;
    }
    onChange([...value, { label, url }]);
    setDraftLabel('');
    setDraftUrl('');
    setError(null);
  };

  const removeLink = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-[var(--color-muted)]">
        Add links to show on your profile (linktree-style). Up to 12 links.
      </p>

      {value.length > 0 && (
        <div className="space-y-2">
          {value.map((link, i) => (
            <div
              key={`${link.url}-${i}`}
              className="flex items-center gap-2 rounded-lg border border-[var(--color-glass-border)] px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-[var(--color-fg)]">{link.label}</p>
                <p className="truncate text-[10px] text-[var(--color-muted)]">{link.url}</p>
              </div>
              <button
                type="button"
                onClick={() => removeLink(i)}
                className="shrink-0 rounded-lg border border-red-500/20 px-2 py-1 text-[10px] text-red-400 transition-colors hover:bg-red-500/10"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1.5fr_auto]">
        <input
          type="text"
          value={draftLabel}
          onChange={(e) => setDraftLabel(e.target.value)}
          className="w-full rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-fg)] outline-none focus:border-degen-500/30"
          placeholder="Label (e.g. Newsletter)"
          aria-label="Link label"
        />
        <input
          type="url"
          value={draftUrl}
          onChange={(e) => setDraftUrl(e.target.value)}
          className="w-full rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-fg)] outline-none focus:border-degen-500/30"
          placeholder="https://..."
          aria-label="Link URL"
        />
        <button
          type="button"
          onClick={addLink}
          className="rounded-xl bg-degen-500/20 px-4 py-2 text-xs font-bold text-degen-400 transition-colors hover:bg-degen-500/30"
        >
          Add
        </button>
      </div>
      {error && (
        <p className="text-[11px] text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
