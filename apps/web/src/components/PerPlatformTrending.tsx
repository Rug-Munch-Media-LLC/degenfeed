'use client';

import Link from 'next/link';
import { retryFetch } from '../lib/retryFetch';
import { useCallback, useEffect, useMemo, useState } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────

interface TrendingPost {
  id: string;
  text: string;
  author: { displayName: string; handle: string; avatar?: string };
  createdAt: number;
  likes: number;
  replies: number;
  reposts: number;
  engagementScore: number;
  topic?: string;
}

interface TrendingTopic {
  topic: string;
  count: number;
  score: number;
}

interface TrendingChannel {
  id: string;
  name: string;
  description?: string;
  memberCount?: number;
  postCount?: number;
  engagementScore?: number;
  imageUrl?: string;
}

interface TrendingCreator {
  id: string;
  displayName: string;
  handle: string;
  avatar?: string;
  postCount: number;
  engagementScore: number;
  followerCount?: number;
  change: number;
}

interface PlatformTrendingData {
  platform: string;
  posts: TrendingPost[];
  topics: TrendingTopic[];
  channels: TrendingChannel[];
  creators: TrendingCreator[];
  fetchedAt: number;
  filter?: { category: string; timeWindow: string };
}

interface TimeFilter {
  id: string;
  label: string;
  windowHours: number;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const TIME_FILTERS: TimeFilter[] = [
  { id: 'now', label: 'Now', windowHours: 1 },
  { id: 'today', label: 'Today', windowHours: 24 },
  { id: 'week', label: 'This Week', windowHours: 168 },
];

const CATEGORIES = [
  { id: 'all', label: 'All', emoji: '🔥' },
  { id: 'defi', label: 'DeFi', emoji: '📊' },
  { id: 'nft', label: 'NFT', emoji: '🖼' },
  { id: 'ai', label: 'AI', emoji: '🤖' },
  { id: 'trading', label: 'Trading', emoji: '📈' },
  { id: 'regulation', label: 'Regulation', emoji: '⚖️' },
  { id: 'security', label: 'Security', emoji: '🔒' },
  { id: 'memecoin', label: 'Memecoin', emoji: '🐸' },
];

const PROTOCOL_META: Record<
  string,
  { color: string; icon: string; name: string; postNoun: string }
> = {
  farcaster: { color: '#8a63d2', icon: '◈', name: 'Farcaster', postNoun: 'cast' },
  bluesky: { color: '#1185fe', icon: '☁', name: 'Bluesky', postNoun: 'skeet' },
  nostr: { color: '#8e30eb', icon: '☰', name: 'Nostr', postNoun: 'note' },
  lens: { color: '#abfe2c', icon: '◎', name: 'Lens', postNoun: 'publication' },
  mastodon: { color: '#6364ff', icon: 'M', name: 'Mastodon', postNoun: 'toot' },
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

function formatScore(score: number): string {
  if (score >= 1_000_000) return `${(score / 1_000_000).toFixed(1)}M`;
  if (score >= 1_000) return `${(score / 1_000).toFixed(1)}K`;
  return score.toFixed(0);
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function getCategoryColor(catId: string): string {
  const map: Record<string, string> = {
    all: '#22c55e',
    defi: '#6366f1',
    nft: '#ec4899',
    ai: '#06b6d4',
    trading: '#10b981',
    regulation: '#ef4444',
    security: '#dc2626',
    memecoin: '#f59e0b',
  };
  return map[catId] ?? '#888';
}

// ─── Skeleton ──────────────────────────────────────────────────────────────

function TrendingSkeleton({ color }: { color: string }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-48 animate-pulse rounded-2xl border p-5"
            style={{ borderColor: `${color}22`, backgroundColor: `${color}06` }}
          >
            <div className="mb-3 h-4 w-3/4 rounded" style={{ backgroundColor: `${color}18` }} />
            <div className="mb-2 h-3 w-1/2 rounded" style={{ backgroundColor: `${color}12` }} />
            <div className="h-3 w-full rounded" style={{ backgroundColor: `${color}12` }} />
            <div className="mt-3 h-3 w-2/3 rounded" style={{ backgroundColor: `${color}12` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Props ─────────────────────────────────────────────────────────────────

interface Props {
  protocol: string;
}

// ─── Component ─────────────────────────────────────────────────────────────

export function PerPlatformTrending({ protocol }: Props) {
  const meta = PROTOCOL_META[protocol] ?? PROTOCOL_META.farcaster!;
  const color = meta.color;

  const [activeTime, setActiveTime] = useState<TimeFilter>(TIME_FILTERS[1]!);
  const [activeCategory, setActiveCategory] = useState('all');
  const [data, setData] = useState<PlatformTrendingData | null>(null);
  const [state, setState] = useState<'loading' | 'loaded' | 'empty' | 'error'>('loading');
  const [error, setError] = useState<string>();

  const fetchTrending = useCallback(async () => {
    setState('loading');
    setError(undefined);
    try {
      const url = new URL('/api/trending/per-platform', window.location.origin);
      url.searchParams.set('platform', protocol);
      url.searchParams.set('category', activeCategory);
      url.searchParams.set('time', activeTime.id);
      const res = await retryFetch(url.toString(), {
        fetchOptions: {
          credentials: 'include',
          cache: 'no-store',
          headers: { 'cache-control': 'no-store' },
        },
      });
      if (!res.ok) throw new Error(`API returned ${res.status}`);
      const json = (await res.json()) as PlatformTrendingData;
      const hasData =
        json.posts.length > 0 || json.topics.length > 0 || json.creators.length > 0;
      setData(json);
      setState(hasData ? 'loaded' : 'empty');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trending');
      setState('error');
    }
  }, [protocol, activeCategory, activeTime.id]);

  useEffect(() => {
    void fetchTrending();
  }, [fetchTrending]);

  const maxPostScore = useMemo(
    () => (data?.posts.length ? Math.max(...data.posts.map((p) => p.engagementScore)) : 1),
    [data?.posts],
  );

  const maxCreatorScore = useMemo(
    () => (data?.creators.length ? Math.max(...data.creators.map((c) => c.engagementScore)) : 1),
    [data?.creators],
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* ── Header ── */}
      <div className="mb-6">
        <div className="mb-2 flex items-center gap-3">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-xl text-lg"
            style={{ backgroundColor: `${color}22`, color }}
          >
            🔥
          </span>
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-fg)]">
              Trending {meta.name}
            </h1>
            <p className="text-sm text-[var(--color-muted)]">
              What&apos;s trending on {meta.name} right now
            </p>
          </div>
        </div>

        {/* Time filter */}
        <div className="mt-4 flex flex-wrap gap-2">
          {TIME_FILTERS.map((f) => {
            const active = activeTime.id === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setActiveTime(f)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                  active
                    ? 'text-[var(--color-fg)] shadow-[0_0_12px_rgba(34,197,94,0.15)]'
                    : 'border border-[var(--color-border)] bg-[var(--color-overlay)] text-[var(--color-muted)] hover:border-[var(--color-border)] hover:text-[var(--color-fg)]'
                }`}
                style={active ? { backgroundColor: `${color}22`, color } : undefined}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {/* Category pills */}
        <div className="mt-3 flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => {
            const active = activeCategory === cat.id;
            const catColor = getCategoryColor(cat.id);
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
                  active
                    ? 'text-[var(--color-fg)] shadow-sm'
                    : 'border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-fg)]'
                }`}
                style={
                  active
                    ? {
                        backgroundColor: `${catColor}22`,
                        color: catColor,
                        boxShadow: `0 0 12px ${catColor}22`,
                      }
                    : undefined
                }
              >
                <span>{cat.emoji}</span>
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Loading / Error / Empty states ── */}
      {state === 'loading' && <TrendingSkeleton color={color} />}

      {state === 'error' && (
        <div
          className="rounded-2xl border p-8 text-center"
          style={{ borderColor: `${color}33`, backgroundColor: `${color}08` }}
        >
          <p className="mb-2 text-lg" style={{ color }}>
            Failed to load trending
          </p>
          <p className="mb-4 text-sm text-[var(--color-muted)]">{error}</p>
          <button type="button" onClick={fetchTrending} className="btn-primary">
            Try Again
          </button>
        </div>
      )}

      {state === 'empty' && (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-8 text-center backdrop-blur-xl">
          <p className="mb-1 text-lg text-[var(--color-muted)]">No trending content yet</p>
          <p className="text-sm text-[var(--color-muted)]">
            Trending content from {meta.name} will appear here as the community posts.
          </p>
        </div>
      )}

      {/* ── Loaded Content ── */}
      {state === 'loaded' && data && (
        <div className="space-y-10">
          {/* ═══ Trending posts ═══ */}
          {data.posts.length > 0 && (
            <section>
              <h2
                className="mb-4 flex items-center gap-2 text-lg font-bold"
                style={{ color: 'var(--color-fg)' }}
              >
                <span className="text-lg">📈</span>
                Trending {meta.postNoun}s
                <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                  style={{ backgroundColor: `${color}18`, color }}
                >
                  Top {data.posts.length}
                </span>
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {data.posts.map((post, i) => {
                  const barWidth = (post.engagementScore / maxPostScore) * 100;
                  return (
                    <Link
                      key={post.id}
                      href={`/post/${encodeURIComponent(post.id)}`}
                      className="group relative overflow-hidden rounded-xl border p-4 transition-all duration-200 hover:shadow-lg"
                      style={{
                        borderColor: `${color}18`,
                        backgroundColor: `${color}04`,
                        '--tw-shadow-color': `${color}10`,
                      } as React.CSSProperties}
                    >
                      {/* Rank badge */}
                      <span
                        className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold"
                        style={{ backgroundColor: `${color}18`, color }}
                      >
                        {i + 1}
                      </span>

                      {/* Topic tag */}
                      {post.topic && (
                        <span
                          className="mb-2 inline-block rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
                          style={{
                            backgroundColor: `${getCategoryColor(post.topic.toLowerCase())}18`,
                            color: getCategoryColor(post.topic.toLowerCase()),
                          }}
                        >
                          {post.topic}
                        </span>
                      )}

                      {/* Post text */}
                      <p className="mb-3 line-clamp-2 text-sm leading-relaxed text-[var(--color-fg)]">
                        {post.text}
                      </p>

                      {/* Engagement bar */}
                      <div className="mb-2 h-1 overflow-hidden rounded-full" style={{ backgroundColor: `${color}12` }}>
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.max(4, barWidth)}%`,
                            backgroundColor: color,
                            boxShadow: `0 0 6px ${color}60`,
                          }}
                        />
                      </div>

                      {/* Meta row */}
                      <div className="flex items-center justify-between text-[11px] text-[var(--color-muted)]">
                        <span className="truncate">{post.author.displayName}</span>
                        <div className="flex items-center gap-3">
                          <span>{timeAgo(post.createdAt)}</span>
                          <span>❤️ {formatScore(post.likes)}</span>
                          <span>💬 {formatScore(post.replies)}</span>
                          <span>🔄 {formatScore(post.reposts)}</span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* ═══ Trending channels ═══ */}
          {data.channels.length > 0 && (
            <section>
              <h2
                className="mb-4 flex items-center gap-2 text-lg font-bold"
                style={{ color: 'var(--color-fg)' }}
              >
                <span className="text-lg">🏷️</span>
                Trending {protocol === 'nostr' ? 'Relays' : protocol === 'mastodon' ? 'Instances' : 'Channels'}
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.channels.slice(0, 6).map((ch) => (
                  <div
                    key={ch.id}
                    className="rounded-xl border p-3 transition-all hover:shadow-sm"
                    style={{ borderColor: `${color}18`, backgroundColor: `${color}04` }}
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <span
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold"
                        style={{ backgroundColor: `${color}22`, color }}
                      >
                        #
                      </span>
                      <span className="truncate text-sm font-semibold text-[var(--color-fg)]">
                        {ch.name}
                      </span>
                    </div>
                    {ch.description && (
                      <p className="mb-2 truncate text-[11px] text-[var(--color-muted)]">
                        {ch.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-[10px] text-[var(--color-muted)]">
                      {ch.memberCount != null && (
                        <span>{formatCount(ch.memberCount)} members</span>
                      )}
                      {ch.postCount != null && <span>{formatCount(ch.postCount)} posts</span>}
                      {ch.engagementScore != null && (
                        <span className="font-semibold" style={{ color }}>
                          {formatScore(ch.engagementScore)} score
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ═══ Trending Topics ═══ */}
          {data.topics.length > 0 && (
            <section>
              <h2
                className="mb-4 flex items-center gap-2 text-lg font-bold"
                style={{ color: 'var(--color-fg)' }}
              >
                <span className="text-lg">🏆</span>
                Trending Topics
              </h2>
              <div className="flex flex-wrap gap-2">
                {data.topics.slice(0, 12).map((topic) => {
                  const barWidth = (topic.score / (data.topics[0]?.score ?? 1)) * 100;
                  return (
                    <Link
                      key={topic.topic}
                      href={`/topics/${encodeURIComponent(topic.topic.toLowerCase().replace(/\s+/g, '-'))}`}
                      className="group relative overflow-hidden rounded-xl border px-4 py-3 transition-all hover:shadow-sm"
                      style={{
                        borderColor: `${color}15`,
                        backgroundColor: `${color}04`,
                      }}
                    >
                      <div className="mb-1 flex items-center gap-2">
                        <span className="text-sm font-semibold text-[var(--color-fg)]">
                          {topic.topic}
                        </span>
                        <span
                          className="rounded-full px-2 py-0.5 text-[9px] font-semibold"
                          style={{ backgroundColor: `${color}18`, color }}
                        >
                          {formatCount(topic.count)}
                        </span>
                      </div>
                      <div className="h-1 w-32 overflow-hidden rounded-full" style={{ backgroundColor: `${color}12` }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.max(4, barWidth)}%`,
                            backgroundColor: color,
                          }}
                        />
                      </div>
                      <span className="mt-1 block text-[10px] text-[var(--color-muted)]">
                        {formatScore(topic.score)} engagement score
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* ═══ Trending Creators ═══ */}
          {data.creators.length > 0 && (
            <section>
              <h2
                className="mb-4 flex items-center gap-2 text-lg font-bold"
                style={{ color: 'var(--color-fg)' }}
              >
                <span className="text-lg">👑</span>
                Top Creators This{' '}
                {activeTime.id === 'now' ? 'Hour' : activeTime.id === 'today' ? 'Day' : 'Week'}
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.creators.slice(0, 6).map((creator, i) => {
                  const barWidth = (creator.engagementScore / maxCreatorScore) * 100;
                  return (
                    <Link
                      key={creator.id}
                      href={`/profile/${encodeURIComponent(creator.handle)}`}
                      className="flex items-center gap-3 rounded-xl border p-3 transition-all hover:shadow-sm"
                      style={{
                        borderColor: `${color}15`,
                        backgroundColor: `${color}04`,
                      }}
                    >
                      {/* Avatar */}
                      <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                        style={{ backgroundColor: `${color}22`, color }}
                      >
                        {creator.displayName.charAt(0)}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-[var(--color-fg)]">
                            {creator.displayName}
                          </span>
                          <span
                            className={`shrink-0 text-[10px] font-semibold ${
                              creator.change >= 0
                                ? 'text-green-500'
                                : 'text-red-500'
                            }`}
                          >
                            {creator.change >= 0 ? '↑' : '↓'} {Math.abs(creator.change)}
                          </span>
                        </div>
                        <p className="truncate text-[11px] text-[var(--color-muted)]">
                          @{creator.handle}
                        </p>
                        <div className="mt-1 flex items-center gap-3 text-[10px] text-[var(--color-muted)]">
                          <span>{creator.postCount} posts</span>
                          {creator.followerCount != null && (
                            <span>{formatCount(creator.followerCount)} followers</span>
                          )}
                        </div>

                        {/* Score bar */}
                        <div className="mt-1.5 h-1 overflow-hidden rounded-full" style={{ backgroundColor: `${color}12` }}>
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.max(4, barWidth)}%`,
                              backgroundColor: color,
                              boxShadow: `0 0 6px ${color}60`,
                            }}
                          />
                        </div>
                      </div>

                      {/* Rank */}
                      <span
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold"
                        style={{ backgroundColor: `${color}18`, color }}
                      >
                        {i + 1}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* ── Footer note ── */}
          <p className="text-center text-xs text-[var(--color-muted)]">
            Trending computed from{' '}
            {TIME_FILTERS.find((f) => f.id === activeTime.id)?.label.toLowerCase()} activity on{' '}
            {meta.name}. Scores based on engagement velocity and community interaction.
          </p>
        </div>
      )}
    </div>
  );
}
