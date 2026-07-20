'use client';

import { getProtocolColor, getProtocolIcon } from '@degenfeed/ui';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { rerankResults } from '@/lib/fuzzySearch';
import { retryFetch } from '../../lib/retryFetch';

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

interface CommunityResult {
  id: string;
  name: string;
  protocol: string;
  description: string;
  memberCount: number;
  url: string;
  icon: string | null;
}

interface VideoResult {
  id: string;
  title: string;
  source: string;
  channelName: string;
  thumbnailUrl: string | null;
  url: string;
  views: number;
  durationSeconds: number;
  publishedAt: number;
}

interface FederatedSearchResponse {
  data?: SearchResult[];
  identities?: IdentityResult[];
  communities?: CommunityResult[];
  videos?: VideoResult[];
  meta?: { total: number; limit: number };
}

type SearchTab = 'top' | 'latest' | 'people' | 'communities' | 'videos';

// ─── Protocol filter pills ────────────────────────────────────

const PROTOCOL_FILTERS = [
  { id: 'nostr', label: 'Nostr', color: '#8e30eb' },
  { id: 'farcaster', label: 'Farcaster', color: '#8a63d2' },
  { id: 'lens', label: 'Lens', color: '#abfe2c' },
  { id: 'bluesky', label: 'Bluesky', color: '#1185fe' },
  { id: 'mastodon', label: 'Mastodon', color: '#6364ff' },
  { id: 'lemmy', label: 'Lemmy', color: '#00bc8c' },
  { id: 'peertube', label: 'PeerTube', color: '#f1680d' },
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

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    return `${hours}:${String(mins % 60).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
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
          <div className="h-10 w-10 rounded-full bg-[var(--color-card)]" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-32 rounded bg-[var(--color-card)]" />
            <div className="h-3 w-full rounded bg-[var(--color-card)]" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── LoadMoreButton ─────────────────────────────────────────

function LoadMoreButton({
  loading,
  hasMore,
  onClick,
}: {
  loading: boolean;
  hasMore: boolean;
  onClick: () => void;
}) {
  if (!hasMore && !loading) {
    return (
      <div className="py-8 text-center">
        <span className="text-xs text-[var(--color-muted)]">No more results</span>
      </div>
    );
  }
  return (
    <div className="flex justify-center py-8">
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-6 py-2.5 text-sm font-medium text-[var(--color-fg)] transition-colors hover:border-degen-500/30 hover:text-degen-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? (
          <>
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Loading…
          </>
        ) : (
          'Load More'
        )}
      </button>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────

export default function SearchPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQ = searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQ);
  const [tab, setTab] = useState<SearchTab>('top');
  const [posts, setPosts] = useState<SearchResult[]>([]);
  const [identities, setIdentities] = useState<IdentityResult[]>([]);
  const [communities, setCommunities] = useState<CommunityResult[]>([]);
  const [videos, setVideos] = useState<VideoResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(!!initialQ);
  const [error, setError] = useState<string | null>(null);
  const [protocolFilter, setProtocolFilter] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const loadCountRef = useRef(1);
  const inputRef = useRef<HTMLInputElement>(null);
  // ── Autocomplete ──
  interface AutocompleteSuggestion {
    text: string;
    type: 'query' | 'creator' | 'community' | 'coin' | 'trending';
    source?: string;
    score: number;
  }
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [acLoading, setAcLoading] = useState(false);
  const autocompleteRef = useRef<AbortController | null>(null);

  // ── Recent & trending searches ──
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [trendingSearches] = useState<string[]>([
    'bitcoin',
    'ethereum',
    'solana',
    'defi',
    'nft',
    'ai',
    'memecoin',
    'layer2',
  ]);
  const MAX_RECENT_SEARCHES = 8;

  // Load recent searches from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('df_recent_searches');
      if (stored) {
        const parsed = JSON.parse(stored) as string[];
        setRecentSearches(parsed.slice(0, MAX_RECENT_SEARCHES));
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Save recent search
  const saveRecentSearch = useCallback((q: string) => {
    const trimmed = q.trim();
    if (!trimmed || trimmed.length < 2) return;
    setRecentSearches((prev) => {
      const updated = [trimmed, ...prev.filter((s) => s !== trimmed)].slice(0, MAX_RECENT_SEARCHES);
      try {
        localStorage.setItem('df_recent_searches', JSON.stringify(updated));
      } catch {
        /* quota */
      }
      return updated;
    });
  }, []);

  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    try {
      localStorage.removeItem('df_recent_searches');
    } catch {
      /* ignore */
    }
  }, []);

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
    async (q: string, append: boolean = false) => {
      if (q.length < 2) {
        setPosts([]);
        setIdentities([]);
        setCommunities([]);
        setVideos([]);
        setSearched(false);
        return;
      }
      // Save to recent searches (only on initial search, not append)
      if (!append) {
        saveRecentSearch(q);
      }

      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        loadCountRef.current = 1;
        setHasMore(true);
      }
      setSearched(true);
      setError(null);

      try {
        const protocolsParam = protocolFilter ? `&protocols=${protocolFilter}` : '';
        const limit = Math.min(loadCountRef.current * 50, 100);

        const res = await retryFetch(
          `/api/search?q=${encodeURIComponent(q)}&limit=${limit}${protocolsParam}`,
          {
            maxRetries: 2,
            fetchOptions: { credentials: 'include' },
          },
        );

        const data: FederatedSearchResponse = res.ok
          ? ((await res.json()) as FederatedSearchResponse)
          : {};

        const newPosts = data.data ?? [];
        const newIdentities = data.identities ?? [];
        const newCommunities = data.communities ?? [];
        const newVideos = data.videos ?? [];

        // Client-side fuzzy re-rank on initial search (not append)
        const rerankedPosts = append
          ? newPosts
          : newPosts.length > 0
            ? rerankResults(
                newPosts.map((p, i) => ({
                  ...p,
                  searchText: p.text,
                  searchAuthor: p.author.displayName,
                  originalIndex: i,
                })),
                q,
              )
            : [];

        if (append) {
          // Deduplicate by ID when appending using functional updaters
          setPosts((prev) => {
            const existing = new Set(prev.map((p) => p.id));
            return [...prev, ...rerankedPosts.filter((p) => !existing.has(p.id))];
          });
          setIdentities((prev) => {
            const existing = new Set(prev.map((i) => i.id));
            return [...prev, ...newIdentities.filter((i) => !existing.has(i.id))];
          });
          setCommunities((prev) => {
            const existing = new Set(prev.map((c) => c.id));
            return [...prev, ...newCommunities.filter((c) => !existing.has(c.id))];
          });
          setVideos((prev) => {
            const existing = new Set(prev.map((v) => v.id));
            return [...prev, ...newVideos.filter((v) => !existing.has(v.id))];
          });

          // Check if we got zero new results — exhausted
          const totalResults =
            newPosts.length + newIdentities.length + newCommunities.length + newVideos.length;
          if (totalResults === 0) {
            setHasMore(false);
          }
          // Backend limit caps at 100, so at most one load-more
          setHasMore(false);
          loadCountRef.current += 1;
        } else {
          setPosts(rerankedPosts);
          setIdentities(newIdentities);
          setCommunities(newCommunities);
          setVideos(newVideos);
          loadCountRef.current = 2; // next load-more will fetch with limit=100
          // If total results are sparse, may already be exhausted
          const totalResults =
            newPosts.length + newIdentities.length + newCommunities.length + newVideos.length;
          if (totalResults < 50) {
            setHasMore(false);
          }
        }
      } catch (err) {
        if (!append) {
          setPosts([]);
          setIdentities([]);
          setCommunities([]);
          setVideos([]);
        }
        setError(err instanceof Error ? err.message : 'Search unavailable');
      }
      if (append) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    },
    [protocolFilter],
  );

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    doSearch(query, true);
  }, [query, loadingMore, hasMore, doSearch]);

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

  // Fetch autocomplete suggestions
  const fetchAutocomplete = useCallback(async (q: string) => {
    if (q.length < 2) {
      setAutocompleteSuggestions([]);
      setShowAutocomplete(false);
      return;
    }
    // Cancel previous request
    if (autocompleteRef.current) {
      autocompleteRef.current.abort();
    }
    const controller = new AbortController();
    autocompleteRef.current = controller;
    setAcLoading(true);
    try {
      const res = await fetch(`/api/search/autocomplete?q=${encodeURIComponent(q)}`, {
        signal: controller.signal,
      });
      if (!res.ok) return;
      const data = (await res.json()) as { suggestions: AutocompleteSuggestion[] };
      setAutocompleteSuggestions(data.suggestions ?? []);
      setShowAutocomplete(data.suggestions?.length > 0);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      // ignore other errors
    } finally {
      setAcLoading(false);
    }
  }, []);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const handleChange = useCallback(
    (val: string) => {
      setQuery(val);
      // Show autocomplete immediately on typing
      fetchAutocomplete(val);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        updateUrl(val);
        doSearch(val);
      }, 250);
    },
    [doSearch, updateUrl, fetchAutocomplete],
  );

  const handleAutocompleteSelect = useCallback(
    (suggestion: AutocompleteSuggestion) => {
      setShowAutocomplete(false);
      setQuery(suggestion.text);
      updateUrl(suggestion.text);
      doSearch(suggestion.text);
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

  const filteredPosts =
    protocolFilter && tab !== 'people' ? posts.filter((p) => p.protocol === protocolFilter) : posts;

  const showAll = tab === 'top' || tab === 'latest';
  const sortedPosts =
    tab === 'latest' ? [...filteredPosts].sort((a, b) => b.createdAt - a.createdAt) : filteredPosts;
  const visiblePosts = showAll ? sortedPosts : [];
  const visibleIdentities = showAll || tab === 'people' ? identities : [];
  const visibleCommunities = showAll || tab === 'communities' ? communities : [];
  const visibleVideos = showAll || tab === 'videos' ? videos : [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[var(--color-fg)] mb-4">Search</h1>
        <div className="relative">
          <label htmlFor="search-input" className="sr-only">
            Search
          </label>
          <input
            ref={inputRef}
            id="search-input"
            type="text"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search posts, people, topics..."
            className="input h-12 pl-12 pr-4 text-base"
          />
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-muted)]">
            {loading ? '⟳' : '⌕'}
          </span>
          {/* Autocomplete dropdown */}
          {showAutocomplete && autocompleteSuggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-lg">
              {autocompleteSuggestions.map((s, i) => {
                const typeIcon =
                  s.type === 'creator' ? '👤' :
                  s.type === 'community' ? '🏘️' :
                  s.type === 'coin' ? '🪙' :
                  s.type === 'trending' ? '🔥' : '⌕';
                return (
                  <button
                    key={`${s.text}-${i}`}
                    type="button"
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-[var(--color-overlay)]"
                    onClick={() => handleAutocompleteSelect(s)}
                  >
                    <span className="text-base">{typeIcon}</span>
                    <span className="flex-1 text-[var(--color-fg)]">{s.text}</span>
                    {s.source && (
                      <span
                        className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium"
                        style={{ backgroundColor: `${getProtocolColor(s.source)}18`, color: getProtocolColor(s.source) }}
                      >
                        {s.source}
                      </span>
                    )}
                    <span className="text-[10px] text-[var(--color-muted)]">{s.type}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent searches + trending searches (shown when no query is active) */}
      {!searched && query.length < 2 && (
        <div className="mb-4 space-y-4">
          {recentSearches.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xs font-medium uppercase tracking-wider text-[var(--color-muted)]">
                  Recent Searches
                </h2>
                <button
                  type="button"
                  onClick={clearRecentSearches}
                  className="text-[10px] text-[var(--color-muted)] hover:text-red-400 transition-colors"
                >
                  Clear all
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => {
                      setQuery(q);
                      updateUrl(q);
                      doSearch(q);
                    }}
                    className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1.5 text-xs font-medium text-[var(--color-fg)] transition-colors hover:border-degen-500/30 hover:text-degen-400"
                  >
                    <span className="text-[10px] text-[var(--color-muted)]">⌕</span>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <h2 className="text-xs font-medium uppercase tracking-wider text-[var(--color-muted)] mb-2">
              Trending Searches
            </h2>
            <div className="flex flex-wrap gap-2">
              {trendingSearches.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => {
                    setQuery(q);
                    updateUrl(q);
                    doSearch(q);
                  }}
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1.5 text-xs font-medium text-[var(--color-fg)] transition-colors hover:border-degen-500/30 hover:text-degen-400"
                >
                  <span className="text-[10px]">🔥</span>
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Protocol filter pills */}
      {searched && !loading && (
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setProtocolFilter(null)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              protocolFilter === null
                ? 'bg-degen-500/20 text-degen-400'
                : 'bg-[var(--color-card)] text-[var(--color-muted)] hover:text-[var(--color-fg)]'
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
                backgroundColor: protocolFilter === pf.id ? `${pf.color}22` : 'var(--color-card)',
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
        <div className="mb-6 flex gap-1 rounded-xl bg-[var(--color-card)] p-1">
          {(
            [
              { id: 'top' as const, label: 'Top' },
              { id: 'latest' as const, label: 'Latest' },
              { id: 'people' as const, label: 'People' },
              { id: 'communities' as const, label: 'Communities' },
              { id: 'videos' as const, label: 'Videos' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === t.id
                  ? 'bg-degen-500/20 text-degen-400'
                  : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
              }`}
            >
              {t.label}
              {t.id === 'people' && identities.length > 0 && ` (${identities.length})`}
              {t.id === 'communities' && communities.length > 0 && ` (${communities.length})`}
              {t.id === 'videos' && videos.length > 0 && ` (${videos.length})`}
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
      {searched &&
        !loading &&
        !error &&
        visiblePosts.length === 0 &&
        visibleIdentities.length === 0 &&
        visibleCommunities.length === 0 &&
        visibleVideos.length === 0 && (
          <div className="card py-12 text-center">
            <div className="mb-3 text-3xl text-[var(--color-muted)]">⌕</div>
            <p className="text-sm text-[var(--color-muted)]">
              No results for &ldquo;{query}&rdquo;
            </p>
            {protocolFilter && (
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                Try removing the protocol filter
              </p>
            )}
          </div>
        )}

      {/* ═══ People Results ═══ */}
      {visibleIdentities.length > 0 && (
        <div className="mb-8">
          {showAll && (
            <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-[var(--color-muted)]">
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
                  rel="noopener noreferrer"
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
                      rel="noopener noreferrer"
                      className="truncate text-sm font-semibold text-[var(--color-fg)] hover:underline"
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
                    <div className="text-xs text-[var(--color-muted)] truncate mt-0.5">
                      {identity.handle}
                    </div>
                  )}
                  {identity.bio && (
                    <div className="mt-1 text-xs text-[var(--color-muted)] line-clamp-2">
                      {identity.bio}
                    </div>
                  )}
                  <div className="mt-2 flex items-center gap-3">
                    {identity.postCount > 0 && (
                      <span className="text-[10px] text-[var(--color-muted)]">
                        {formatCount(identity.postCount)} posts
                      </span>
                    )}
                    <a
                      href={getProfileUrl(identity)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto rounded-lg border border-[var(--color-border)] px-2.5 py-1 text-xs text-[var(--color-muted)] hover:border-degen-500/30 hover:text-degen-400 transition-colors"
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

      {/* ═══ Community Results ═══ */}
      {visibleCommunities.length > 0 && (
        <div className="mb-8">
          {showAll && (
            <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-[var(--color-muted)]">
              Communities
            </h2>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {visibleCommunities.map((community) => (
              <a
                key={community.id}
                href={community.url}
                target="_blank"
                rel="noopener noreferrer"
                className="card-hover flex items-start gap-4 p-4 transition-colors"
              >
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-base font-bold overflow-hidden"
                  style={{
                    backgroundColor: `${getProtocolColor(community.protocol)}22`,
                    color: getProtocolColor(community.protocol),
                  }}
                >
                  {community.icon ? (
                    <Image
                      src={community.icon}
                      alt={community.name}
                      width={48}
                      height={48}
                      className="h-12 w-12 rounded-xl object-cover"
                    />
                  ) : (
                    community.name[0]?.toUpperCase() || getProtocolIcon(community.protocol)
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-[var(--color-fg)]">
                      {community.name}
                    </span>
                    <span
                      className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                      style={{
                        backgroundColor: `${getProtocolColor(community.protocol)}22`,
                        color: getProtocolColor(community.protocol),
                      }}
                    >
                      {community.protocol}
                    </span>
                  </div>
                  {community.description && (
                    <div className="mt-1 text-xs text-[var(--color-muted)] line-clamp-2">
                      {community.description}
                    </div>
                  )}
                  {community.memberCount > 0 && (
                    <div className="mt-1 text-[10px] text-[var(--color-muted)]">
                      {formatCount(community.memberCount)} members
                    </div>
                  )}
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* ═══ Video Results ═══ */}
      {visibleVideos.length > 0 && (
        <div className="mb-8">
          {showAll && (
            <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-[var(--color-muted)]">
              Videos
            </h2>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {visibleVideos.map((video) => (
              <a
                key={video.id}
                href={video.url}
                target="_blank"
                rel="noopener noreferrer"
                className="card-hover flex items-start gap-4 p-4 transition-colors"
              >
                <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-lg bg-[var(--color-card)]">
                  {video.thumbnailUrl ? (
                    <Image
                      src={video.thumbnailUrl}
                      alt={video.title}
                      width={112}
                      height={64}
                      className="h-16 w-28 object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-lg text-[var(--color-muted)]">
                      ▶
                    </div>
                  )}
                  {video.durationSeconds > 0 && (
                    <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[9px] text-[var(--color-fg)]">
                      {formatDuration(video.durationSeconds)}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-[var(--color-fg)]">
                      {video.title}
                    </span>
                    <span className="shrink-0 rounded-full bg-orange-500/20 px-1.5 py-0.5 text-[10px] font-medium text-orange-400">
                      {video.source}
                    </span>
                  </div>
                  {video.channelName && (
                    <div className="mt-0.5 text-xs text-[var(--color-muted)] truncate">
                      {video.channelName}
                    </div>
                  )}
                  <div className="mt-1 flex gap-3 text-[10px] text-[var(--color-muted)]">
                    {video.views > 0 && <span>{formatCount(video.views)} views</span>}
                    {video.publishedAt > 0 && <span>{formatTime(video.publishedAt)}</span>}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* ═══ Post Results ═══ */}
      {visiblePosts.length > 0 && (
        <div>
          {showAll && visibleIdentities.length > 0 && (
            <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-[var(--color-muted)]">
              Posts
            </h2>
          )}
          <div className="space-y-2">
            {visiblePosts.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => router.push(`/post/${encodeURIComponent(r.id)}`)}
                className="card-hover flex w-full items-start gap-4 p-4 text-left"
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
                    />
                  ) : (
                    r.author.displayName[0]?.toUpperCase() || '?'
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-medium text-[var(--color-fg)] truncate">
                      {r.author.displayName}
                    </span>
                    <span
                      className="text-[var(--color-muted)]"
                      style={{ color: getProtocolColor(r.protocol) }}
                    >
                      {r.protocol}
                    </span>
                    <span className="ml-auto text-[var(--color-muted)]">
                      {formatTime(r.createdAt)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-[var(--color-muted)] line-clamp-2">{r.text}</p>
                  <div className="mt-2 flex items-center gap-3 text-[10px] text-[var(--color-muted)]">
                    <span>♥ {r.metrics.likes}</span>
                    <span>↻ {r.metrics.reposts}</span>
                    <span>✎ {r.metrics.replies}</span>
                    {r.niches.length > 0 && (
                      <div className="ml-auto flex gap-1">
                        {r.niches.slice(0, 2).map((n) => (
                          <span
                            key={n}
                            className="rounded-full bg-[var(--color-card)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted)]"
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
                    alt="Search result image"
                    width={64}
                    height={64}
                    className="h-16 w-16 shrink-0 rounded-lg object-cover"
                    loading="lazy"
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Load More */}
      {searched &&
        !loading &&
        !error &&
        (visiblePosts.length > 0 ||
          visibleIdentities.length > 0 ||
          visibleCommunities.length > 0 ||
          visibleVideos.length > 0) && (
          <LoadMoreButton loading={loadingMore} hasMore={hasMore} onClick={loadMore} />
        )}
    </div>
  );
}
