'use client';

/**
 * ShortsSourceBar — Horizontal protocol source breakdown.
 *
 * Shows a scrollable row of pills indicating how many shorts came from
 * each protocol, with the protocol's brand color.
 *
 * Example:
 *   🟠 12 Loops  🔵 8 Flashes  🟣 5 Nostr  🟢 3 Lens  🔷 2 Zora
 */

import type { ShortSource } from '../../hooks/useUnifiedShorts';
import { sourceBadgeData } from './ShortsSourceBadge';

export interface SourceCountItem {
  source: ShortSource;
  count: number;
}

interface ShortsSourceBarProps {
  sources: Record<string, number>;
  activeSource?: ShortSource | null;
  onSourceClick?: (source: ShortSource | null) => void;
  compact?: boolean;
}

// Human-readable labels for each protocol
const SOURCE_LABELS: Partial<Record<ShortSource, string>> = {
  activitypub: 'Loops',
  atprotocol: 'Flashes',
  nostr: 'Nostr',
  farcaster: 'Farcaster',
  lens: 'Lens',
  zora: 'Zora',
  peertube: 'PeerTube',
  degenfeed: 'DegenFeed',
};

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function ShortsSourceBar({
  sources,
  activeSource,
  onSourceClick,
  compact = false,
}: ShortsSourceBarProps) {
  const entries = Object.entries(sources)
    .filter(([, count]) => count > 0)
    .sort(([, a], [, b]) => b - a);

  if (entries.length === 0) return null;

  return (
    <div
      className="flex items-center gap-1.5 overflow-x-auto scrollbar-none"
      role="tablist"
      aria-label="Content source filter"
    >
      {/* "All" pill */}
      <button
        type="button"
        role="tab"
        aria-selected={!activeSource}
        onClick={() => onSourceClick?.(null)}
        className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider transition-all
          ${
            !activeSource
              ? 'border-degen-500/40 bg-degen-500/15 text-degen-400 shadow-[0_0_8px_rgba(0,255,65,0.15)]'
              : 'border-white/10 bg-white/[0.04] text-white/50 hover:border-white/20 hover:text-white/70'
          }`}
      >
        <span className="flex items-center gap-1">
          <span className="text-[11px]">◆</span>
          All
        </span>
      </button>

      {entries.map(([source, count]) => {
        const badge = sourceBadgeData(source);
        const label = SOURCE_LABELS[source as ShortSource] ?? badge.label;
        const isActive = activeSource === source;

        return (
          <button
            key={source}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSourceClick?.(source as ShortSource)}
            className="shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider transition-all"
            style={{
              backgroundColor: isActive ? `${badge.color}1A` : `${badge.color}0A`,
              borderColor: isActive ? `${badge.color}50` : `${badge.color}20`,
              color: isActive ? badge.color : `${badge.color}99`,
              boxShadow: isActive ? `0 0 10px ${badge.color}20` : undefined,
            }}
          >
            <span className="flex items-center gap-1">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: badge.color }}
                aria-hidden="true"
              />
              {!compact && <span>{label}</span>}
              <span className="tabular-nums" style={{ opacity: isActive ? 1 : 0.7 }}>
                {formatCount(count)}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
