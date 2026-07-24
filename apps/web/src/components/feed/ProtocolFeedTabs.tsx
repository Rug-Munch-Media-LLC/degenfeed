'use client';

/**
 * ProtocolFeedTabs — Protocol filter tabs for the unified feed.
 *
 * Shows a row of protocol badges that filter the feed by protocol source.
 * Includes "All Protocols" default tab.
 */

import { getProtocolColor } from '@degenfeed/ui';

/* ─── Protocol tab config ───────────────────────────────────── */

export interface ProtocolTab {
  id: string | null; // null = "All"
  label: string;
  icon: string;
  color: string;
  count?: number;
}

export interface ProtocolFeedTabsProps {
  tabs: ProtocolTab[];
  activeTab: string | null;
  onTabChange: (id: string | null) => void;
  showCounts?: boolean;
}

const DEFAULT_TABS: ProtocolTab[] = [
  { id: null, label: 'All', icon: '\u2606', color: '#00ff41' },
  { id: 'nostr', label: 'Nostr', icon: '\u2630', color: getProtocolColor('nostr') },
  { id: 'farcaster', label: 'Farcaster', icon: '\u25C8', color: getProtocolColor('farcaster') },
  { id: 'lens', label: 'Lens', icon: '\u25CE', color: getProtocolColor('lens') },
  { id: 'bluesky', label: 'Bluesky', icon: '\u2601', color: getProtocolColor('bluesky') },
  { id: 'mastodon', label: 'Mastodon', icon: 'M', color: getProtocolColor('mastodon') },
  { id: 'reddit', label: 'Reddit', icon: 'R', color: getProtocolColor('reddit') },
  { id: 'rss', label: 'RSS', icon: 'A', color: getProtocolColor('rss') },
];

export function getProtocolTabs(): ProtocolTab[] {
  return DEFAULT_TABS;
}

export function ProtocolFeedTabs({
  tabs = DEFAULT_TABS,
  activeTab,
  onTabChange,
  showCounts = false,
}: ProtocolFeedTabsProps) {
  return (
    <div
      className="flex gap-1 overflow-x-auto pb-2 scrollbar-none"
      role="tablist"
      aria-label="Filter by protocol"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id ?? 'all'}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onTabChange(tab.id)}
            className={`
              relative flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold
              transition-all duration-200 whitespace-nowrap
              ${
                isActive
                  ? 'shadow-sm scale-105'
                  : 'opacity-60 hover:opacity-100 hover:bg-[var(--color-overlay)]'
              }
            `}
            style={{
              backgroundColor: isActive ? `${tab.color}1a` : 'transparent',
              color: isActive ? tab.color : 'var(--color-muted)',
              border: `1px solid ${isActive ? `${tab.color}40` : 'var(--color-glass-border)'}`,
            }}
          >
            <span className="text-[0.8em]" aria-hidden="true">
              {tab.icon}
            </span>
            <span>{tab.label}</span>
            {showCounts && tab.count !== undefined && (
              <span
                className="ml-0.5 rounded-full px-1.5 py-0 text-[9px] font-medium opacity-60"
                style={{ backgroundColor: `${tab.color}20` }}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
