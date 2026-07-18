'use client';

import type { FeedLayout } from '@degenfeed/storage';
import { memo, useState } from 'react';

const LAYOUT_OPTIONS: Array<{
  id: FeedLayout;
  icon: string;
  label: string;
}> = [
  { id: 'compact', icon: '📋', label: 'Compact — Twitter-like density' },
  { id: 'comfortable', icon: '🗂️', label: 'Comfortable — full cards' },
  { id: 'media-grid', icon: '🖼️', label: 'Media Grid — images & videos only' },
  { id: 'reader', icon: '📖', label: 'Reader — clean reading view' },
] as const;

interface FeedLayoutSwitcherProps {
  current: FeedLayout;
  onChange: (layout: FeedLayout) => void;
}

export const FeedLayoutSwitcher = memo(function FeedLayoutSwitcher({
  current,
  onChange,
}: FeedLayoutSwitcherProps) {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div
      className="feed-layout-switcher inline-flex items-center gap-0.5 rounded-lg border border-white/[0.06] bg-[var(--color-glass-bg)] p-0.5"
      role="radiogroup"
      aria-label="Feed layout"
    >
      {LAYOUT_OPTIONS.map((opt) => {
        const active = current === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={opt.label}
            onClick={() => onChange(opt.id)}
            onMouseEnter={() => setHovered(opt.id)}
            onMouseLeave={() => setHovered(null)}
            className={`relative flex h-8 w-8 items-center justify-center rounded-md text-sm transition-all ${
              active
                ? 'bg-degen-500/15 text-degen-400 shadow-sm'
                : 'text-[var(--color-muted)] hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)]'
            }`}
          >
            <span aria-hidden="true">{opt.icon}</span>
            {hovered === opt.id && (
              <span
                className="absolute -bottom-8 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/[0.06] bg-[var(--color-glass-bg)] px-2 py-1 text-[11px] font-medium text-[var(--color-fg)] shadow-lg backdrop-blur-2xl"
                role="tooltip"
              >
                {opt.label}
              </span>
            )}
            {active && (
              <span className="absolute inset-0 rounded-md ring-1 ring-degen-500/30 ring-inset" />
            )}
          </button>
        );
      })}
    </div>
  );
});
