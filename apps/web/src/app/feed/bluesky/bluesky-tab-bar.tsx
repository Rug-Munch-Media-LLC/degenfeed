/**
 * @degenfeed/web — Bluesky Tab Bar & Loading Skeleton
 */

'use client';

import type { PullState } from './bluesky-media-hooks';
import type { TabConfig, TabId } from './bluesky-media-types';
import { BLUESKY_BLUE } from './bluesky-media-types';

// ─── Pull-to-Refresh Indicator ───────────────────────────────────

export function PullIndicator({ state, distance }: { state: PullState; distance: number }) {
  if (state === 'idle') return null;

  const height = state === 'refreshing' ? 48 : Math.min(distance * 0.4, 60);

  return (
    <div
      className="flex items-center justify-center gap-2 overflow-hidden transition-all"
      style={{ height, color: BLUESKY_BLUE }}
    >
      {state === 'refreshing' ? (
        <>
          <svg
            aria-hidden="true"
            className="animate-spin"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" />
            <path
              d="M12 2a10 10 0 0110 10"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
          <span className="text-xs font-medium">Refreshing...</span>
        </>
      ) : state === 'ready' ? (
        <>
          <svg
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <span className="text-xs font-medium">Release to refresh</span>
        </>
      ) : (
        <svg
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="transition-transform"
          style={{ transform: `rotate(${distance * 2}deg)` }}
        >
          <path d="M12 5v14M5 12l7-7 7 7" />
        </svg>
      )}
    </div>
  );
}

// ─── Tab Bar ─────────────────────────────────────────────────────

export function TabBar({
  tabs,
  activeTab,
  onTabChange,
}: {
  tabs: TabConfig[];
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}) {
  return (
    <div
      className="mb-6 flex gap-1 rounded-xl p-1"
      style={{ backgroundColor: 'var(--color-card)' }}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onTabChange(tab.id)}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150"
          style={{
            backgroundColor: activeTab === tab.id ? BLUESKY_BLUE : 'transparent',
            color: activeTab === tab.id ? '#fff' : 'var(--color-muted)',
          }}
        >
          <span className="text-base">{tab.icon}</span>
          <span className="hidden sm:inline">{tab.label}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Loading Skeleton ────────────────────────────────────────────

export function SkeletonGrid({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-xl"
          style={{
            backgroundColor: 'var(--color-card)',
            animationDelay: `${i * 60}ms`,
            aspectRatio: i % 3 === 0 ? '4/3' : i % 3 === 1 ? '1/1' : '3/4',
          }}
        >
          <div className="relative h-full w-full">
            <div className="skeleton-shimmer absolute inset-0" />
            <div className="absolute bottom-0 left-0 right-0 p-3">
              <div className="flex items-center gap-2">
                <div
                  className="h-6 w-6 rounded-full"
                  style={{ background: 'rgba(255,255,255,0.15)' }}
                />
                <div
                  className="h-3 w-24 rounded"
                  style={{ background: 'rgba(255,255,255,0.15)' }}
                />
              </div>
              <div className="mt-2 flex gap-3">
                <div className="h-3 w-12 rounded" style={{ background: 'rgba(255,255,255,0.1)' }} />
                <div className="h-3 w-12 rounded" style={{ background: 'rgba(255,255,255,0.1)' }} />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
