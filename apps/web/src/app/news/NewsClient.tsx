'use client';

import type { UnifiedPost } from '@degenfeed/types';
import { useCallback, useEffect, useState } from 'react';

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
}

interface NewsRaw {
  mustRead?: boolean;
  tier?: number;
}

const CATEGORIES = [
  { id: '', label: 'All' },
  { id: 'bitcoin', label: 'Bitcoin' },
  { id: 'ethereum', label: 'Ethereum' },
  { id: 'solana', label: 'Solana' },
  { id: 'defi', label: 'DeFi' },
  { id: 'ai', label: 'AI' },
  { id: 'security', label: 'Security' },
  { id: 'regulation', label: 'Regulation' },
  { id: 'macro', label: 'Macro' },
  { id: 'nft', label: 'NFTs' },
  { id: 'layer2', label: 'Layer 2' },
  { id: 'memecoin', label: 'Memes' },
  { id: 'stablecoin', label: 'Stablecoins' },
  { id: 'etf', label: 'ETFs' },
];

function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function stripTags(html: string): string {
  return html
    .replace(/\u003cbr\s*\/?\u003e/gi, ' ')
    .replace(/\u003c[^\u003e]+\u003e/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getRaw(post: UnifiedPost): NewsRaw {
  const raw = post.raw as NewsRaw | undefined;
  return raw ?? {};
}

function NewsCard({ post }: { post: UnifiedPost }) {
  const raw = getRaw(post);
  const mustRead = raw.mustRead;
  const tier = raw.tier;
  const imageEmbed = post.embeds.find((e) => e.kind === 'image');
  const linkEmbed = post.embeds.find((e) => e.kind === 'link');
  const url = linkEmbed?.url || '#';

  return (
    <article className="card-hover group relative overflow-hidden">
      {imageEmbed && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="block aspect-video w-full overflow-hidden"
        >
          <img
            src={imageEmbed.url}
            alt=""
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        </a>
      )}
      <div className="p-4">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-gray-900/80 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-gray-400">
            {post.author.displayName}
          </span>
          {mustRead && (
            <span className="rounded-full bg-degen-500/20 px-2 py-0.5 text-[10px] font-medium text-degen-400">
              Must Read
            </span>
          )}
          {tier === 1 && !mustRead && (
            <span className="rounded-full bg-yellow-500/10 px-2 py-0.5 text-[10px] font-medium text-yellow-400">
              Tier 1
            </span>
          )}
          <span className="text-[10px] text-gray-600">{formatTime(post.createdAt)}</span>
        </div>

        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-2 block text-base font-semibold text-white transition-colors group-hover:text-degen-400 line-clamp-2"
        >
          {stripTags(post.text).slice(0, 120).split(' ').slice(0, -1).join(' ') ||
            post.text.slice(0, 100)}
        </a>

        <p className="mb-3 text-xs text-gray-500 line-clamp-2">
          {stripTags(post.html || post.text).slice(0, 180)}...
        </p>

        <div className="flex flex-wrap gap-1">
          {post.niches.slice(0, 5).map((niche) => (
            <span
              key={niche}
              className="rounded-full bg-gray-900/80 px-2 py-0.5 text-[10px] text-gray-500"
            >
              #{niche}
            </span>
          ))}
        </div>
      </div>
    </article>
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

  const fetchNews = useCallback(async () => {
    setState('loading');
    try {
      const params = new URLSearchParams();
      params.set('limit', '50');
      if (category) params.set('category', category);
      if (query) params.set('q', query);
      if (mustRead) params.set('mustRead', 'true');

      const res = await fetch(`/api/feed/news?${params.toString()}`, { credentials: 'include' });
      const data = (await res.json()) as { data?: UnifiedPost[]; meta?: NewsMeta; error?: string };
      if (!res.ok) throw new Error(data.error || 'Failed to load news');

      setPosts(data.data || []);
      setMeta(data.meta || null);
      setState('loaded');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load news');
      setState('error');
    }
  }, [category, query, mustRead]);

  useEffect(() => {
    if (category === '' && query === '' && !mustRead) return;
    fetchNews();
  }, [category, fetchNews, mustRead, query]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setQuery(searchInput);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-8">
        <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">DegenFeed News</h1>
            <p className="mt-1 text-sm text-gray-500">
              Curated crypto, AI, and tech news from{' '}
              {meta?.sources ?? initialMeta?.sources ?? '35+'} sources — ranked by quality and
              recency.
            </p>
          </div>
          <div className="text-right">
            {meta && (
              <p className="text-xs text-gray-600">
                {meta.total} stories · updated {formatTime(meta.fetchedAt)}
              </p>
            )}
          </div>
        </div>

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
                : 'card-hover text-gray-400'
            }`}
          >
            Must Read
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                category === c.id
                  ? 'border-degen-500 bg-degen-500/20 text-degen-400 shadow-[0_0_12px_rgba(34,197,94,0.2)]'
                  : 'card-hover text-gray-400'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        <div className="lg:col-span-3">
          {state === 'error' && (
            <div className="card border-red-900/50 bg-red-900/10 py-12 text-center">
              <div className="mb-2 text-4xl text-red-400">!</div>
              <p className="text-red-300">{error}</p>
              <button type="button" onClick={fetchNews} className="btn-primary mt-4 text-sm">
                Retry
              </button>
            </div>
          )}

          {state === 'loaded' && posts.length === 0 && (
            <div className="card py-12 text-center">
              <p className="text-gray-500">No news found for these filters.</p>
            </div>
          )}

          {state === 'loaded' && posts.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {posts.map((post) => (
                <NewsCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </div>

        <aside className="space-y-4">
          {meta?.trending && meta.trending.length > 0 && (
            <div className="card">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-500">
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
                    className="rounded-full bg-gray-900/80 px-3 py-1.5 text-xs text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
                  >
                    #{t.topic}
                    <span className="ml-1.5 text-[10px] text-gray-500">{t.count}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {meta?.sourceCounts && (
            <div className="card">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-500">
                Sources
              </h3>
              <div className="space-y-1.5">
                {Object.entries(meta.sourceCounts)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 15)
                  .map(([name, count]) => (
                    <div key={name} className="flex items-center justify-between text-xs">
                      <span className="text-gray-400">{name}</span>
                      <span className="rounded-full bg-gray-900/80 px-2 py-0.5 text-gray-500">
                        {count}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          <div className="card">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500">
              How it works
            </h3>
            <ul className="space-y-1.5 text-[11px] text-gray-500">
              <li>• Stories ranked by source quality + recency</li>
              <li>• Deduplicated by canonical URL</li>
              <li>• Categorized by AI keyword extraction</li>
              <li>• Updated every 15 minutes</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
