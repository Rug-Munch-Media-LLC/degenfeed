'use client';

import { ErrorBoundary } from '@degenfeed/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { retryFetch } from '../../lib/retryFetch';

// ── Types ─────────────────────────────────────────────────────────────────

interface TrendingTopic {
  topic: string;
  count: number;
  score: number;
}

interface TimeFilter {
  id: string;
  label: string;
  windowHours: number;
}

// ── Constants ─────────────────────────────────────────────────────────────

const TIME_FILTERS: TimeFilter[] = [
  { id: 'now', label: 'Now', windowHours: 1 },
  { id: 'today', label: 'Today', windowHours: 24 },
  { id: 'week', label: 'This Week', windowHours: 168 },
  { id: 'month', label: 'This Month', windowHours: 720 },
];

const TOPIC_META: Record<string, { emoji: string; color: string; label: string }> = {
  bitcoin: { emoji: '₿', color: '#f7931a', label: 'Bitcoin' },
  ethereum: { emoji: 'Ξ', color: '#627eea', label: 'Ethereum' },
  solana: { emoji: '◉', color: '#14f195', label: 'Solana' },
  defi: { emoji: '📊', color: '#6366f1', label: 'DeFi' },
  nft: { emoji: '🖼', color: '#ec4899', label: 'NFT' },
  ai: { emoji: '🤖', color: '#06b6d4', label: 'AI' },
  regulation: { emoji: '⚖️', color: '#ef4444', label: 'Regulation' },
  security: { emoji: '🔒', color: '#dc2626', label: 'Security' },
  macro: { emoji: '📈', color: '#10b981', label: 'Macro' },
  memecoin: { emoji: '🐸', color: '#f59e0b', label: 'Memecoin' },
  memes: { emoji: '🐸', color: '#f59e0b', label: 'Memes' },
  layer2: { emoji: '⛓️', color: '#8b5cf6', label: 'Layer 2' },
  stablecoin: { emoji: '💵', color: '#22c55e', label: 'Stablecoin' },
  etf: { emoji: '📋', color: '#3b82f6', label: 'ETF' },
  onchain: { emoji: '🔗', color: '#14b8a6', label: 'On-Chain' },
  crypto: { emoji: '₿', color: '#f59e0b', label: 'Crypto' },
};

function getTopicMeta(topic: string): { emoji: string; color: string; label: string } {
  const key = topic.toLowerCase().replace(/[^a-z0-9]/g, '');
  return TOPIC_META[key] ?? { emoji: '#', color: '#888', label: topic };
}

function scoreToBarWidth(score: number, maxScore: number): string {
  const pct = maxScore > 0 ? (score / maxScore) * 100 : 0;
  return `${Math.max(4, Math.min(100, pct))}%`;
}

function formatScore(score: number): string {
  if (score >= 1_000_000) return `${(score / 1_000_000).toFixed(1)}M`;
  if (score >= 1_000) return `${(score / 1_000).toFixed(1)}K`;
  return score.toFixed(0);
}

// ── Skeleton ──────────────────────────────────────────────────────────────

function TrendingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="skeleton-shimmer h-8 w-48 rounded-lg" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="card p-5">
            <div className="skeleton-shimmer mb-3 h-4 w-3/4 rounded-md" />
            <div className="skeleton-shimmer mb-2 h-3 w-1/2 rounded-md" />
            <div className="skeleton-shimmer h-2 w-full rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Topic Card ────────────────────────────────────────────────────────────

function TopicCard({
  topic,
  count,
  score,
  isHighest,
}: {
  topic: TrendingTopic;
  count: number;
  score: number;
  isHighest: boolean;
}) {
  const meta = getTopicMeta(topic.topic);
  const topicSlug = topic.topic.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  return (
    <Link
      href={`/home/${encodeURIComponent(topicSlug)}`}
      className="group relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-card)] to-[var(--color-card)] p-5 backdrop-blur-xl transition-all duration-300 hover:border-[var(--color-border)] hover:shadow-[0_0_30px_-6px]"
      style={
        {
          borderColor: isHighest ? `${meta.color}30` : undefined,
          '--tw-shadow-color': `${meta.color}15`,
          boxShadow: isHighest ? `0 0 30px -6px ${meta.color}25` : undefined,
        } as React.CSSProperties
      }
    >
      {/* Accent line */}
      <span
        className="absolute inset-x-0 top-0 h-0.5 opacity-60 transition-opacity group-hover:opacity-100"
        style={{ backgroundColor: meta.color }}
      />

      {/* Card content */}
      <div className="flex items-start gap-4">
        {/* Emoji circle */}
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-lg"
          style={{ backgroundColor: `${meta.color}18` }}
          aria-hidden="true"
        >
          {meta.emoji}
        </span>

        <div className="min-w-0 flex-1">
          {/* Topic name + badge */}
          <div className="mb-1 flex items-center gap-2">
            <h3 className="truncate text-base font-bold text-[var(--color-fg)]">{topic.topic}</h3>
            <span
              className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
              style={{ backgroundColor: `${meta.color}18`, color: meta.color }}
            >
              {meta.label}
            </span>
          </div>

          {/* Stats row */}
          <div className="mb-2 flex items-center gap-4 text-xs text-[var(--color-muted)]">
            <span className="tabular-nums">
              <span className="font-semibold text-[var(--color-muted)]">
                {count.toLocaleString()}
              </span>{' '}
              posts
            </span>
            <span className="tabular-nums">
              <span className="font-semibold text-[var(--color-muted)]">{formatScore(score)}</span>{' '}
              score
            </span>
            {isHighest && (
              <span className="flex items-center gap-1 font-semibold text-degen-400">
                <span className="text-[10px]">▲</span>
                Top
              </span>
            )}
          </div>

          {/* Score bar */}
          <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-[var(--color-overlay)]">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: scoreToBarWidth(score, count),
                backgroundColor: meta.color,
                boxShadow: `0 0 8px ${meta.color}50`,
              }}
            />
          </div>

          {/* CTA */}
          <span
            className="inline-flex items-center gap-1 text-xs font-medium transition-colors"
            style={{ color: meta.color }}
          >
            View all posts about {topic.topic}
            <span className="transition-transform group-hover:translate-x-0.5">→</span>
          </span>
        </div>
      </div>
    </Link>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────

export default function TrendingPage() {
  const [activeFilter, setActiveFilter] = useState<TimeFilter>(TIME_FILTERS[1]!); // default Today
  const [topics, setTopics] = useState<TrendingTopic[]>([]);
  const [state, setState] = useState<'loading' | 'loaded' | 'empty' | 'error'>('loading');
  const [error, setError] = useState<string>();

  const fetchTrending = useCallback(
    async (filter: TimeFilter) => {
      setState('loading');
      setError(undefined);
      try {
        const url = new URL('/api/feed/home', window.location.origin);
        url.searchParams.set('limit', '1');
        url.searchParams.set('trending', String(filter.windowHours));
        url.searchParams.set('protocols', 'nostr,farcaster,lens,bluesky,mastodon,reddit,rss');
        const res = await retryFetch(url.toString(), {
          fetchOptions: {
            credentials: 'include',
            cache: 'no-store',
            headers: { 'cache-control': 'no-store' },
          },
        });
        if (!res.ok) throw new Error(`API returned ${res.status}`);
        const data = (await res.json()) as { meta?: { trending?: TrendingTopic[] } };
        const trending = data.meta?.trending ?? [];
        setTopics(trending);
        setState(trending.length > 0 ? 'loaded' : 'empty');
      } catch (err) {
        // Graceful degradation: show "Trending unavailable" instead of crashing
        setError(err instanceof Error ? err.message : 'Failed to load trending topics');
        setState('error');
      } finally {
        // Ensure we always exit loading state
        if (state === 'loading') {
          // Already handled by setState above
        }
      }
    },
    [state],
  );

  useEffect(() => {
    fetchTrending(activeFilter);
  }, [activeFilter, fetchTrending]);

  const handleFilterChange = (filter: TimeFilter) => {
    setActiveFilter(filter);
  };

  const _maxScore = topics.length > 0 ? Math.max(...topics.map((t) => t.score)) : 0;

  return (
    <ErrorBoundary>
      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="mb-2 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-red-500/20 to-orange-500/10 text-lg">
              🔥
            </span>
            <div>
              <h1 className="text-2xl font-bold text-[var(--color-fg)]">Trending</h1>
              <p className="text-sm text-[var(--color-muted)]">
                What the web3 social graph is talking about
              </p>
            </div>
          </div>

          {/* Time filter */}
          <div className="mt-4 flex flex-wrap gap-2">
            {TIME_FILTERS.map((f) => {
              const active = activeFilter.id === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => handleFilterChange(f)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                    active
                      ? 'bg-degen-500/15 text-degen-400 shadow-[0_0_12px_rgba(34,197,94,0.15)]'
                      : 'border border-[var(--color-border)] bg-[var(--color-overlay)] text-[var(--color-muted)] hover:border-[var(--color-border)] hover:text-[var(--color-fg)]'
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        {state === 'loading' && <TrendingSkeleton />}

        {state === 'error' && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-8 text-center">
            <p className="mb-2 text-lg text-red-400">Failed to load trending topics</p>
            <p className="mb-4 text-sm text-[var(--color-muted)]">{error}</p>
            <button
              type="button"
              onClick={() => fetchTrending(activeFilter)}
              className="btn-primary"
            >
              Try Again
            </button>
          </div>
        )}

        {state === 'empty' && (
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-8 text-center backdrop-blur-xl">
            <p className="mb-1 text-lg text-[var(--color-muted)]">No trending topics yet</p>
            <p className="text-sm text-[var(--color-muted)]">
              Trending topics appear as the community posts. Try a different time window.
            </p>
          </div>
        )}

        {state === 'loaded' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {topics.map((topic, i) => (
              <TopicCard
                key={topic.topic}
                topic={topic}
                count={topic.count}
                score={topic.score}
                isHighest={i === 0}
              />
            ))}
          </div>
        )}

        {/* Footer note */}
        {state === 'loaded' && topics.length > 0 && (
          <p className="mt-6 text-center text-xs text-[var(--color-muted)]">
            Trending computed from{' '}
            {TIME_FILTERS.find((f) => f.id === activeFilter.id)?.label.toLowerCase()} activity
            across Nostr, Farcaster, Lens, Bluesky, Mastodon, Threads, Reddit, and RSS.
          </p>
        )}
      </div>
    </ErrorBoundary>
  );
}
