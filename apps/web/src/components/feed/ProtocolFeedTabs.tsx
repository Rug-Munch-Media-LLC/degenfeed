'use client';

/**
 * ProtocolFeedTabs — Protocol filter tabs for the unified feed.
 *
 * Shows a row of protocol badges that filter the feed by protocol source.
 * Includes "All Protocols" default tab. Features smooth animated active
 * indicator, hover states, and optional count badges.
 */

import { getProtocolColor } from '@degenfeed/ui';
import { useCallback, useEffect, useRef, useState } from 'react';

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
  const tabsRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<{
    left: number;
    width: number;
    color: string;
    opacity: number;
  }>({ left: 0, width: 0, color: '#00ff41', opacity: 0 });

  const updateIndicator = useCallback(() => {
    if (!tabsRef.current) return;
    const activeIdx = tabs.findIndex((t) => t.id === activeTab);
    if (activeIdx < 0) return;
    const button = tabsRef.current.querySelector<HTMLButtonElement>(
      `[data-tab-idx="${activeIdx}"]`,
    );
    if (!button) return;
    const containerRect = tabsRef.current.getBoundingClientRect();
    const btnRect = button.getBoundingClientRect();
    setIndicatorStyle({
      left: btnRect.left - containerRect.left,
      width: btnRect.width,
      color: tabs[activeIdx]?.color ?? '#00ff41',
      opacity: 1,
    });
  }, [tabs, activeTab]);

  // Update indicator on mount and resize
  useEffect(() => {
    updateIndicator();
    const observer = new ResizeObserver(updateIndicator);
    if (tabsRef.current) observer.observe(tabsRef.current);
    return () => observer.disconnect();
  }, [updateIndicator]);

  return (
    <div
      className="relative flex gap-1 overflow-x-auto pb-2 scrollbar-none"
      role="tablist"
      aria-label="Filter by protocol"
      ref={tabsRef}
    >
      {/* Smooth sliding indicator */}
      <span
        className="absolute bottom-2 h-[3px] rounded-full pointer-events-none"
        style={{
          left: indicatorStyle.left,
          width: indicatorStyle.width,
          backgroundColor: indicatorStyle.color,
          boxShadow: `0 0 8px ${indicatorStyle.color}66`,
          opacity: indicatorStyle.opacity,
          transition:
            'left 0.3s cubic-bezier(0.19, 1, 0.22, 1), width 0.3s cubic-bezier(0.19, 1, 0.22, 1), opacity 0.2s ease-out',
        }}
      />

      {tabs.map((tab, idx) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id ?? 'all'}
            data-tab-idx={idx}
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
                className="ml-0.5 rounded-full px-1.5 py-0 text-[9px] font-medium"
                style={{
                  backgroundColor: `${tab.color}20`,
                  opacity: isActive ? 1 : 0.6,
                }}
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
