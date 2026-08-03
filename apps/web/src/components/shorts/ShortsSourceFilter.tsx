'use client';

/**
 * ShortsSourceFilter — Source/protocol filter picker for shorts feed.
 *
 * Allows users to:
 *   - Filter by specific source (Loops, YouTube, TikTok, etc.)
 *   - Choose preferred platforms (saved as user preference)
 *   - Toggle between "Show me only Loops" and "Show me everything"
 *
 * Sources grouped by type:
 *   Self-Hosted: Loops, PeerTube, Pixelfed
 *   Protocol: AT Protocol, Nostr, Farcaster, Lens
 *   Commercial: YouTube, TikTok, Instagram
 *   NFT: Zora
 *   Native: DegenFeed
 */

import { useCallback } from 'react';
import { sourceBadgeData } from './ShortsSourceBadge';

// ─── Types ───────────────────────────────────────────────────────────────

export interface SourceOption {
  key: string;
  label: string;
  group: 'self-hosted' | 'protocol' | 'commercial' | 'nft' | 'native';
  description: string;
}

export interface UserPreferredSources {
  enabled: string[]; // source keys that are enabled
  onlyLoops: boolean; // shortcut: only show Loops
}

type FilterMode = 'all' | 'only-loops' | 'selected';

interface ShortsSourceFilterProps {
  /** Currently active source filter (null = all) */
  activeSource: string | null;
  /** User's preferred sources */
  preferredSources: UserPreferredSources;
  /** Available source counts from the feed */
  sourceCounts: Record<string, number>;
  /** Callback when source filter changes */
  onSourceChange: (source: string | null) => void;
  /** Callback when preferred sources updated */
  onPreferencesChange: (prefs: UserPreferredSources) => void;
  /** Show the "show me only Loops" toggle */
  showLoopsToggle?: boolean;
}

// ─── All available source options ────────────────────────────────────────

export const ALL_SOURCE_OPTIONS: SourceOption[] = [
  // Self-hosted
  { key: 'loops', label: 'Loops', group: 'self-hosted', description: 'Our self-hosted shorts' },
  { key: 'peertube', label: 'PeerTube', group: 'self-hosted', description: 'Federated video' },
  {
    key: 'pixelfed',
    label: 'Pixelfed',
    group: 'self-hosted',
    description: 'Federated images/video',
  },
  // Protocol
  { key: 'atprotocol', label: 'AT Protocol', group: 'protocol', description: 'Bluesky, Flashes' },
  { key: 'nostr', label: 'Nostr', group: 'protocol', description: 'Snort, Primal' },
  { key: 'farcaster', label: 'Farcaster', group: 'protocol', description: 'Warpcast' },
  { key: 'lens', label: 'Lens', group: 'protocol', description: 'Hey, Orb' },
  // Commercial
  { key: 'youtube', label: 'YouTube', group: 'commercial', description: 'YouTube Shorts' },
  { key: 'tiktok', label: 'TikTok', group: 'commercial', description: 'TikTok videos' },
  { key: 'instagram', label: 'Instagram', group: 'commercial', description: 'Instagram Reels' },
  // NFT
  { key: 'zora', label: 'Zora', group: 'nft', description: 'Video NFTs' },
  // Native
  { key: 'degenfeed', label: 'DegenFeed', group: 'native', description: 'Native DegenFeed' },
];

const _GROUP_LABELS: Record<string, string> = {
  'self-hosted': 'Self-Hosted',
  protocol: 'Protocol',
  commercial: 'Commercial',
  nft: 'NFT',
  native: 'Native',
};

// ─── Component ───────────────────────────────────────────────────────────

export function ShortsSourceFilter({
  activeSource,
  preferredSources,
  sourceCounts,
  onSourceChange,
  onPreferencesChange,
  showLoopsToggle = true,
}: ShortsSourceFilterProps) {
  // ── Toggle preferred source ────────────────────────────────────────

  const togglePreferredSource = useCallback(
    (key: string) => {
      const current = preferredSources.enabled;
      const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];

      onPreferencesChange({
        ...preferredSources,
        enabled: next,
      });
    },
    [preferredSources, onPreferencesChange],
  );

  // ── Toggle "Loops Only" mode ────────────────────────────────────────

  const toggleLoopsOnly = useCallback(() => {
    const nextOnlyLoops = !preferredSources.onlyLoops;

    onPreferencesChange({
      ...preferredSources,
      onlyLoops: nextOnlyLoops,
    });

    // If enabling, switch active filter to loops
    // If disabling, switch back to all
    onSourceChange(nextOnlyLoops ? 'loops' : null);
  }, [preferredSources, onPreferencesChange, onSourceChange]);

  // ── Determine current mode ─────────────────────────────────────────

  const currentMode: FilterMode = preferredSources.onlyLoops
    ? 'only-loops'
    : activeSource
      ? 'selected'
      : 'all';

  return (
    <div className="flex flex-col gap-3">
      {/* == Mode toggles == */}
      <div className="flex items-center gap-1.5">
        {/* All sources */}
        <button
          type="button"
          onClick={() => {
            onPreferencesChange({ ...preferredSources, onlyLoops: false });
            onSourceChange(null);
          }}
          className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider transition-all ${
            currentMode === 'all'
              ? 'border-degen-500/40 bg-degen-500/15 text-degen-400'
              : 'border-white/10 text-white/50 hover:border-white/20 hover:text-white/70'
          }`}
        >
          <span className="flex items-center gap-1">
            <span className="text-[11px]">◆</span>
            All Sources
          </span>
        </button>

        {/* Loops Only toggle */}
        {showLoopsToggle && (
          <button
            type="button"
            onClick={toggleLoopsOnly}
            className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider transition-all ${
              currentMode === 'only-loops'
                ? 'border-orange-500/40 bg-orange-500/15 text-orange-400'
                : 'border-white/10 text-white/50 hover:border-white/20 hover:text-white/70'
            }`}
          >
            <span className="flex items-center gap-1">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{
                  backgroundColor:
                    currentMode === 'only-loops' ? '#F1680D' : 'rgba(255,255,255,0.3)',
                }}
              />
              Loops Only
            </span>
          </button>
        )}
      </div>

      {/* == Source quick-pills (top sources with counts) == */}
      {currentMode !== 'only-loops' && (
        <div className="flex flex-wrap gap-1.5">
          {ALL_SOURCE_OPTIONS.map((opt) => {
            const count = sourceCounts[opt.key] ?? 0;
            const isActive = activeSource === opt.key;
            const isPreferred = preferredSources.enabled.includes(opt.key);
            const badge = sourceBadgeData(opt.key);

            // Only show sources that have content
            if (count === 0 && !isActive) return null;

            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => onSourceChange(isActive ? null : opt.key)}
                title={opt.description}
                className={`inline-flex items-center gap-1 rounded-full border py-1 text-[10px] font-medium transition-all ${
                  isActive
                    ? 'px-2.5 shadow-[0_0_8px_rgba(0,0,0,0.2)]'
                    : 'px-2 opacity-70 hover:opacity-100'
                }`}
                style={{
                  backgroundColor: isActive ? `${badge.color}1A` : `${badge.color}08`,
                  borderColor: isActive ? `${badge.color}50` : `${badge.color}20`,
                  color: badge.color,
                }}
              >
                {/* Preferred indicator */}
                {isPreferred && (
                  <svg
                    width="8"
                    height="8"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                )}
                <span style={{ opacity: isActive ? 1 : 0.8 }}>{opt.label}</span>
                {count > 0 && (
                  <span className="tabular-nums" style={{ opacity: isActive ? 1 : 0.5 }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* == Preferred platforms selector (collapsible) == */}
      {currentMode !== 'only-loops' && (
        <details className="group">
          <summary className="cursor-pointer text-[9px] font-medium text-white/40 transition-colors hover:text-white/60">
            <span className="flex items-center gap-1">
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
                className="transition-transform group-open:rotate-90"
              >
                <path
                  d="M9 18l6-6-6-6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Preferred Platforms ({preferredSources.enabled.length} selected)
            </span>
          </summary>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {ALL_SOURCE_OPTIONS.map((opt) => {
              const isPreferred = preferredSources.enabled.includes(opt.key);
              const badge = sourceBadgeData(opt.key);

              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => togglePreferredSource(opt.key)}
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-medium transition-all ${
                    isPreferred
                      ? 'border-degen-500/30 bg-degen-500/10 text-degen-400'
                      : 'border-white/10 text-white/40 hover:border-white/20 hover:text-white/60'
                  }`}
                  title={`${opt.label}: ${opt.description}`}
                >
                  {isPreferred ? (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                        d="M20 6L9 17l-5-5"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-full opacity-40"
                      style={{ backgroundColor: badge.color }}
                    />
                  )}
                  {opt.label}
                </button>
              );
            })}
          </div>
        </details>
      )}
    </div>
  );
}
