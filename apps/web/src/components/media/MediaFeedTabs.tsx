/**
 * @degenfeed/web — MediaFeedTabs
 *
 * Filter tabs for the media feed: All | Images | Videos | Live.
 * Features smooth animated active indicator and count badges.
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MediaFilter } from './MediaTypes';
import { MEDIA_TABS } from './MediaTypes';

interface MediaFeedTabsProps {
  activeTab: MediaFilter;
  onTabChange: (tab: MediaFilter) => void;
  counts?: Partial<Record<MediaFilter, number>>;
}

export function MediaFeedTabs({ activeTab, onTabChange, counts }: MediaFeedTabsProps) {
  const tabsRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState({
    left: 0,
    width: 0,
    opacity: 0,
  });

  const updateIndicator = useCallback(() => {
    if (!tabsRef.current) return;
    const activeIdx = MEDIA_TABS.findIndex((t) => t.id === activeTab);
    if (activeIdx < 0) return;
    const button = tabsRef.current.querySelector<HTMLButtonElement>(
      `[data-media-tab-idx="${activeIdx}"]`,
    );
    if (!button) return;
    const containerRect = tabsRef.current.getBoundingClientRect();
    const btnRect = button.getBoundingClientRect();
    setIndicatorStyle({
      left: btnRect.left - containerRect.left,
      width: btnRect.width,
      opacity: 1,
    });
  }, [activeTab]);

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
      aria-label="Filter media by type"
      ref={tabsRef}
    >
      {/* Animated slide indicator */}
      <span
        className="absolute bottom-2 h-[3px] rounded-full pointer-events-none transition-all duration-300"
        style={{
          left: indicatorStyle.left,
          width: indicatorStyle.width,
          opacity: indicatorStyle.opacity,
          backgroundColor: 'var(--color-accent)',
          boxShadow: '0 0 8px var(--color-accent)',
        }}
      />

      {MEDIA_TABS.map((tab, idx) => {
        const isActive = activeTab === tab.id;
        const count = counts?.[tab.id];

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            data-media-tab-idx={idx}
            onClick={() => onTabChange(tab.id)}
            className={`
              relative flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold
              transition-all duration-200 whitespace-nowrap
              ${
                isActive
                  ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] shadow-sm'
                  : 'text-[var(--color-muted)] hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)]'
              }
            `}
          >
            <span className="text-base" aria-hidden="true">
              {tab.icon}
            </span>
            <span>{tab.label}</span>
            {count !== undefined && (
              <span
                className="ml-0.5 rounded-full px-1.5 py-0 text-[9px] font-medium tabular-nums"
                style={{
                  backgroundColor: isActive ? 'var(--color-accent)' : 'var(--color-overlay)',
                  color: isActive ? '#fff' : 'var(--color-muted)',
                }}
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
