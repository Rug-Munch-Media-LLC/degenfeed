'use client';

import { getProtocolColor, getProtocolIcon } from '@degenfeed/ui';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────

interface SearchResult {
  id: string;
  protocol: string;
  author: { displayName: string; avatarUrl?: string };
  text: string;
  url: string | null;
  image: string | null;
  niches: string[];
  createdAt: number;
  metrics: { likes: number; reposts: number; replies: number; quotes: number };
}

interface IdentityResult {
  id: string;
  protocol: string;
  displayName: string;
  handle: string | null;
  avatarUrl: string | null;
  bio: string;
  postCount: number;
}

type SearchTab = 'all' | 'posts' | 'people' | 'topics';

// ─── Niches / Topics ──────────────────────────────────────────

const ALL_TOPICS = [
  { id: 'crypto', label: 'Crypto', emoji: '₿' },
  { id: 'bitcoin', label: 'Bitcoin', emoji: '₿' },
  { id: 'ethereum', label: 'Ethereum', emoji: '◆' },
  { id: 'solana', label: 'Solana', emoji: '◎' },
  { id: 'defi', label: 'DeFi', emoji: '🏦' },
  { id: 'nft', label: 'NFT', emoji: '🖼' },
  { id: 'ai', label: 'AI', emoji: '🤖' },
  { id: 'regulation', label: 'Regulation', emoji: '⚖' },
  { id: 'security', label: 'Security', emoji: '🔒' },
  { id: 'mining', label: 'Mining', emoji: '⛏' },
  { id: 'gaming', label: 'Gaming', emoji: '🎮' },
  { id: 'privacy', label: 'Privacy', emoji: '👁' },
  { id: 'memes', label: 'Memes', emoji: '😂' },
  { id: 'oss', label: 'Open Source', emoji: '📖' },
];

// ─── Protocol filter pills ────────────────────────────────────

const PROTOCOL_FILTERS = [
  { id: 'nostr', label: 'Nostr', color: '#8e30eb' },
  { id: 'farcaster', label: 'Farcaster', color: '#8a63d2' },
  { id: 'lens', label: 'Lens', color: '#abfe2c' },
  { id: 'bluesky', label: 'Bluesky', color: '#1185fe' },
  { id: 'mastodon', label: 'Mastodon', color: '#6364ff' },
  { id: 'rss', label: 'News', color: '#ffa500' },
];

// ─── Helpers ──────────────────────────────────────────────────

function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function getProfileUrl(identity: IdentityResult): string {
  switch (identity.protocol) {
    case 'nostr':
      return `https://snort.social/p/${identity.handle || identity.id}`;
    case 'farcaster':
      return `https://warpcast.com/${identity.handle?.replace('@', '') || identity.id}`;
    case 'lens':
      return `https://hey.xyz/u/${identity.handle?.replace('lens/', '') || identity.id}`;
    case 'bluesky':
      return `https://bsky.app/profile/${identity.handle?.replace('@', '') || identity.id}`;
    case 'mastodon':
      return `https://social.degenfeed.xyz/@${identity.handle || identity.id}`;
    default:
      return '#';
  }
}

// ─── Skeleton ─────────────────────────────────────────────────

function Skeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card animate-pulse flex items-center gap-3 p-4">
          <div className="h-10 w-10 rounded-full bg-gray-800" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-32 rounded bg-gray-800" />
            <div className="h-3 w-full rounded bg-gray-800" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────

export default function SearchPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQ = searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQ);
  const [tab, setTab] = useState<SearchTab>('all');
  const [posts, setPosts] = useState<SearchResult[]>([]);
  const [identities, setIdentities] = useState<IdentityResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(!!initialQ);
  const [error, setError] = useState<string | null>(null);
  const [protocolFilter, setProtocolFilter] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Update URL when query changes
  const updateUrl = useCallback(
    (q: string) => {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      const url = `/search${params.toString() ? `?${params.toString()}` : ''}`;
      router.replace(url, { scroll: false });
    },
    [router],
  );

  const doSearch = useCallback(
    async (q: string) => {
      if (q.length < 2) {
        setPosts([]);
        setIdentities([]);
        setSearched(false);
        return;
      }
      setLoading(true);
      setSearched(true);
      setError(null);

      try {
        const protocolsParam = protocolFilter ? `&protocols=${protocolFilter}` : '';

        const [postsRes, identityRes] = await Promise.all([
          fetch(`/api/search?q=${encodeURIComponent(q)}&limit=50${protocolsParam}`, {
            credentials: 'include',
          }),
          fetch(`/api/search/identity?q=${encodeURIComponent(q)}&limit=12`, {
            credentials: 'include',
          }),
        ]);

        const postsData = postsRes.ok
          ? ((await postsRes.json()) as { data?: SearchResult[] })
          : { data: [] };
        const identityData = identityRes.ok
          ? ((await identityRes.json()) as { data?: IdentityResult[] })
          : { data: [] };

        setPosts(postsData.data ?? []);
        setIdentities(identityData.data ?? []);
      } catch (err) {
        setPosts([]);
        setIdentities([]);
        setError(err instanceof Error ? err.message : 'Search failed');
      }
      setLoading(false);
    },
    [protocolFilter],
  );

  // Initial search on mount if query param present
  useEffect(() => {
    if (initialQ.length >= 2) {
      doSearch(initialQ);
    }
  }, [initialQ, doSearch]);

  // Retry on error
  useEffect(() => {
    if (error && retryCount > 0 && retryCount < 3) {
      const timer = setTimeout(() => doSearch(query), 1000 * retryCount);
      return () => clearTimeout(timer);
    }
  }, [error, retryCount, doSearch, query]);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const handleChange = useCallback(
    (val: string) => {
      setQuery(val);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        updateUrl(val);
        doSearch(val);
      }, 300);
    },
    [doSearch, updateUrl],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        updateUrl(query);
        doSearch(query);
      }
    },
    [query, doSearch, updateUrl],
  );

  // ─── Derive topics from results ─────────────────────────────
  const mentionedTopics = ALL_TOPICS.filter((t) =>
    posts.some((p) => p.niches.includes(t.id)),
  ).slice(0, 8);

  const filteredPosts =
    protocolFilter && tab !== 'people'
      ? posts.filter((p) => p.protocol === protocolFilter)
      : posts;

  const visiblePosts = tab === 'all' || tab === 'posts' ? filteredPosts : [];
  const visibleIdentities = tab === 'all' || tab === 'people' ? identities : [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white mb-4">Search</h1>
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search posts, people, topics..."
            className="input h-12 pl-12 pr-4 text-base"
          />
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
            {loading ? '⟳' : '⌕'}
          </span>
        </div>
      </div>

      {/* Protocol filter pills */}
      {searched && !loading && (
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setProtocolFilter(null)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              protocolFilter === null
                ? 'bg-degen-500/20 text-degen-400'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            All
          </button>
          {PROTOCOL_FILTERS.map((pf) => (
            <button
              key={pf.id}
              type="button"
              onClick={() => setProtocolFilter(protocolFilter === pf.id ? null : pf.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors`}
              style={{
                backgroundColor:
                  protocolFilter === pf.id ? `${pf.color}22` : 'rgb(31,41,55)',
                color: protocolFilter === pf.id ? pf.color : 'rgb(156,163,175)',
              }}
            >
              {pf.label}
            </button>
          ))}
        </div>
      )}

      {/* Tabs */}
      {searched && !loading && (
        <div className="mb-6 flex gap-1 rounded-xl bg-gray-900/60 p-1">
          {(
            [
              { id: 'all' as const, label: 'All' },
              { id: 'posts' as const, label: 'Posts' },
              { id: 'people' as const, label: 'People' },
              { id: 'topics' as const, label: 'Topics' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === t.id
                  ? 'bg-degen-500/20 text-degen-400'
                  : 'text-gray-500 hover:text-white'
              }`}
            >
              {t.label}
              {t.id === 'posts' && posts.length > 0 && ` (${posts.length})`}
              {t.id === 'people' && identities.length > 0 && ` (${identities.length})`}
            </button>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && <Skeleton count={5} />}

      {/* Error */}
      {error && (
        <div className="card border-red-900/50 bg-red-900/10 py-6 text-center">
          <p className="text-sm text-red-400 mb-2">{error}</p>
          <button
            type="button"
            onClick={() => {
              setRetryCount((c) => c + 1);
              doSearch(query);
            }}
            className="rounded-lg bg-red-500/20 px-4 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/30 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty */}
      {searched && !loading && !error && visiblePosts.length === 0 && visibleIdentities.length === 0 && tab !== 'topics' && (
        <div className="card py-12 text-center">
          <div className="mb-3 text-3xl text-gray-700">⌕</div>
          <p className="text-sm text-gray-500">
            No results for &ldquo;{query}&rdquo;
          </p>
          {protocolFilter && (
            <p className="mt-1 text-xs text-gray-600">
              Try removing the protocol filter
            </p>
          )}
        </div>
      )}

      {/* ═══ Topics Tab ═══ */}
      {tab === 'topics' && (
        <div>
          <p className="mb-4 text-xs text-gray-500">
            Browse or search by topic to find relevant posts across all protocols.
          </p>
          <div className="flex flex-wrap gap-2">
            {ALL_TOPICS.map((topic) => (
              <a
                key={topic.id}
                href={`/feed?niche=${topic.id}&q=${encodeURIComponent(query)}`}
                className="card-hover flex items-center gap-2 rounded-xl px-4 py-3 transition-colors"
              >
                <span className="text-lg">{topic.emoji}</span>
                <div>
                  <div className="text-sm font-medium text-white">{topic.label}</div>
                  {query && (
                    <div className="text-[10px] text-gray-500">
                      Filter by &ldquo;{query}&rdquo;
                    </div>
                  )}
                </div>
              </a>
            ))}
          </div>

          {mentionedTopics.length > 0 && (
            <div className="mt-8">
              <h3 className="mb-3 text-xs font-medium uppercase tracking-widest text-gray-600">
                Topics found in results
              </h3>
              <div className="flex flex-wrap gap-2">
                {mentionedTopics.map((topic) => (
                  <a
                    key={topic.id}
                    href={`/feed?niche=${topic.id}`}
                    className="rounded-full bg-gray-800 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                  >
                    {topic.emoji} {topic.label}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ People Results ═══ */}
      {visibleIdentities.length > 0 && (
        <div className="mb-8">
          {tab === 'all' && (
            <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-gray-600">
              People
            </h2>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {visibleIdentities.map((identity) => (
              <div
                key={identity.id}
                className="card-hover flex items-start gap-4 p-4 transition-colors"
              >
                <a
                  href={getProfileUrl(identity)}
                  target="_blank"
                  rel="noopener"
                  className="shrink-0"
                >
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-full text-base font-bold overflow-hidden"
                    style={{
                      backgroundColor: `${getProtocolColor(identity.protocol)}22`,
                      color: getProtocolColor(identity.protocol),
                    }}
                  >
                    {identity.avatarUrl ? (
                      <Image
                        src={identity.avatarUrl}
                        alt={identity.displayName}
                        width={48}
                        height={48}
                        className="h-12 w-12 rounded-full object-cover"
                        unoptimized
                      />
                    ) : (
                      identity.displayName[0]?.toUpperCase() || getProtocolIcon(identity.protocol)
                    )}
                  </div>
                </a>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <a
                      href={getProfileUrl(identity)}
                      target="_blank"
                      rel="noopener"
                      className="truncate text-sm font-semibold text-white hover:underline"
                    >
                      {identity.displayName}
                    </a>
                    <span
                      className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                      style={{
                        backgroundColor: `${getProtocolColor(identity.protocol)}22`,
                        color: getProtocolColor(identity.protocol),
                      }}
                    >
                      {identity.protocol}
                    </span>
                  </div>
                  {identity.handle && (
                    <div className="text-xs text-gray-500 truncate mt-0.5">
                      {identity.handle}
                    </div>
                  )}
                  {identity.bio && (
                    <div className="mt-1 text-xs text-gray-400 line-clamp-2">
                      {identity.bio}
                    </div>
                  )}
                  <div className="mt-2 flex items-center gap-3">
                    {identity.postCount > 0 && (
                      <span className="text-[10px] text-gray-600">
                        {formatCount(identity.postCount)} posts
                      </span>
                    )}
                    <a
                      href={getProfileUrl(identity)}
                      target="_blank"
                      rel="noopener"
                      className="ml-auto rounded-lg border border-white/10 px-2.5 py-1 text-xs text-gray-400 hover:border-degen-500/30 hover:text-degen-400 transition-colors"
                    >
                      View Profile →
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ Post Results ═══ */}
      {visiblePosts.length > 0 && (
        <div>
          {tab === 'all' && visibleIdentities.length > 0 && (
            <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-gray-600">
              Posts
            </h2>
          )}
          <div className="space-y-2">
            {visiblePosts.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => router.push(`/post/${encodeURIComponent(r.id)}`)}
                className="card-hover flex w-full items-start gap-3 p-4 text-left"
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold overflow-hidden"
                  style={{
                    backgroundColor: `${getProtocolColor(r.protocol)}22`,
                    color: getProtocolColor(r.protocol),
                  }}
                >
                  {r.author.avatarUrl ? (
                    <Image
                      src={r.author.avatarUrl}
                      alt={r.author.displayName}
                      width={40}
                      height={40}
                      className="h-10 w-10 rounded-full object-cover"
                      unoptimized
                    />
                  ) : (
                    r.author.displayName[0]?.toUpperCase() || '?'
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-medium text-white truncate">
                      {r.author.displayName}
                    </span>
                    <span className="text-gray-500" style={{ color: getProtocolColor(r.protocol) }}>
                      {r.protocol}
                    </span>
                    <span className="ml-auto text-gray-600">{formatTime(r.createdAt)}</span>
                  </div>
                  <p className="mt-0.5 text-sm text-gray-400 line-clamp-2">{r.text}</p>
                  <div className="mt-2 flex items-center gap-3 text-[10px] text-gray-600">
                    <span>♥ {r.metrics.likes}</span>
                    <span>↻ {r.metrics.reposts}</span>
                    <span>✎ {r.metrics.replies}</span>
                    {r.niches.length > 0 && (
                      <div className="ml-auto flex gap-1">
                        {r.niches.slice(0, 2).map((n) => (
                          <span
                            key={n}
                            className="rounded-full bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-500"
                          >
                            {n}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {r.image && (
                  <Image
                    src={r.image}
                    alt=""
                    width={64}
                    height={64}
                    className="h-16 w-16 shrink-0 rounded-lg object-cover"
                    loading="lazy"
                    unoptimized
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
