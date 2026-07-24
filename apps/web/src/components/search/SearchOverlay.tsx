'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { rerankResults } from '@/lib/fuzzySearch';
import {
  getProfileUrl,
  getRecentSearches,
  getTrendingIcon,
  PROTOCOL_FILTERS,
  saveRecentSearch,
  TRENDING_TOPICS,
} from './SearchHelpers';
import { SearchIcon } from './SearchIcons';
import { SearchResultsContainer } from './SearchResultsSection';
import type {
  CommunityResult,
  FlatItem,
  IdentityResult,
  SearchResponse,
  SearchResult,
  VideoResult,
} from './SearchTypes';

export function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [identities, setIdentities] = useState<IdentityResult[]>([]);
  const [communities, setCommunities] = useState<CommunityResult[]>([]);
  const [videos, setVideos] = useState<VideoResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [protocolFilter, setProtocolFilter] = useState<string | null>(null);
  const [trendingTopics, setTrendingTopics] = useState<Array<{
    label: string;
    query: string;
    icon: string;
  }> | null>(null);
  const [trendingLoading, setTrendingLoading] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Build flat list for keyboard navigation
  const flatItems: FlatItem[] = useMemo(() => {
    const items: FlatItem[] = [];
    identities.forEach((d) => items.push({ type: 'identity', data: d }));
    results.forEach((d) => items.push({ type: 'post', data: d }));
    communities.forEach((d) => items.push({ type: 'community', data: d }));
    videos.forEach((d) => items.push({ type: 'video', data: d }));
    return items;
  }, [identities, results, communities, videos]);

  // Load recent searches on open
  useEffect(() => {
    if (open) setRecentSearches(getRecentSearches());
  }, [open]);

  // Fetch real trending topics from API
  useEffect(() => {
    if (!open || query) return;
    let cancelled = false;
    setTrendingLoading(true);
    fetch('/api/trending/aggregated?limit=12&minScore=5', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { data?: Array<{ title: string }> } | null) => {
        if (cancelled) return;
        if (data?.data && data.data.length > 0) {
          setTrendingTopics(
            data.data.map((item) => ({
              label: item.title,
              query: item.title
                .toLowerCase()
                .replace(/[^a-z0-9 ]/g, '')
                .slice(0, 50),
              icon: getTrendingIcon(item.title),
            })),
          );
        } else {
          setTrendingTopics(null);
        }
      })
      .catch(() => {
        if (!cancelled) setTrendingTopics(null);
      })
      .finally(() => {
        if (!cancelled) setTrendingLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, query]);

  // Reset state when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setIdentities([]);
      setCommunities([]);
      setVideos([]);
      setSearched(false);
      setSelectedIndex(-1);
      setProtocolFilter(null);
      setError(null);
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex < 0 || !resultsContainerRef.current) return;
    const el = resultsContainerRef.current.querySelector<HTMLElement>(
      `[data-result-idx="${selectedIndex}"]`,
    );
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const doSearch = useCallback(
    async (q: string) => {
      if (q.length < 2) {
        setResults([]);
        setIdentities([]);
        setCommunities([]);
        setVideos([]);
        setSearched(false);
        return;
      }
      setLoading(true);
      setSearched(true);
      setError(null);
      setSelectedIndex(-1);
      try {
        const pf = protocolFilter ? `&protocols=${protocolFilter}` : '';
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=20${pf}`, {
          credentials: 'include',
        });
        const data: SearchResponse = res.ok ? ((await res.json()) as SearchResponse) : {};
        const rawPosts = data.data ?? [];
        if (rawPosts.length > 0) {
          setResults(
            rerankResults(
              rawPosts.map((p, i) => ({
                ...p,
                searchText: p.text,
                searchAuthor: p.author.displayName,
                originalIndex: i,
              })),
              q,
            ),
          );
        } else {
          setResults([]);
        }
        setIdentities(data.identities ?? []);
        setCommunities(data.communities ?? []);
        setVideos(data.videos ?? []);
      } catch (err) {
        setResults([]);
        setIdentities([]);
        setCommunities([]);
        setVideos([]);
        setError(err instanceof Error ? err.message : 'Search failed');
      }
      setLoading(false);
    },
    [protocolFilter],
  );

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const handleChange = useCallback(
    (val: string) => {
      setQuery(val);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => doSearch(val), 200);
    },
    [doSearch],
  );

  const triggerSearch = useCallback(
    (q: string) => {
      setQuery(q);
      doSearch(q);
    },
    [doSearch],
  );

  const commitSearch = useCallback((q: string) => {
    const trimmed = q.trim();
    if (trimmed) saveRecentSearch(trimmed);
    setRecentSearches(getRecentSearches());
  }, []);

  const navigateToItem = useCallback(
    (item: FlatItem) => {
      const q = query.trim();
      if (q) saveRecentSearch(q);
      switch (item.type) {
        case 'identity':
          router.push(getProfileUrl(item.data as IdentityResult));
          break;
        case 'post':
          router.push(`/post/${encodeURIComponent((item.data as SearchResult).id)}`);
          break;
        case 'community':
          window.open((item.data as CommunityResult).url, '_blank', 'noopener,noreferrer');
          break;
        case 'video':
          window.open((item.data as VideoResult).url, '_blank', 'noopener,noreferrer');
          break;
      }
      onClose();
    },
    [query, router, onClose],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((p) => (p < flatItems.length - 1 ? p + 1 : 0));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((p) => (p > 0 ? p - 1 : flatItems.length - 1));
        return;
      }
      if (e.key === 'Enter') {
        if (selectedIndex >= 0 && selectedIndex < flatItems.length) {
          e.preventDefault();
          const item = flatItems[selectedIndex];
          if (item) navigateToItem(item);
          return;
        }
        if (query.trim().length >= 2) {
          e.preventDefault();
          commitSearch(query);
          router.push(`/search?q=${encodeURIComponent(query.trim())}`);
          onClose();
        }
      }
    },
    [flatItems, selectedIndex, navigateToItem, query, router, onClose, commitSearch],
  );

  const handleClear = useCallback(() => {
    setQuery('');
    setResults([]);
    setIdentities([]);
    setCommunities([]);
    setVideos([]);
    setSearched(false);
    setSelectedIndex(-1);
    setError(null);
    inputRef.current?.focus();
  }, []);

  if (!open) return null;

  const effectiveTrending = trendingTopics ?? TRENDING_TOPICS;
  const showRecent = !query && recentSearches.length > 0;
  const showTrending = !query && recentSearches.length === 0 && !trendingLoading;

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label="Search"
      onKeyDown={handleKeyDown}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      className="fixed inset-0 z-[65] flex items-end sm:items-start justify-center bg-black/60 pt-0 sm:pt-[15vh] backdrop-blur-sm animate-fade-in"
    >
      <div className="w-full max-w-xl px-4 pb-4 sm:pb-0 animate-slide-up sm:animate-none rounded-t-2xl sm:rounded-none bg-[var(--color-bg)] sm:bg-transparent pt-4 sm:pt-0">
        {/* Search Input */}
        <div className="relative mb-2">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-muted)] pointer-events-none">
            <SearchIcon loading={loading} />
          </span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Search DegenFeed"
            className="input h-12 pl-12 pr-20 text-base rounded-2xl shadow-lg shadow-black/20"
            role="searchbox"
            aria-label="Search posts, people, communities, and videos"
            autoComplete="off"
            enterKeyHint="search"
          />
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-12 top-1/2 -translate-y-1/2 flex items-center justify-center h-6 w-6 rounded-full text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-card)] transition-colors"
              aria-label="Clear search"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
          <span className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 items-center gap-1">
            <kbd className="rounded-md border border-white/10 bg-white/[0.06] px-1.5 py-0.5 font-mono text-[9px] font-medium leading-none text-[var(--color-muted)]">
              ↑↓
            </kbd>
            <kbd className="rounded-md border border-white/10 bg-white/[0.06] px-1.5 py-0.5 font-mono text-[9px] font-medium leading-none text-[var(--color-muted)]">
              ↵
            </kbd>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-1.5 py-0.5 text-[10px] text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
              aria-label="Close search"
            >
              <kbd className="rounded-md border border-white/10 bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] font-medium leading-none">
                ESC
              </kbd>
            </button>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="flex sm:hidden absolute right-3 top-1/2 -translate-y-1/2 rounded-lg px-1.5 py-0.5 text-[10px] text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
            aria-label="Close search"
          >
            <kbd className="rounded-md border border-white/10 bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] font-medium leading-none">
              ESC
            </kbd>
          </button>
        </div>

        {/* Protocol Filter Pills */}
        {query.length >= 2 && (
          <div className="mb-3 flex flex-wrap gap-1.5 px-1">
            {PROTOCOL_FILTERS.map((pf) => (
              <button
                key={pf.id ?? 'all'}
                type="button"
                onClick={() => {
                  const next = protocolFilter === pf.id ? null : pf.id;
                  setProtocolFilter(next);
                  if (query.length >= 2) doSearch(query);
                }}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
                  protocolFilter === pf.id
                    ? 'bg-degen-500/20 text-degen-400 shadow-sm'
                    : 'bg-[var(--color-card)] text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-overlay)]'
                }`}
              >
                {pf.label}
              </button>
            ))}
          </div>
        )}

        {/* Recent Searches */}
        {showRecent && (
          <div className="rounded-2xl bg-[var(--color-card)] shadow-lg shadow-black/10 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--color-border)]">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-muted)]">
                Recent Searches
              </span>
              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem('df_recent_searches');
                  setRecentSearches([]);
                }}
                className="text-[10px] text-[var(--color-muted)] hover:text-red-400 transition-colors"
              >
                Clear
              </button>
            </div>
            <div className="py-1">
              {recentSearches.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => triggerSearch(q)}
                  onMouseDown={(e) => e.preventDefault()}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[var(--color-fg)] hover:bg-[var(--color-overlay)] transition-colors text-left group"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    className="shrink-0 text-[var(--color-muted)]"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  <span className="truncate flex-1">{q}</span>
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    className="shrink-0 text-[var(--color-muted)] opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Trending */}
        {showTrending && (
          <div className="rounded-2xl bg-[var(--color-card)] shadow-lg shadow-black/10 overflow-hidden">
            <div className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-muted)] border-b border-[var(--color-border)]">
              Trending on DegenFeed
            </div>
            <div className="p-3 flex flex-wrap gap-1.5">
              {effectiveTrending.map((t) => (
                <button
                  key={t.query}
                  type="button"
                  onClick={() => triggerSearch(t.query)}
                  className="flex items-center gap-1.5 rounded-full bg-[var(--color-overlay)] px-3 py-1.5 text-xs text-[var(--color-fg)] hover:bg-degen-500/10 hover:text-degen-400 transition-colors"
                >
                  <span>{t.icon}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!searched && !loading && !query && !showRecent && !showTrending && (
          <div className="rounded-2xl bg-[var(--color-card)] shadow-lg shadow-black/10 py-12 text-center">
            <div className="mb-4 text-[var(--color-muted)] opacity-30">
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mx-auto"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            </div>
            <p className="text-sm text-[var(--color-muted)] max-w-xs mx-auto leading-relaxed">
              Search for posts, people, and communities across all protocols
            </p>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="rounded-2xl bg-[var(--color-card)] shadow-lg shadow-black/10 p-3 space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex animate-pulse items-center gap-3 p-2">
                <div className="h-9 w-9 rounded-full bg-[var(--color-overlay)]" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-28 rounded bg-[var(--color-overlay)]" />
                  <div className="h-3 w-full rounded bg-[var(--color-overlay)]" />
                  <div className="h-2 w-20 rounded bg-[var(--color-overlay)]" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-2xl border border-red-900/50 bg-red-900/10 py-4 text-center">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Results */}
        {searched && !loading && !error && (
          <div ref={resultsContainerRef}>
            <SearchResultsContainer
              query={query}
              results={results}
              identities={identities}
              communities={communities}
              videos={videos}
              flatItems={flatItems}
              selectedIndex={selectedIndex}
              onSelectIndex={setSelectedIndex}
              onClose={onClose}
              protocolFilter={protocolFilter}
              onCommitSearch={commitSearch}
            />
          </div>
        )}
      </div>
    </div>
  );
}
