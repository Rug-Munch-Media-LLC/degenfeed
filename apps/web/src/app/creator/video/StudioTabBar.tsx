'use client';

import type { VideoTab } from './types';
import { TABS } from './types';

export default function StudioTabBar({
  activeTab,
  onTabChange,
}: {
  activeTab: VideoTab;
  onTabChange: (tab: VideoTab) => void;
}) {
  return (
    <div
      className="mb-6 flex gap-1 overflow-x-auto rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-1 scrollbar-none"
      role="tablist"
      aria-label="Video Studio tabs"
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onTabChange(tab.id)}
            className={`relative flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-medium transition-all ${
              isActive
                ? 'bg-gradient-to-br from-degen-500/15 to-emerald-500/10 text-degen-400 shadow-sm'
                : 'text-[var(--color-muted)] hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)]'
            }`}
          >
            <span className="text-sm" aria-hidden="true">
              {tab.icon}
            </span>
            <div className="text-left">
              <div className="text-xs font-semibold">{tab.label}</div>
              <div className="text-[8px] opacity-60 hidden sm:block">{tab.desc}</div>
            </div>
            {isActive && (
              <span className="absolute -bottom-px left-2 right-2 h-0.5 rounded-full bg-degen-500 shadow-[0_0_8px_rgba(0,255,65,0.6)]" />
            )}
          </button>
        );
      })}
    </div>
  );
}
