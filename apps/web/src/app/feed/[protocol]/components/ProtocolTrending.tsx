'use client';

import Link from 'next/link';

interface TrendingTopic {
  topic: string;
  count: number;
  score: number;
}

interface ProtocolTrendingProps {
  protocol: string;
  topics: TrendingTopic[];
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
};

export function ProtocolTrending({
  protocol,
  topics,
  color: explicitColor,
}: ProtocolTrendingProps) {
  const color = explicitColor ?? PROTOCOL_COLORS[protocol] ?? '#666';

  if (!topics || topics.length === 0) {
    return null;
  }

  const maxScore = Math.max(...topics.map((t) => t.score), 1);

  return (
    <div
      className="mb-6 overflow-hidden rounded-xl border"
      style={{
        borderColor: `${color}22`,
        backgroundColor: `${color}04`,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between border-b px-4 py-3"
        style={{ borderColor: `${color}15` }}
      >
        <h2 className="text-sm font-bold" style={{ color: 'var(--color-fg)' }}>
          📈 Trending on {protocol.charAt(0).toUpperCase() + protocol.slice(1)}
        </h2>
        <Link
          href={`/feed/${protocol}/trending`}
          className="text-[10px] font-medium transition-colors hover:underline"
          style={{ color }}
        >
          View all →
        </Link>
      </div>

      {/* Topic list */}
      <div className="divide-y" style={{ borderColor: `${color}10` }}>
        {topics.slice(0, 8).map((topic, i) => {
          const barWidth = Math.max(10, (topic.score / maxScore) * 100);
          return (
            <Link
              key={topic.topic}
              href={`/search?q=${encodeURIComponent(topic.topic)}`}
              className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--color-overlay)]"
            >
              {/* Rank */}
              <span
                className="w-5 text-center text-xs font-bold tabular-nums"
                style={{ color: i < 3 ? color : 'var(--color-muted)' }}
              >
                {i + 1}
              </span>

              {/* Topic name + activity bar */}
              <div className="min-w-0 flex-1">
                <span className="text-sm font-medium" style={{ color: 'var(--color-fg)' }}>
                  {topic.topic}
                </span>
                <div
                  className="mt-1 h-1 rounded-full transition-all"
                  style={{
                    width: `${barWidth}%`,
                    backgroundColor: `${color}30`,
                  }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: '100%',
                      backgroundColor: color,
                      opacity: 0.5,
                    }}
                  />
                </div>
              </div>

              {/* Post count */}
              <span className="text-xs tabular-nums" style={{ color: 'var(--color-muted)' }}>
                {topic.count}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
