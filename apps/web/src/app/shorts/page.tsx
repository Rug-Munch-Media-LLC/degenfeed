'use client';

/**
 * @pages/shorts — Full-screen TikTok-style vertical video feed.
 *
 * Uses the enhanced ShortsPlayer component with ShortsAggregatorV2
 * and the ShortsAlgorithm recommendation engine.
 *
 * Features:
 *   - Vertical swipe (touch + mouse wheel)
 *   - Category filter bar
 *   - Auto-play with mute toggle
 *   - Like, Comment, Share, Tip actions
 *   - Watch event tracking for algorithm learning
 *   - Source badge on every short
 *   - Loading skeleton, empty state, end-of-feed state
 *   - Infinite scroll with cursor-based pagination
 *
 * Design: Immersive dark cyberpunk with neon-green degen accents.
 */

import { ErrorBoundary } from '@degenfeed/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { type ShortItem, ShortsPlayer } from '../../components/shorts/ShortsPlayer';

// ─── API Types ──────────────────────────────────────────────────────────

interface V2FeedResponse {
  shorts: ShortItem[];
  sources: Record<string, number>;
  sourceHealth: Array<{
    source: string;
    healthy: boolean;
    lastFetch: number;
    error?: string;
    videosCount: number;
  }>;
  phase: string;
  scores: Record<string, number>;
  hasMore: boolean;
  cursor: string | null;
  aggregatedAt: number;
}

// ─── Hook: useShortsV2Feed ──────────────────────────────────────────────

function useShortsV2Feed() {
  const [shorts, setShorts] = useState<ShortItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [phase, setPhase] = useState<string>('cold_start');
  const [category, setCategory] = useState<string | undefined>();
  const [sources, setSources] = useState<Record<string, number>>({});
  const cursorRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());

  const fetchShorts = useCallback(
    async (append = false) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      if (append) setIsLoadingMore(true);
      else setIsLoading(true);

      try {
        const params = new URLSearchParams({
          limit: String(append ? 10 : 20),
        });
        if (append && cursorRef.current) params.set('cursor', cursorRef.current);
        if (category) params.set('category', category);

        // Pass seen IDs to server
        if (seenIdsRef.current.size > 0) {
          params.set('seen', Array.from(seenIdsRef.current).slice(-200).join(','));
        }

        const res = await fetch(`/api/shorts/v2/feed?${params.toString()}`, {
          credentials: 'include',
          signal: controller.signal,
          headers: { 'cache-control': 'no-store' },
        });

        if (!res.ok) throw new Error(`Shorts feed returned ${res.status}`);
        const data = (await res.json()) as V2FeedResponse;

        const fetched = data.shorts ?? [];
        cursorRef.current = data.cursor;

        // Track seen IDs
        for (const s of fetched) {
          seenIdsRef.current.add(s.id);
        }

        setShorts((prev) => (append ? [...prev, ...fetched] : fetched));
        setHasMore(data.hasMore);
        setPhase(data.phase);
        setSources(data.sources);
        setError(null);
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Failed to load shorts');
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [category],
  );

  const loadMore = useCallback(() => {
    if (isLoadingMore || !hasMore) return;
    void fetchShorts(true);
  }, [isLoadingMore, hasMore, fetchShorts]);

  const refresh = useCallback(() => {
    cursorRef.current = null;
    seenIdsRef.current = new Set();
    void fetchShorts(false);
  }, [fetchShorts]);

  const changeCategory = useCallback((newCategory: string | undefined) => {
    setCategory(newCategory);
    cursorRef.current = null;
    seenIdsRef.current = new Set();
    // Will re-fetch on next render via useEffect
  }, []);

  useEffect(() => {
    void fetchShorts(false);
    return () => abortRef.current?.abort();
  }, [category]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    shorts,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    phase,
    category,
    sources,
    loadMore,
    refresh,
    changeCategory,
    setCategory,
  };
}

// ─── Page Component ─────────────────────────────────────────────────────

export default function ShortsPage() {
  const {
    shorts,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    phase,
    category,
    loadMore,
    refresh,
    changeCategory,
  } = useShortsV2Feed();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCategories, setShowCategories] = useState(true);

  // ── Categories ──────────────────────────────────────────────────────

  const categories = [
    { id: 'all', label: 'All' },
    { id: 'crypto', label: 'Crypto' },
    { id: 'defi', label: 'DeFi' },
    { id: 'trading', label: 'Trading' },
    { id: 'nft', label: 'NFT' },
    { id: 'music', label: 'Music' },
    { id: 'gaming', label: 'Gaming' },
    { id: 'tech', label: 'Tech' },
    { id: 'comedy', label: 'Comedy' },
    { id: 'education', label: 'Education' },
    { id: 'streaming', label: 'Streaming' },
  ];

  // ── Watch Event Tracking ────────────────────────────────────────────

  const trackWatchEvent = useCallback(
    async (event: {
      shortId: string;
      watchPercent: number;
      liked: boolean;
      shared: boolean;
      watchedFull: boolean;
      skipped: boolean;
      watchDurationMs: number;
    }) => {
      try {
        await fetch('/api/shorts/watch', {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(event),
        });
      } catch {
        // Fail silently — watch tracking is non-critical
      }
    },
    [],
  );

  // ── Callbacks ───────────────────────────────────────────────────────

  const handleLike = useCallback(async (shortId: string) => {
    try {
      await fetch('/api/shorts/feedback', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ shortId, action: 'like' }),
      });
    } catch {
      /* non-critical */
    }
  }, []);

  const handleShare = useCallback(async (shortId: string) => {
    try {
      const shareData = {
        title: 'Check this out on DegenFeed!',
        url: `${window.location.origin}/shorts/${shortId}`,
      };
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareData.url);
      }
    } catch {
      /* user cancelled */
    }
  }, []);

  const handleTip = useCallback((_shortId: string) => {
    // Tip modal is handled by the existing TipModal component
    // (imported as dynamic component in ShortVideoCard)
  }, []);

  const handleComment = useCallback((_shortId: string) => {
    // Comment panel — future enhancement
  }, []);

  const handleFollow = useCallback(async (_creatorName: string) => {
    // Follow action — future enhancement
  }, []);

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <ErrorBoundary>
      {/* Algorithm Phase Indicator (dev only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed left-4 top-4 z-50 rounded-full bg-black/60 px-2 py-0.5 text-[9px] text-white/40 backdrop-blur-sm">
          {phase}
        </div>
      )}

      {/* Top Bar */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex flex-col gap-1.5 px-4 pt-3">
        <div className="pointer-events-auto flex items-center justify-between">
          <a
            href="/feed"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/60 px-3 py-1.5 text-xs font-medium text-white/60 backdrop-blur-lg transition-all hover:border-degen-500/30 hover:text-degen-400"
            aria-label="Back to feed"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M15 18l-6-6 6-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="hidden sm:inline">Feed</span>
          </a>

          <div className="flex items-center gap-2">
            <span className="text-[13px] font-bold tracking-wide text-white/70 drop-shadow-lg">
              <span className="text-degen-400">◆</span> Shorts
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Category Toggle */}
            <button
              onClick={() => setShowCategories(!showCategories)}
              className="pointer-events-auto rounded-full border border-white/10 bg-black/40 px-2.5 py-1.5 text-[10px] font-medium text-white/50 backdrop-blur-sm transition-all hover:border-white/20 hover:text-white"
              aria-label="Toggle categories"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M4 6h16M4 12h16M4 18h16"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>

            {/* Upload Button */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="pointer-events-auto rounded-full border border-degen-500/30 bg-degen-500/10 px-3 py-1.5 text-xs font-medium text-degen-400 backdrop-blur-lg transition-all hover:bg-degen-500/20 hover:shadow-[0_0_12px_rgba(0,255,65,0.2)]"
              aria-label="Upload short"
            >
              + Upload
            </button>
          </div>
        </div>

        {/* Category Pills */}
        {showCategories && (
          <div className="pointer-events-auto overflow-x-auto scrollbar-none">
            <div className="flex gap-1.5 pb-1">
              {categories.map((cat) => {
                const isActive = cat.id === 'all' ? !category : category === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => changeCategory(cat.id === 'all' ? undefined : cat.id)}
                    className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-medium transition-all ${
                      isActive
                        ? 'border-degen-500/40 bg-degen-500/15 text-degen-400'
                        : 'border-white/10 bg-black/40 text-white/50 backdrop-blur-sm hover:border-white/20 hover:text-white'
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Main Player */}
      <ShortsPlayer
        shorts={shorts}
        initialIndex={0}
        isLoadingMore={isLoadingMore}
        hasMore={hasMore}
        error={error ?? undefined}
        onLoadMore={loadMore}
        onRetry={refresh}
        onWatchEvent={trackWatchEvent}
        onLike={handleLike}
        onShare={handleShare}
        onTip={handleTip}
        onComment={handleComment}
        onFollow={handleFollow}
      />

      {/* Loading State (no shorts yet) */}
      {isLoading && shorts.length === 0 && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black">
          <div className="flex flex-col items-center gap-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-lg text-degen-400">◆</span>
              <span className="text-sm font-bold tracking-wide text-white/40">Shorts</span>
            </div>
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-degen-500/30 border-t-degen-400" />
            <p className="text-xs text-white/40">Loading shorts...</p>
          </div>
        </div>
      )}
    </ErrorBoundary>
  );
}
