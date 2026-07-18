'use client';

import { getProtocolColor, getProtocolIcon } from '@degenfeed/ui';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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

interface SearchResponse {
  data?: SearchResult[];
  identities?: IdentityResult[];
  communities?: CommunityResult[];
  videos?: VideoResult[];
}

// ─── Constants ─────────────────────────────────────────────────

const RECENT_SEARCHES_KEY = 'df_recent_searches';
const MAX_RECENT = 5;

const PROTOCOL_FILTERS = [
  { id: null as string | null, label: 'All' },
  { id: 'nostr', label: 'Nostr', color: '#8b5cf6' },
  { id: 'farcaster', label: 'Farcaster', color: '#8a63d2' },
  { id: 'lens', label: 'Lens', color: '#abfe2c' },
  { id: 'bluesky', label: 'Bluesky', color: '#1185fe' },
  { id: 'mastodon', label: 'Mastodon', color: '#6364ff' },
];

const TRENDING_TOPICS = [
  { label: 'Bitcoin', query: 'bitcoin', icon: '₿' },
  { label: 'Ethereum', query: 'ethereum', icon: '◆' },
  { label: 'Solana', query: 'solana', icon: '◎' },
  { label: 'DeFi', query: 'defi', icon: '🏦' },
  { label: 'NFT', query: 'nft', icon: '🖼' },
  { label: 'AI', query: 'ai', icon: '🤖' },
  { label: 'Memes', query: 'memes', icon: '😂' },
  { label: 'Gaming', query: 'gaming', icon: '🎮' },
];

// ─── Helpers ───────────────────────────────────────────────────

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

function getRecentSearches(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    return stored ? (JSON.parse(stored) as string[]) : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(q: string): void {
  try {
    const searches = getRecentSearches().filter((s) => s !== q);
    searches.unshift(q);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(searches.slice(0, MAX_RECENT)));
  } catch {
    // localStorage might be full or unavailable
  }
}

// ─── Flat item for keyboard nav ────────────────────────────────

type ItemType = 'identity' | 'post' | 'community' | 'video';
interface FlatItem {
  type: ItemType;
  data: IdentityResult | SearchResult | CommunityResult | VideoResult;
}

// ─── Sub-components ────────────────────────────────────────────

function SearchIcon({ loading }: { loading: boolean }) {
  if (loading) {
    return (
      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  );
}

function ProtocolBadge({ protocol }: { protocol: string }) {
  const color = getProtocolColor(protocol);
  const icon = getProtocolIcon(protocol);
  return (
    <span
      className="shrink-0 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-medium"
      style={{ backgroundColor: `${color}18`, color }}
    >
      <span className="text-[0.7em]">{icon}</span>
      <span>{protocol}</span>
    </span>
  );
}

function ResultAvatar({
  url,
  fallback,
  protocol,
  size = 36,
  rounded = 'full',
}: {
  url?: string | null;
  fallback: string;
  protocol: string;
  size?: number;
  rounded?: 'full' | 'xl' | 'lg';
}) {
  const color = getProtocolColor(protocol);
  const roundClass = rounded === 'full' ? 'rounded-full' : rounded === 'xl' ? 'rounded-xl' : 'rounded-lg';
  return (
    <div
      className={`flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden text-xs font-bold ${roundClass}`}
      style={{ backgroundColor: `${color}22`, color }}
    >
      {url ? (
        <Image src={url} alt="" width={size} height={size} className={`h-9 w-9 object-cover ${roundClass}`} />
      ) : (
        fallback[0]?.toUpperCase() || '?'
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────

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
    if (open) {
      setRecentSearches(getRecentSearches());
    }
  }, [open]);

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
    const el = resultsContainerRef.current.querySelector<HTMLElement>(`[data-result-idx="${selectedIndex}"]`);
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
        setResults(data.data ?? []);
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
      debounceRef.current = setTimeout(() => doSearch(val), 300);
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

  // Save query to recent + navigate
  const commitSearch = useCallback(
    (q: string) => {
      const trimmed = q.trim();
      if (trimmed) saveRecentSearch(trimmed);
      setRecentSearches(getRecentSearches());
    },
    [],
  );

  // Navigate to a specific result item
  const navigateToItem = useCallback(
    (item: FlatItem) => {
      const q = query.trim();
      if (q) saveRecentSearch(q);

      switch (item.type) {
        case 'identity': {
          const id = item.data as IdentityResult;
          router.push(getProfileUrl(id));
          break;
        }
        case 'post': {
          const post = item.data as SearchResult;
          router.push(`/post/${encodeURIComponent(post.id)}`);
          break;
        }
        case 'community': {
          const comm = item.data as CommunityResult;
          window.open(comm.url, '_blank', 'noopener,noreferrer');
          break;
        }
        case 'video': {
          const video = item.data as VideoResult;
          window.open(video.url, '_blank', 'noopener,noreferrer');
          break;
        }
      }
      onClose();
    },
    [query, router, onClose],
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < flatItems.length - 1 ? prev + 1 : 0));
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : flatItems.length - 1));
        return;
      }

      if (e.key === 'Enter') {
        if (selectedIndex >= 0 && selectedIndex < flatItems.length) {
          e.preventDefault();
          navigateToItem(flatItems[selectedIndex]);
          return;
        }
        // If no item selected but query exists, go to search page
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

  const hasAnyResults = identities.length > 0 || results.length > 0 || communities.length > 0 || videos.length > 0;

  if (!open) return null;

  const showRecent = !query && recentSearches.length > 0;
  const showTrending = !query && recentSearches.length === 0;

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
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-[15vh] backdrop-blur-sm"
    >
      <div className="w-full max-w-xl px-4">
        {/* ── Search Input ── */}
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
            className="input h-12 pl-12 pr-14 text-base rounded-2xl shadow-lg shadow-black/20"
            role="searchbox"
            aria-label="Search posts, people, communities, and videos"
            autoComplete="off"
            enterKeyHint="search"
          />

          {/* Clear button */}
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-12 top-1/2 -translate-y-1/2 flex items-center justify-center h-6 w-6 rounded-full text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-card)] transition-colors"
              aria-label="Clear search"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}

          {/* ESC badge */}
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg px-1.5 py-0.5 text-[10px] text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
            aria-label="Close search"
          >
            <kbd className="rounded-md border border-white/10 bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] font-medium leading-none">
              ESC
            </kbd>
          </button>
        </div>

        {/* ── Protocol Filter Pills ── */}
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

        {/* ── Recent Searches ── */}
        {showRecent && (
          <div className="rounded-2xl bg-[var(--color-card)] shadow-lg shadow-black/10 overflow-hidden">
            <div className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-muted)] border-b border-[var(--color-border)]">
              Recent Searches
            </div>
            <div className="py-1">
              {recentSearches.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => triggerSearch(q)}
                  onMouseDown={(e) => e.preventDefault()}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[var(--color-fg)] hover:bg-[var(--color-overlay)] transition-colors text-left"
                >
                  <svg
                    width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2" strokeLinecap="round" className="shrink-0 text-[var(--color-muted)]"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  <span className="truncate">{q}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Trending Searches ── */}
        {showTrending && (
          <div className="rounded-2xl bg-[var(--color-card)] shadow-lg shadow-black/10 overflow-hidden">
            <div className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-muted)] border-b border-[var(--color-border)]">
              Trending on DegenFeed
            </div>
            <div className="p-3 flex flex-wrap gap-1.5">
              {TRENDING_TOPICS.map((t) => (
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

        {/* ── Empty state (no query, no recent/trending) ── */}
        {!searched && !loading && !query && !showRecent && !showTrending && (
          <div className="rounded-2xl bg-[var(--color-card)] shadow-lg shadow-black/10 py-12 text-center">
            <div className="mb-4 text-[var(--color-muted)] opacity-30">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            </div>
            <p className="text-sm text-[var(--color-muted)] max-w-xs mx-auto leading-relaxed">
              Search for posts, people, and communities across all protocols
            </p>
          </div>
        )}

        {/* ── Loading skeleton ── */}
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

        {/* ── Error ── */}
        {error && (
          <div className="rounded-2xl border border-red-900/50 bg-red-900/10 py-4 text-center">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* ── Results Container ── */}
        {searched && !loading && !error && (
          <div
            ref={resultsContainerRef}
            className="max-h-[55vh] overflow-y-auto rounded-2xl bg-[var(--color-card)] shadow-lg shadow-black/10"
          >
            {/* No results */}
            {!hasAnyResults && (
              <div className="py-10 text-center">
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

            {/* ── People Section ── */}
            {identities.length > 0 && (
              <div>
                <div className="sticky top-0 z-10 bg-[var(--color-card)]/95 backdrop-blur-sm px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-muted)] border-b border-[var(--color-border)]">
                  People
                </div>
                {identities.map((identity) => {
                  const globalIdx = flatItems.findIndex(
                    (fi) => fi.type === 'identity' && (fi.data as IdentityResult).id === identity.id,
                  );
                  return (
                    <button
                      key={identity.id}
                      type="button"
                      data-result-idx={globalIdx}
                      onClick={() => {
                        commitSearch(query);
                        router.push(getProfileUrl(identity));
                        onClose();
                      }}
                      onMouseEnter={() => setSelectedIndex(globalIdx)}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        selectedIndex === globalIdx
                          ? 'bg-degen-500/10'
                          : 'hover:bg-[var(--color-overlay)]'
                      }`}
                    >
                      <ResultAvatar
                        url={identity.avatarUrl}
                        fallback={identity.displayName}
                        protocol={identity.protocol}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-[var(--color-fg)]">
                            {identity.displayName}
                          </span>
                          <ProtocolBadge protocol={identity.protocol} />
                        </div>
                        {identity.handle && (
                          <div className="text-xs text-[var(--color-muted)] truncate mt-0.5">
                            {identity.handle}
                          </div>
                        )}
                      </div>
                      <span className="shrink-0 rounded-lg border border-[var(--color-border)] px-2.5 py-1 text-[10px] text-[var(--color-muted)]">
                        View
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* ── Posts Section ── */}
            {results.length > 0 && (
              <div>
                <div className="sticky top-0 z-10 bg-[var(--color-card)]/95 backdrop-blur-sm px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-muted)] border-b border-[var(--color-border)]">
                  Posts
                </div>
                {results.map((r) => {
                  const globalIdx = flatItems.findIndex(
                    (fi) => fi.type === 'post' && (fi.data as SearchResult).id === r.id,
                  );
                  return (
                    <button
                      key={r.id}
                      type="button"
                      data-result-idx={globalIdx}
                      onClick={() => {
                        commitSearch(query);
                        router.push(`/post/${encodeURIComponent(r.id)}`);
                        onClose();
                      }}
                      onMouseEnter={() => setSelectedIndex(globalIdx)}
                      className={`flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors ${
                        selectedIndex === globalIdx
                          ? 'bg-degen-500/10'
                          : 'hover:bg-[var(--color-overlay)]'
                      }`}
                    >
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold overflow-hidden"
                        style={{
                          backgroundColor: `${getProtocolColor(r.protocol)}22`,
                          color: getProtocolColor(r.protocol),
                        }}
                      >
                        {r.author.avatarUrl ? (
                          <Image
                            src={r.author.avatarUrl}
                            alt=""
                            width={32}
                            height={32}
                            className="h-8 w-8 rounded-full object-cover"
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
                          <ProtocolBadge protocol={r.protocol} />
                          <span className="ml-auto text-[var(--color-muted)] shrink-0">
                            {formatTime(r.createdAt)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-sm text-[var(--color-muted)] line-clamp-2 leading-normal">
                          {r.text}
                        </p>
                        <div className="mt-1 flex items-center gap-3 text-[10px] text-[var(--color-muted)]">
                          <span className="flex items-center gap-1">
                            <span>♥</span> <span>{r.metrics.likes}</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <span>↻</span> <span>{r.metrics.reposts}</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <span>✎</span> <span>{r.metrics.replies}</span>
                          </span>
                        </div>
                      </div>
                      {r.image && (
                        <Image
                          src={r.image}
                          alt=""
                          width={48}
                          height={48}
                          className="h-12 w-12 shrink-0 rounded-lg object-cover"
                          loading="lazy"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* ── Communities Section ── */}
            {communities.length > 0 && (
              <div>
                <div className="sticky top-0 z-10 bg-[var(--color-card)]/95 backdrop-blur-sm px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-muted)] border-b border-[var(--color-border)]">
                  Communities
                </div>
                {communities.map((community) => {
                  const globalIdx = flatItems.findIndex(
                    (fi) => fi.type === 'community' && (fi.data as CommunityResult).id === community.id,
                  );
                  return (
                    <button
                      key={community.id}
                      type="button"
                      data-result-idx={globalIdx}
                      onClick={() => {
                        commitSearch(query);
                        window.open(community.url, '_blank', 'noopener,noreferrer');
                        onClose();
                      }}
                      onMouseEnter={() => setSelectedIndex(globalIdx)}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        selectedIndex === globalIdx
                          ? 'bg-degen-500/10'
                          : 'hover:bg-[var(--color-overlay)]'
                      }`}
                    >
                      <ResultAvatar
                        url={community.icon}
                        fallback={community.name}
                        protocol={community.protocol}
                        rounded="xl"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-[var(--color-fg)]">
                            {community.name}
                          </span>
                          <ProtocolBadge protocol={community.protocol} />
                        </div>
                        {community.description && (
                          <div className="text-xs text-[var(--color-muted)] line-clamp-1 mt-0.5">
                            {community.description}
                          </div>
                        )}
                        {community.memberCount > 0 && (
                          <div className="text-[10px] text-[var(--color-muted)] mt-0.5">
                            {formatCount(community.memberCount)} members
                          </div>
                        )}
                      </div>
                      <span className="shrink-0 rounded-lg border border-[var(--color-border)] px-2.5 py-1 text-[10px] text-[var(--color-muted)]">
                        Join
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* ── Videos Section ── */}
            {videos.length > 0 && (
              <div>
                <div className="sticky top-0 z-10 bg-[var(--color-card)]/95 backdrop-blur-sm px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-muted)] border-b border-[var(--color-border)]">
                  Videos
                </div>
                {videos.map((video) => {
                  const globalIdx = flatItems.findIndex(
                    (fi) => fi.type === 'video' && (fi.data as VideoResult).id === video.id,
                  );
                  return (
                    <button
                      key={video.id}
                      type="button"
                      data-result-idx={globalIdx}
                      onClick={() => {
                        commitSearch(query);
                        window.open(video.url, '_blank', 'noopener,noreferrer');
                        onClose();
                      }}
                      onMouseEnter={() => setSelectedIndex(globalIdx)}
                      className={`flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors ${
                        selectedIndex === globalIdx
                          ? 'bg-degen-500/10'
                          : 'hover:bg-[var(--color-overlay)]'
                      }`}
                    >
                      <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-[var(--color-overlay)]">
                        {video.thumbnailUrl ? (
                          <Image
                            src={video.thumbnailUrl}
                            alt=""
                            width={96}
                            height={56}
                            className="h-14 w-24 object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-lg text-[var(--color-muted)]">
                            ▶
                          </div>
                        )}
                        {video.durationSeconds > 0 && (
                          <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[9px] text-white leading-normal">
                            {formatDuration(video.durationSeconds)}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-[var(--color-fg)]">
                            {video.title}
                          </span>
                          <span className="shrink-0 rounded-full bg-orange-500/20 px-1.5 py-0.5 text-[9px] font-medium text-orange-400">
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
                    </button>
                  );
                })}
              </div>
            )}

            {/* ── Footer: "View all results" link to search page ── */}
            {query.length >= 2 && (
              <a
                href={`/search?q=${encodeURIComponent(query)}${protocolFilter ? `&protocols=${protocolFilter}` : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  commitSearch(query);
                  router.push(
                    `/search?q=${encodeURIComponent(query)}${protocolFilter ? `&protocols=${protocolFilter}` : ''}`,
                  );
                  onClose();
                }}
                className="sticky bottom-0 z-10 flex items-center justify-center gap-2 bg-[var(--color-card)]/95 backdrop-blur-sm px-4 py-3 text-xs font-medium text-degen-400 hover:bg-[var(--color-overlay)] transition-colors border-t border-[var(--color-border)]"
              >
                View all results
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M5 12h14" />
                  <path d="M12 5l7 7-7 7" />
                </svg>
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
