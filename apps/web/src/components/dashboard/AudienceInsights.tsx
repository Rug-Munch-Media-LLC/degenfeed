'use client';

/**
 * AudienceInsights — follower growth, engagement rates, and demographics
 *
 * Shows per-protocol follower counts, growth trends, engagement rates,
 * and top content driving audience growth.
 */

import type { AudienceInsights as AudienceInsightsType } from '../../hooks/useAnalytics';

interface AudienceInsightsProps {
  audience: AudienceInsightsType | null | undefined;
  loading?: boolean;
}

const PROTOCOL_COLORS: Record<string, string> = {
  nostr: '#8e30eb',
  farcaster: '#8a63d2',
  lens: '#abfe2c',
  bluesky: '#1185fe',
  mastodon: '#6364ff',
  threads: '#888888',
};

const PROTOCOL_LABELS: Record<string, string> = {
  nostr: 'Nostr',
  farcaster: 'Farcaster',
  lens: 'Lens',
  bluesky: 'Bluesky',
  mastodon: 'Mastodon',
  threads: 'Threads',
};

export function AudienceInsights({ audience, loading = false }: AudienceInsightsProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 animate-pulse">
        <div className="h-4 w-28 rounded bg-[var(--color-muted)]/20 mb-4" />
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <div className="h-3 w-16 rounded bg-[var(--color-muted)]/10" />
            <div className="h-8 w-full rounded bg-[var(--color-muted)]/10" />
          </div>
          <div className="space-y-2">
            <div className="h-3 w-16 rounded bg-[var(--color-muted)]/10" />
            <div className="h-8 w-full rounded bg-[var(--color-muted)]/10" />
          </div>
        </div>
      </div>
    );
  }

  if (!audience || audience.total === 0) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
        <h3 className="text-sm font-semibold text-[var(--color-fg)] mb-1">Audience Insights</h3>
        <p className="text-xs text-[var(--color-muted)]">
          Connect your social accounts to see audience analytics.
        </p>
      </div>
    );
  }

  function formatCompact(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toFixed(0);
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[var(--color-fg)]">Audience Insights</h3>
        <span className="text-[10px] text-[var(--color-muted)]">
          {formatCompact(audience.total)} total followers
        </span>
      </div>

      {/* Per-protocol audience breakdown */}
      <div className="mb-4">
        <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)] block mb-2">
          Followers by Protocol
        </span>
        <div className="space-y-2">
          {Object.entries(audience.byProtocol)
            .sort(([, a], [, b]) => b - a)
            .map(([protocol, count]) => {
              const color = PROTOCOL_COLORS[protocol] ?? '#888';
              const label = PROTOCOL_LABELS[protocol] ?? protocol;
              const percentage = audience.total > 0 ? (count / audience.total) * 100 : 0;

              return (
                <div key={protocol}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span
                      className="text-[11px] font-medium flex items-center gap-1.5"
                      style={{ color }}
                    >
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      {label}
                    </span>
                    <span className="text-[11px] text-[var(--color-fg)] font-mono">
                      {formatCompact(count)}
                      <span className="text-[9px] text-[var(--color-muted)] ml-1">
                        ({percentage.toFixed(0)}%)
                      </span>
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-muted)]/10">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${percentage}%`, backgroundColor: color }}
                    />
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Engagement rates */}
      {Object.keys(audience.engagementByProtocol).length > 0 && (
        <div className="mb-4">
          <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)] block mb-2">
            Engagement Rates by Protocol
          </span>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(audience.engagementByProtocol)
              .sort(([, a], [, b]) => b.rate - a.rate)
              .map(([protocol, eng]) => {
                const color = PROTOCOL_COLORS[protocol] ?? '#888';
                const label = PROTOCOL_LABELS[protocol] ?? protocol;

                return (
                  <div
                    key={protocol}
                    className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)]/50 p-2.5"
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span
                        className="inline-block h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-[10px] text-[var(--color-muted)]">{label}</span>
                    </div>
                    <span className="text-sm font-bold text-[var(--color-fg)]">
                      {(eng.rate * 100).toFixed(1)}%
                    </span>
                    <span className="text-[9px] text-[var(--color-muted)] ml-1">rate</span>
                    <div className="flex gap-2 mt-0.5 text-[9px] text-[var(--color-muted)]">
                      <span>♥ {eng.likes}</span>
                      <span>↻ {eng.reposts}</span>
                      <span>↩ {eng.replies}</span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Overall engagement rate */}
      <div className="flex items-center justify-between rounded-lg bg-[var(--color-accent)]/5 px-3 py-2 mb-4">
        <span className="text-xs text-[var(--color-muted)]">Overall Engagement Rate</span>
        <span className="text-sm font-bold text-[var(--color-fg)]">
          {(audience.engagementRate * 100).toFixed(1)}%
        </span>
      </div>

      {/* Top content */}
      {audience.topContent.length > 0 && (
        <div>
          <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)] block mb-2">
            Top Content Driving Growth
          </span>
          <div className="space-y-1">
            {audience.topContent.slice(0, 3).map((post) => {
              const color = PROTOCOL_COLORS[post.protocol] ?? '#888';
              return (
                <div
                  key={post.id}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[var(--color-muted)]/5 transition-colors"
                >
                  <span
                    className="flex-shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium"
                    style={{ backgroundColor: `${color}20`, color }}
                  >
                    {PROTOCOL_LABELS[post.protocol] ?? post.protocol}
                  </span>
                  <p className="flex-1 truncate text-[11px] text-[var(--color-muted)]">
                    {post.content.slice(0, 100)}
                  </p>
                  <span className="text-[10px] text-[var(--color-muted)] flex-shrink-0">
                    {post.likes + post.reposts + post.replies} eng
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
