'use client';

interface ProtocolStatsProps {
  protocol: string;
  totalPosts?: number;
  activeUsers24h?: number;
  engagementVelocity?: number;
  trendingTopics?: { topic: string; count: number; score: number }[];
  color?: string;
}

const PROTOCOL_COLORS: Record<string, string> = {
  nostr: '#8e30eb',
  farcaster: '#8a63d2',
  lens: '#abfe2c',
  bluesky: '#1185fe',
  mastodon: '#6364ff',
  reddit: '#ff4500',
  rss: '#ffa500',
  threads: '#888',
  lemmy: '#2d9cdb',
  pixelfed: '#f9a825',
  peertube: '#f1680d',
  zora: '#6b21a8',
  audius: '#cc0fe0',
  rarible: '#feda02',
  github: '#6e40c9',
  youtube: '#ff0000',
  telegram: '#26a5e4',
  discord: '#5865f2',
  hive: '#e31337',
  misskey: '#86b300',
  pleroma: '#fba740',
};

export function ProtocolStats({
  protocol,
  totalPosts,
  activeUsers24h,
  engagementVelocity,
  trendingTopics,
  color: explicitColor,
}: ProtocolStatsProps) {
  const color = explicitColor ?? PROTOCOL_COLORS[protocol] ?? '#666';

  return (
    <fieldset
      className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4"
      aria-label="Protocol statistics"
    >
      {/* Total posts */}
      <div
        className="rounded-xl border p-4 transition-all"
        style={{
          borderColor: `${color}22`,
          backgroundColor: `${color}06`,
        }}
      >
        <p
          className="text-[10px] font-medium uppercase tracking-wider"
          style={{ color: `${color}aa` }}
        >
          Total Posts
        </p>
        <p className="mt-1.5 text-2xl font-bold tabular-nums" style={{ color }}>
          {totalPosts !== undefined ? totalPosts.toLocaleString() : '—'}
        </p>
        {totalPosts !== undefined && (
          <div className="mt-2 h-1 w-full rounded-full" style={{ backgroundColor: `${color}15` }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, (totalPosts / 10000) * 100)}%`,
                backgroundColor: color,
                opacity: 0.6,
              }}
            />
          </div>
        )}
      </div>

      {/* Active users */}
      <div
        className="rounded-xl border p-4 transition-all"
        style={{
          borderColor: `${color}22`,
          backgroundColor: `${color}06`,
        }}
      >
        <p
          className="text-[10px] font-medium uppercase tracking-wider"
          style={{ color: `${color}aa` }}
        >
          Active Users
        </p>
        <p className="mt-1.5 text-2xl font-bold tabular-nums" style={{ color }}>
          {activeUsers24h !== undefined ? activeUsers24h.toLocaleString() : '—'}
        </p>
        <p className="mt-1 text-[10px]" style={{ color: `${color}88` }}>
          past 24h
        </p>
      </div>

      {/* Engagement velocity */}
      <div
        className="rounded-xl border p-4 transition-all"
        style={{
          borderColor: `${color}22`,
          backgroundColor: `${color}06`,
        }}
      >
        <p
          className="text-[10px] font-medium uppercase tracking-wider"
          style={{ color: `${color}aa` }}
        >
          Engagement
        </p>
        <p className="mt-1.5 text-2xl font-bold tabular-nums" style={{ color }}>
          {engagementVelocity !== undefined ? engagementVelocity.toFixed(1) : '—'}
        </p>
        <p className="mt-1 text-[10px]" style={{ color: `${color}88` }}>
          avg per post
        </p>
      </div>

      {/* Trending topics */}
      <div
        className="rounded-xl border p-4 transition-all"
        style={{
          borderColor: `${color}22`,
          backgroundColor: `${color}06`,
        }}
      >
        <p
          className="text-[10px] font-medium uppercase tracking-wider"
          style={{ color: `${color}aa` }}
        >
          Trending
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {trendingTopics && trendingTopics.length > 0 ? (
            trendingTopics.slice(0, 3).map((t) => (
              <span
                key={t.topic}
                className="inline-block rounded-full px-1.5 py-0.5 text-[9px] font-medium"
                style={{
                  backgroundColor: `${color}18`,
                  color,
                }}
              >
                {t.topic}
              </span>
            ))
          ) : (
            <span className="text-sm text-[var(--color-muted)]">—</span>
          )}
        </div>
      </div>
    </fieldset>
  );
}
