'use client';

import type { UnifiedPost } from '@degenfeed/types';
import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';

interface NewsMeta {
  total: number;
  limit: number;
  category: string;
  query?: string;
  mustRead: boolean;
  trending: Array<{ topic: string; count: number; score: number }>;
  sourceCounts: Record<string, number>;
  fetchedAt: number;
  sources: number;
  sentiment?: Record<string, number>;
  sourceCount?: number;
  tiers?: string[];
}

interface NewsRaw {
  mustRead?: boolean;
  tier?: number;
  sourceName?: string;
  sentiment?: string;
  sentimentScore?: number;
  kind?: string;
  chain?: string;
  tokenAddress?: string;
  riskScore?: number;
}

const CATEGORIES = [
  { id: '', label: 'All', emoji: '🌐' },
  { id: 'bitcoin', label: 'Bitcoin', emoji: '₿' },
  { id: 'ethereum', label: 'Ethereum', emoji: '⟠' },
  { id: 'solana', label: 'Solana', emoji: '◎' },
  { id: 'defi', label: 'DeFi', emoji: '🏦' },
  { id: 'ai', label: 'AI', emoji: '🤖' },
  { id: 'security', label: 'Security', emoji: '🛡️' },
  { id: 'regulation', label: 'Regulation', emoji: '⚖️' },
  { id: 'macro', label: 'Macro', emoji: '📊' },
  { id: 'mining', label: 'Mining', emoji: '⛏️' },
  { id: 'privacy', label: 'Privacy', emoji: '👁️' },
  { id: 'onchain', label: 'On-Chain', emoji: '🔗' },
  { id: 'vc', label: 'VC', emoji: '💰' },
  { id: 'nft', label: 'NFTs', emoji: '🖼️' },
  { id: 'layer2', label: 'L2', emoji: '⚡' },
  { id: 'memecoin', label: 'Memes', emoji: '🐸' },
  { id: 'stablecoin', label: 'Stablecoins', emoji: '💲' },
  { id: 'etf', label: 'ETFs', emoji: '📈' },
];

const SOURCE_TABS = [
  { id: 'all', label: 'All Sources' },
  { id: 'rss', label: 'RSS' },
  { id: 'reddit', label: 'Reddit' },
  { id: 'hackernews', label: 'HN' },
];

function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function stripTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getRaw(post: UnifiedPost): NewsRaw {
  const raw = post.raw as NewsRaw | undefined;
  return raw ?? {};
}

function sentimentColor(s: string | null | undefined): string {
  const t = (s ?? '').toLowerCase();
  if (t.includes('bullish')) return 'text-green-400 bg-green-500/10 border-green-500/20';
  if (t.includes('bearish')) return 'text-red-400 bg-red-500/10 border-red-500/20';
  return 'text-[var(--color-muted)] bg-gray-500/10 border-gray-500/20';
}

function sentimentEmoji(s: string | null | undefined): string {
  const t = (s ?? '').toLowerCase();
  if (t.includes('bullish')) return '🟢';
  if (t.includes('bearish')) return '🔴';
  return '⚪';
}

function sourceIcon(kind: string | null | undefined): string {
  const k = (kind ?? '').toLowerCase();
  if (k === 'reddit') return '🔴';
  if (k === 'hackernews') return '🟠';
  if (k === 'rss') return '📡';
  return '📰';
}

function NewsCard({ post }: { post: UnifiedPost }) {
  const raw = getRaw(post);
  const mustRead = raw.mustRead;
  const tier = raw.tier;
  const sentiment = raw.sentiment;
  const kind = raw.kind;
  const imageEmbed = post.embeds.find((e) => e.kind === 'image');
  const linkEmbed = post.embeds.find((e) => e.kind === 'link');
  const url = linkEmbed?.url || '#';
  const title =
    stripTags(post.text).slice(0, 120).split(' ').slice(0, -1).join(' ') || post.text.slice(0, 100);
  const desc = stripTags(post.html || post.text).slice(0, 200);

  return (
    <article className="card-hover group relative flex flex-col overflow-hidden border border-[var(--color-glass-border)] bg-gradient-to-b from-gray-900/80 to-gray-950/80 transition-all duration-300 hover:border-degen-500/20 hover:shadow-[0_0_24px_rgba(34,197,94,0.08)]">
      {imageEmbed && (
        <a
          href={url}
          target="_blank"
          className="block aspect-video w-full overflow-hidden"
          rel="noopener"
        >
          <Image
            src={imageEmbed.url}
            alt={post.title || 'News article image'}
            width={800}
            height={450}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        </a>
      )}
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <span className="rounded-md bg-[var(--color-muted)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
            {sourceIcon(kind)} {post.author.displayName}
          </span>
          {mustRead && (
            <span className="rounded-md bg-degen-500/15 px-1.5 py-0.5 text-[10px] font-medium text-degen-400 ring-1 ring-degen-500/20">
              Must Read
            </span>
          )}
          {tier === 1 && !mustRead && (
            <span className="rounded-md bg-yellow-500/10 px-1.5 py-0.5 text-[10px] font-medium text-yellow-400 ring-1 ring-yellow-500/20">
              Tier 1
            </span>
          )}
          {sentiment && (
            <span
              className={`rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${sentimentColor(sentiment)}`}
            >
              {sentimentEmoji(sentiment)} {sentiment}
            </span>
          )}
          <span className="ml-auto text-[10px] text-gray-600">{formatTime(post.createdAt)}</span>
        </div>

        <a
          href={url}
          target="_blank"
          className="mb-2 block text-sm font-semibold leading-snug text-[var(--color-fg)] transition-colors group-hover:text-degen-400 line-clamp-2"
          rel="noopener"
        >
          {title}
        </a>

        <p className="mb-3 text-xs leading-relaxed text-[var(--color-muted)] line-clamp-2">
          {desc}
        </p>

        <div className="mt-auto flex flex-wrap gap-1">
          {post.niches.slice(0, 4).map((niche) => (
            <span
              key={niche}
              className="rounded-full bg-[var(--color-muted)] px-2 py-0.5 text-[10px] text-[var(--color-muted)]"
            >
              #{niche}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}

function SentimentBar({ sentiment }: { sentiment: Record<string, number> | undefined }) {
  if (!sentiment || Object.keys(sentiment).length === 0) return null;
  const total = Object.values(sentiment).reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  const bullish = ((sentiment.bullish ?? 0) / total) * 100;
  const bearish = ((sentiment.bearish ?? 0) / total) * 100;
  const neutral = ((sentiment.neutral ?? 0) / total) * 100;
  return (
    <div className="mb-4">
      <div className="mb-1 flex items-center justify-between text-[11px] text-[var(--color-muted)]">
        <span>Market Sentiment</span>
        <span className="text-green-400">🟢 {Math.round(bullish)}%</span>
        <span className="text-[var(--color-muted)]">⚪ {Math.round(neutral)}%</span>
        <span className="text-red-400">🔴 {Math.round(bearish)}%</span>
      </div>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-[var(--color-muted)]">
        <div className="bg-green-500 transition-all" style={{ width: `${bullish}%` }} />
        <div className="bg-gray-600 transition-all" style={{ width: `${neutral}%` }} />
        <div className="bg-red-500 transition-all" style={{ width: `${bearish}%` }} />
      </div>
    </div>
  );
}

interface NewsClientProps {
  initialPosts: UnifiedPost[];
  initialMeta: NewsMeta | null;
}

export default function NewsClient({ initialPosts, initialMeta }: NewsClientProps) {
  const [posts, setPosts] = useState<UnifiedPost[]>(initialPosts);
  const [meta, setMeta] = useState<NewsMeta | null>(initialMeta);
  const [state, setState] = useState<'loading' | 'loaded' | 'error'>('loaded');
  const [error, setError] = useState<string>();
  const [category, setCategory] = useState('');
  const [query, setQuery] = useState('');
  const [mustRead, setMustRead] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [sourceTab, setSourceTab] = useState('all');
  const [newAvailable, setNewAvailable] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchNews = useCallback(
    async (showIndicator = false) => {
      if (!showIndicator) setState('loading');
      try {
        const params = new URLSearchParams();
        params.set('limit', '50');
        if (category) params.set('category', category);
        if (query) params.set('q', query);
        if (mustRead) params.set('mustRead', 'true');

        const res = await fetch(`/api/feed/news?${params.toString()}`, {
          credentials: 'include',
          cache: 'no-store',
          headers: { 'cache-control': 'no-store' },
        });
        const data = (await res.json()) as {
          data?: UnifiedPost[];
          meta?: NewsMeta;
          error?: string;
        };
        if (!res.ok) throw new Error(data.error || 'Failed to load news');

        if (showIndicator && data.data && data.data.length > 0) {
          setNewAvailable(true);
          return;
        }

        setPosts(data.data || []);
        setMeta(data.meta || null);
        setState('loaded');
      } catch (err) {
        if (!showIndicator) {
          setError(err instanceof Error ? err.message : 'Failed to load news');
          setState('error');
        }
      }
    },
    [category, query, mustRead],
  );

  const refreshNow = useCallback(() => {
    setNewAvailable(false);
    fetchNews(false);
  }, [fetchNews]);

  useEffect(() => {
    if (category === '' && query === '' && !mustRead) return;
    fetchNews(false);
  }, [category, fetchNews, mustRead, query]);

  useEffect(() => {
    intervalRef.current = setInterval(() => fetchNews(true), 60000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchNews]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setQuery(searchInput);
  };

  const filteredPosts =
    sourceTab === 'all'
      ? posts
      : posts.filter((p) => {
          const raw = getRaw(p);
          const kind = (raw.kind ?? '').toLowerCase();
          if (sourceTab === 'rss')
            return kind === 'rss' && !raw.sourceName?.toLowerCase().includes('reddit');
          if (sourceTab === 'reddit')
            return kind === 'reddit' || raw.sourceName?.toLowerCase().includes('reddit');
          if (sourceTab === 'hackernews') return kind === 'hackernews';
          return true;
        });

  const sentiment = meta?.sentiment ?? undefined;
  const sourceCount = meta?.sourceCount ?? meta?.sources ?? 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* AI Summary Header */}
      <div className="mb-8">
        <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex-1">
            <div className="mb-1 flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight text-[var(--color-fg)]">
                DegenFeed News
              </h1>
              <span className="rounded-full bg-degen-500/10 px-2.5 py-0.5 text-[11px] font-medium text-degen-400 ring-1 ring-degen-500/20">
                LIVE
              </span>
            </div>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Curated intelligence from {sourceCount || '353+'} sources across RSS, Reddit, and
              Hacker News — ranked by quality, recency, and sentiment.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3 text-right">
            {meta && (
              <p className="text-xs text-gray-600">
                <span className="text-degen-400">{filteredPosts.length}</span> stories · updated{' '}
                {formatTime(meta.fetchedAt)}
              </p>
            )}
            <a
              href="/api/feed/rss.xml?category=news"
              target="_blank"
              className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-muted)] transition-colors hover:border-degen-500/30 hover:text-degen-400"
              rel="noopener"
            >
              RSS
            </a>
          </div>
        </div>

        <SentimentBar sentiment={sentiment} />

        {/* New stories banner */}
        {newAvailable && (
          <button
            type="button"
            onClick={refreshNow}
            className="mb-4 w-full animate-pulse rounded-xl border border-degen-500/20 bg-degen-500/10 py-2.5 text-center text-sm font-medium text-degen-400 transition-colors hover:bg-degen-500/20"
          >
            New stories available — click to refresh
          </button>
        )}

        {/* Search + Must Read */}
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
          <form onSubmit={handleSearch} className="flex-1">
            <div className="relative">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search news, tokens, topics..."
                className="input pr-20"
              />
              <button
                type="submit"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg bg-degen-500 px-3 py-1 text-xs font-medium text-black hover:bg-degen-400"
              >
                Search
              </button>
            </div>
          </form>
          <button
            type="button"
            onClick={() => setMustRead((v) => !v)}
            className={`rounded-xl border px-4 py-2.5 text-xs font-medium transition-colors ${
              mustRead
                ? 'border-degen-500 bg-degen-500/20 text-degen-400'
                : 'card-hover text-[var(--color-muted)]'
            }`}
          >
            Must Read
          </button>
        </div>

        {/* Category pills */}
        <div className="mb-3 flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                category === c.id
                  ? 'border-degen-500 bg-degen-500/20 text-degen-400 shadow-[0_0_12px_rgba(34,197,94,0.2)]'
                  : 'card-hover text-[var(--color-muted)]'
              }`}
            >
              {c.emoji} {c.label}
            </button>
          ))}
        </div>

        {/* Source tabs */}
        <div className="flex gap-1 border-b border-[var(--color-glass-border)] pb-2">
          {SOURCE_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSourceTab(tab.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                sourceTab === tab.id
                  ? 'bg-[var(--color-muted)] text-[var(--color-fg)]'
                  : 'text-[var(--color-muted)] hover:text-[var(--color-muted)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="grid gap-6 lg:grid-cols-4">
        <div className="lg:col-span-3">
          {state === 'error' && (
            <div className="card border-red-900/50 bg-red-900/10 py-12 text-center">
              <div className="mb-2 text-4xl text-red-400">!</div>
              <p className="text-red-300">{error}</p>
              <button type="button" onClick={refreshNow} className="btn-primary mt-4 text-sm">
                Retry
              </button>
            </div>
          )}

          {state === 'loaded' && filteredPosts.length === 0 && (
            <div className="card py-12 text-center">
              <p className="text-[var(--color-muted)]">No news found for these filters.</p>
            </div>
          )}

          {state === 'loaded' && filteredPosts.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredPosts.map((post) => (
                <NewsCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </div>

        <aside className="space-y-4">
          {/* Trending */}
          {meta?.trending && meta.trending.length > 0 && (
            <div className="card">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--color-muted)]">
                Trending Topics
              </h3>
              <div className="flex flex-wrap gap-2">
                {meta.trending.map((t) => (
                  <button
                    key={t.topic}
                    type="button"
                    onClick={() => {
                      setQuery(t.topic);
                      setSearchInput(t.topic);
                    }}
                    className="rounded-full bg-[var(--color-muted)] px-3 py-1.5 text-xs text-[var(--color-muted)] transition-colors hover:bg-[var(--color-muted-bg)] hover:text-[var(--color-fg)]"
                  >
                    #{t.topic}
                    <span className="ml-1.5 text-[10px] text-[var(--color-muted)]">{t.count}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Sources */}
          {meta?.sourceCounts && (
            <div className="card">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--color-muted)]">
                Sources
              </h3>
              <div className="space-y-1.5">
                {Object.entries(meta.sourceCounts)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 12)
                  .map(([name, count]) => (
                    <div key={name} className="flex items-center justify-between text-xs">
                      <span className="text-[var(--color-muted)]">{name}</span>
                      <span className="rounded-full bg-[var(--color-muted)] px-2 py-0.5 text-[var(--color-muted)]">
                        {count}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Newsletter CTA */}
          <div className="card border-degen-500/10 bg-gradient-to-br from-degen-500/5 to-gray-900/80">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-degen-400">
              Daily Digest
            </h3>
            <p className="mb-3 text-[11px] text-[var(--color-muted)]">
              Get the top stories delivered to your inbox every morning.
            </p>
            <a href="/newsletter" className="btn-primary block text-center text-xs">
              Subscribe →
            </a>
          </div>

          {/* How it works */}
          <div className="card">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--color-muted)]">
              How it works
            </h3>
            <ul className="space-y-1.5 text-[11px] text-[var(--color-muted)]">
              <li>• Stories ranked by source quality + recency</li>
              <li>• Deduplicated by canonical URL</li>
              <li>• Categorized by AI keyword extraction</li>
              <li>• Updated every 15 minutes</li>
              <li>• Aggregated from RSS, Reddit, and Hacker News</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
