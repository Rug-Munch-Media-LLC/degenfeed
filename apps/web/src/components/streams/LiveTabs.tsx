'use client';

import type { StreamType } from './useLiveStreams';

/* ─── Types ──────────────────────────────────────────────────── */

interface Tab {
  id: StreamType | 'all';
  label: string;
  emoji: string;
}

const TABS: Tab[] = [
  { id: 'all', label: 'All', emoji: '📡' },
  { id: 'launch', label: 'Coin Launches', emoji: '🪙' },
  { id: 'spaces', label: 'Spaces', emoji: '🎙️' },
  { id: 'solo', label: 'Solo', emoji: '🎥' },
  { id: 'collab', label: 'Collab', emoji: '👥' },
];

interface LiveTabsProps {
  activeTab: StreamType | 'all';
  onTabChange: (tab: StreamType | 'all') => void;
  counts?: Partial<Record<StreamType | 'all', number>>;
}

/* ─── Component ──────────────────────────────────────────────── */

export function LiveTabs({ activeTab, onTabChange, counts }: LiveTabsProps) {
  return (
    <div
      className="mb-6 flex gap-1 overflow-x-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-1 scrollbar-none"
      role="tablist"
      aria-label="Stream categories"
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        const count = counts?.[tab.id];

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onTabChange(tab.id)}
            className={`
              relative flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-medium transition-all
              ${
                isActive
                  ? 'bg-degen-500/15 text-degen-400 shadow-sm'
                  : 'text-[var(--color-muted)] hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)]'
              }
            `}
          >
            <span className="text-sm" aria-hidden="true">
              {tab.emoji}
            </span>
            <span>{tab.label}</span>
            {count !== undefined && count > 0 && (
              <span
                className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold tabular-nums ${
                  isActive
                    ? 'bg-degen-500/20 text-degen-400'
                    : 'bg-[var(--color-overlay)] text-[var(--color-muted)]'
                }`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
