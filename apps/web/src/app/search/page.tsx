'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { rerankResults } from '@/lib/fuzzySearch';
import { SearchFilters, type SearchTab } from '../../components/search/SearchFilters';
import { type AutocompleteSuggestion, SearchInput } from '../../components/search/SearchInput';
import {
  type CommunityResult,
  type IdentityResult,
  type SearchResult,
  SearchResults,
  type VideoResult,
} from '../../components/search/SearchResults';
import { retryFetch } from '../../lib/retryFetch';

interface FederatedSearchResponse {
  data?: SearchResult[];
  identities?: IdentityResult[];
  communities?: CommunityResult[];
  videos?: VideoResult[];
  meta?: { total: number; limit: number };
}

const MAX_RECENT_SEARCHES = 8;

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
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [trendingPerProtocol, setTrendingPerProtocol] = useState<Record<string, string[]> | null>(
    null,
  );
  const trendingSearches = [
    'bitcoin',
    'ethereum',
    'solana',
    'defi',
    'nft',
    'ai',
    'memecoin',
    'layer2',
  ];

  // Fetch trending across all protocols
  useEffect(() => {
    let cancelled = false;
    fetch('/api/trending/aggregated?limit=15&minScore=3', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { data?: Array<{ title: string; source?: string }> } | null) => {
        if (cancelled || !data?.data) return;
        const grouped: Record<string, string[]> = {};
        for (const item of data.data) {
          const source = item.source || 'all';
          if (!grouped[source]) grouped[source] = [];
          grouped[source]?.push(item.title);
        }
        setTrendingPerProtocol(grouped);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Load recent searches
  useEffect(() => {
    try {
      const stored = localStorage.getItem('df_recent_searches');
      if (stored) setRecentSearches(JSON.parse(stored).slice(0, MAX_RECENT_SEARCHES));
    } catch {
      /* ignore */
    }
  }, []);

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

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const updateUrl = useCallback(
    (q: string) => {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      router.replace(`/search${params.toString() ? `?${params.toString()}` : ''}`, {
        scroll: false,
      });
    },
    [router],
  );

  const doSearch = useCallback(
    async (q: string, append = false) => {
      if (q.length < 2) {
        setPosts([]);
        setIdentities([]);
        setCommunities([]);
        setVideos([]);
        setSearched(false);
        return;
      }
      if (!append) saveRecentSearch(q);

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
        const data: FederatedSearchResponse = res.ok ? await res.json() : {};
        const newPosts = data.data ?? [];
        const newIdentities = data.identities ?? [];
        const newCommunities = data.communities ?? [];
        const newVideos = data.videos ?? [];

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
          setPosts((prev) => {
            const e = new Set(prev.map((p) => p.id));
            return [...prev, ...rerankedPosts.filter((p) => !e.has(p.id))];
          });
          setIdentities((prev) => {
            const e = new Set(prev.map((i) => i.id));
            return [...prev, ...newIdentities.filter((i) => !e.has(i.id))];
          });
          setCommunities((prev) => {
            const e = new Set(prev.map((c) => c.id));
            return [...prev, ...newCommunities.filter((c) => !e.has(c.id))];
          });
          setVideos((prev) => {
            const e = new Set(prev.map((v) => v.id));
            return [...prev, ...newVideos.filter((v) => !e.has(v.id))];
          });
          const total =
            newPosts.length + newIdentities.length + newCommunities.length + newVideos.length;
          if (total === 0) setHasMore(false);
          setHasMore(false);
          loadCountRef.current += 1;
        } else {
          setPosts(rerankedPosts);
          setIdentities(newIdentities);
          setCommunities(newCommunities);
          setVideos(newVideos);
          loadCountRef.current = 2;
          const total =
            newPosts.length + newIdentities.length + newCommunities.length + newVideos.length;
          if (total < 50) setHasMore(false);
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
    [protocolFilter, saveRecentSearch],
  );

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    doSearch(query, true);
  }, [query, loadingMore, hasMore, doSearch]);

  useEffect(() => {
    if (initialQ.length >= 2) doSearch(initialQ);
  }, [initialQ, doSearch]);

  useEffect(() => {
    if (error && retryCount > 0 && retryCount < 3) {
      const timer = setTimeout(() => doSearch(query), 1000 * retryCount);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [error, retryCount, doSearch, query]);

  const handleAutocompleteSelect = useCallback(
    (s: AutocompleteSuggestion) => {
      setQuery(s.text);
      updateUrl(s.text);
      doSearch(s.text);
    },
    [doSearch, updateUrl],
  );

  const filteredPosts =
    protocolFilter && tab !== 'people' ? posts.filter((p) => p.protocol === protocolFilter) : posts;
  const showAll = tab === 'top' || tab === 'latest';
  const sortedPosts =
    tab === 'latest' ? [...filteredPosts].sort((a, b) => b.createdAt - a.createdAt) : filteredPosts;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[var(--color-fg)] mb-4">Search</h1>
        <SearchInput
          query={query}
          loading={loading}
          onChange={setQuery}
          onSubmit={(val) => {
            updateUrl(val);
            doSearch(val);
          }}
          onAutocompleteSelect={handleAutocompleteSelect}
        />
      </div>

      {/* Trending / Recent (shown before search) */}
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
              Trending Across Protocols
            </h2>
            {trendingPerProtocol ? (
              <div className="space-y-2">
                {Object.entries(trendingPerProtocol).map(([source, items]) => (
                  <div key={source} className="flex flex-wrap items-center gap-1.5">
                    <span
                      className="rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase"
                      style={{ backgroundColor: `#1185fe18`, color: '#1185fe' }}
                    >
                      {source === 'all' ? 'All' : source}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {items.slice(0, 4).map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => {
                            setQuery(q);
                            updateUrl(q);
                            doSearch(q);
                          }}
                          className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-card)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-fg)] transition-colors hover:border-degen-500/30 hover:text-degen-400"
                        >
                          <span className="text-[9px]">🔥</span>
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
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
            )}
          </div>
        </div>
      )}

      <SearchFilters
        protocolFilter={protocolFilter}
        onProtocolFilterChange={setProtocolFilter}
        tab={tab}
        onTabChange={setTab}
        identityCount={identities.length}
        communityCount={communities.length}
        videoCount={videos.length}
        searched={searched}
        loading={loading}
      />

      <SearchResults
        loading={loading}
        searched={searched}
        error={error}
        query={query}
        protocolFilter={protocolFilter}
        onProtocolFilterChange={setProtocolFilter}
        posts={sortedPosts}
        identities={tab === 'people' || showAll ? identities : []}
        communities={tab === 'communities' || showAll ? communities : []}
        videos={tab === 'videos' || showAll ? videos : []}
        showAll={showAll}
        hasMore={hasMore}
        loadingMore={loadingMore}
        onLoadMore={loadMore}
        onRetry={() => {
          setRetryCount((c) => c + 1);
          doSearch(query);
        }}
      />
    </div>
  );
}
