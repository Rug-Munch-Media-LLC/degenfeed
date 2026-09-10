'use client';

/**
 * ContentPerformance — post engagement table per protocol
 *
 * Displays the creator's top-performing posts across all protocols,
 * with engagement metrics and protocol badges.
 */

import type {
  ContentPerformance as ContentPerformanceType,
  TopPost,
} from '../../hooks/useAnalytics';

interface ContentPerformanceProps {
  content: ContentPerformanceType | null | undefined;
  loading?: boolean;
}

const PROTOCOL_COLORS: Record<string, string> = {
  nostr: '#8e30eb',
  farcaster: '#8a63d2',
  lens: '#abfe2c',
  bluesky: '#1185fe',
  mastodon: '#6364ff',
  threads: '#888888',
  reddit: '#ff4500',
};

const PROTOCOL_LABELS: Record<string, string> = {
  nostr: 'Nostr',
  farcaster: 'Farcaster',
  lens: 'Lens',
  bluesky: 'Bluesky',
  mastodon: 'Mastodon',
  threads: 'Threads',
  reddit: 'Reddit',
};

export function ContentPerformance({ content, loading = false }: ContentPerformanceProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 animate-pulse">
        <div className="h-4 w-32 rounded bg-[var(--color-muted)]/20 mb-4" />
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 rounded bg-[var(--color-muted)]/10" />
          ))}
        </div>
      </div>
    );
  }

  if (!content || content.totalPosts === 0) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
        <h3 className="text-sm font-semibold text-[var(--color-fg)] mb-1">Content Performance</h3>
        <p className="text-xs text-[var(--color-muted)]">
          No content data yet. Start posting across protocols to see performance metrics.
        </p>
      </div>
    );
  }

  const totalEngagement = Object.values(content.engagementPerPost).reduce(
    (s, ep) => s + ep.total,
    0,
  );

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[var(--color-fg)]">Content Performance</h3>
        <span className="text-[10px] text-[var(--color-muted)]">
          {content.totalPosts} posts · {totalEngagement.toLocaleString()} total engagements
        </span>
      </div>

      {/* Best protocol highlight */}
      {content.bestProtocol && (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-[var(--color-accent)]/5 px-3 py-2 text-xs">
          <span className="text-[var(--color-muted)]">Best performing protocol:</span>
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{
              backgroundColor: `${PROTOCOL_COLORS[content.bestProtocol] ?? '#888'}20`,
              color: PROTOCOL_COLORS[content.bestProtocol] ?? '#888',
            }}
          >
            {PROTOCOL_LABELS[content.bestProtocol] ?? content.bestProtocol}
          </span>
          <span className="text-[var(--color-muted)]">
            — avg {content.bestProtocolEngagement.toFixed(0)} engagements/post
          </span>
        </div>
      )}

      {/* Protocol engagement breakdown */}
      <div className="mb-4 space-y-2">
        {Object.entries(content.engagementPerPost)
          .sort(([, a], [, b]) => b.total - a.total)
          .map(([protocol, ep]) => {
            const color = PROTOCOL_COLORS[protocol] ?? '#888';
            const label = PROTOCOL_LABELS[protocol] ?? protocol;
            const percentage = totalEngagement > 0 ? (ep.total / totalEngagement) * 100 : 0;

            return (
              <div key={protocol} className="group">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[11px] font-medium" style={{ color }}>
                    {label}
                  </span>
                  <span className="text-[10px] text-[var(--color-muted)]">
                    {ep.total.toLocaleString()} engagements · {ep.avg.toFixed(1)} avg
                  </span>
                </div>
                <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-muted)]/10">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${percentage}%`, backgroundColor: color }}
                  />
                </div>
              </div>
            );
          })}
      </div>

      {/* Posting patterns */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        {content.byWeekday.length > 0 && (
          <div>
            <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)] block mb-1.5">
              Posts by Day
            </span>
            <div className="space-y-1">
              {content.weekdayLabels.map((day, i) => {
                const maxVal = Math.max(...content.byWeekday, 1);
                return (
                  <div key={day} className="flex items-center gap-2 text-[10px]">
                    <span className="w-6 text-[var(--color-muted)]">{day}</span>
                    <div className="flex-1 h-2 rounded-full bg-[var(--color-muted)]/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[var(--color-accent)]/40"
                        style={{ width: `${(content.byWeekday[i] / maxVal) * 100}%` }}
                      />
                    </div>
                    <span className="w-4 text-right text-[var(--color-fg)]">
                      {content.byWeekday[i]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {content.typeBreakdown && (
          <div>
            <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)] block mb-1.5">
              Content Types
            </span>
            <div className="space-y-1.5">
              {(
                [
                  ['text', 'Text'],
                  ['photo', 'Photo'],
                  ['video', 'Video'],
                  ['link', 'Link'],
                ] as const
              ).map(([key, label]) => {
                const count = content.typeBreakdown[key as keyof typeof content.typeBreakdown] ?? 0;
                const total = Object.values(content.typeBreakdown).reduce((s, v) => s + v, 0) || 1;
                return (
                  <div key={key} className="flex items-center gap-2 text-[10px]">
                    <span className="w-10 text-[var(--color-muted)]">{label}</span>
                    <div className="flex-1 h-2 rounded-full bg-[var(--color-muted)]/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[var(--color-accent)]/40"
                        style={{ width: `${(count / total) * 100}%` }}
                      />
                    </div>
                    <span className="w-6 text-right text-[var(--color-fg)]">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Top posts table */}
      {content.topPosts.length > 0 && (
        <div>
          <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)] block mb-2">
            Top Posts
          </span>
          <div className="space-y-1.5">
            {content.topPosts.slice(0, 5).map((post) => (
              <PostRow key={post.id} post={post} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Post row sub-component ─────────────────────────────────────────

function PostRow({ post }: { post: TopPost }) {
  const color = PROTOCOL_COLORS[post.protocol] ?? '#888';
  const label = PROTOCOL_LABELS[post.protocol] ?? post.protocol;

  const totalEng = post.likes + post.reposts + post.replies;

  return (
    <div className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[var(--color-muted)]/5 transition-colors">
      {/* Protocol badge */}
      <span
        className="flex-shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium"
        style={{
          backgroundColor: `${color}20`,
          color,
        }}
      >
        {label}
      </span>

      {/* Content preview */}
      <p className="flex-1 truncate text-[11px] text-[var(--color-muted)]">{post.content}</p>

      {/* Engagement stats */}
      <div className="flex items-center gap-2 text-[10px] text-[var(--color-muted)] flex-shrink-0">
        <span title="Likes">♥ {post.likes}</span>
        <span title="Reposts">↻ {post.reposts}</span>
        <span title="Replies">↩ {post.replies}</span>
        <span title="Total engagement" className="font-medium text-[var(--color-fg)]">
          {totalEng}
        </span>
      </div>
    </div>
  );
}
