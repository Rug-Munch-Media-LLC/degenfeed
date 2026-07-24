/**
 * @degenfeed/web — Feed tab bar and filter controls
 *
 * Extracted from feed/page.tsx. Displays tab navigation and
 * filter toggles for the main feed view.
 */

'use client';

import type { FeedTab, ProtocolSummary } from '../../types/api';

interface FeedTabBarProps {
  activeTab: FeedTab;
  onTabChange: (tab: FeedTab) => void;
  protocolSummaries: ProtocolSummary[];
  protocolFilter: string | null;
  onProtocolFilter: (protocolId: string | null) => void;
  /** Called to open the tuner/mix panel */
  onOpenTuner?: () => void;
  /** Whether to show the tuner button */
  showTuner?: boolean;
}

const TABS: { key: FeedTab; label: string }[] = [
  { key: 'for-you', label: 'For You' },
  { key: 'following', label: 'Following' },
  { key: 'trending', label: 'Trending' },
  { key: 'news', label: 'News' },
  { key: 'custom-mix', label: 'Custom Mix' },
];

export function FeedTabBar({
  activeTab,
  onTabChange,
  protocolSummaries,
  protocolFilter,
  onProtocolFilter,
  onOpenTuner,
  showTuner = true,
}: FeedTabBarProps) {
  return (
    <div className="flex flex-col gap-2">
      {/* Tab Row */}
      <div
        className="flex items-center gap-1 overflow-x-auto px-4 py-2 scrollbar-none"
        role="tablist"
        aria-label="Feed tabs"
      >
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => onTabChange(tab.key)}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-degen-500/20 text-degen-300'
                : 'text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-overlay)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
        {showTuner && onOpenTuner && (
          <button
            type="button"
            onClick={onOpenTuner}
            className="ml-auto shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-degen-400 hover:bg-degen-500/10 transition-colors"
            aria-label="Open feed tuner"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="inline-block mr-1"
            >
              <line x1="4" y1="21" x2="4" y2="14" />
              <line x1="4" y1="10" x2="4" y2="3" />
              <line x1="12" y1="21" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12" y2="3" />
              <line x1="20" y1="21" x2="20" y2="16" />
              <line x1="20" y1="12" x2="20" y2="3" />
              <circle cx="4" cy="12" r="2" />
              <circle cx="12" cy="10" r="2" />
              <circle cx="20" cy="14" r="2" />
            </svg>
            Tune
          </button>
        )}
      </div>

      {/* Protocol Filter Chips */}
      {protocolSummaries.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-1">
          <button
            type="button"
            onClick={() => onProtocolFilter(null)}
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-colors ${
              protocolFilter === null
                ? 'bg-[var(--color-fg)] text-[var(--color-bg)]'
                : 'bg-[var(--color-overlay)] text-[var(--color-muted)] hover:text-[var(--color-fg)]'
            }`}
          >
            All
          </button>
          {protocolSummaries.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onProtocolFilter(p.id === protocolFilter ? null : p.id)}
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-colors ${
                protocolFilter === p.id
                  ? 'bg-[var(--color-fg)] text-[var(--color-bg)]'
                  : 'bg-[var(--color-overlay)] text-[var(--color-muted)] hover:text-[var(--color-fg)]'
              }`}
            >
              {p.label} {p.count > 0 && <span className="opacity-60">({p.count})</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
