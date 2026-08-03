'use client';

/**
 * useVineFeed — Hook for fetching Vine-style short video feed.
 *
 * Provides:
 *   - Infinite scroll with queue pre-loading
 *   - Vine-specific types with vibe scores
 *   - Category filtering
 *   - Revine tracking
 *   - Queue management
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { VineCategory } from './vineConstants';

// ─── Types ────────────────────────────────────────────────────────────────

export interface VibeScores {
  total: number;
  humor: number;
  creativity: number;
  originality: number;
  replayValue: number;
  productionQuality: number;
  engagementVelocity: number;
  viralPotential: number;
}

export interface VineShortItem {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  videoUrl: string;
  duration: number;
  loopDuration: number;
  creatorName: string;
  creatorAvatar?: string;
  creatorHandle?: string;
  creatorAddress?: string;
  views: number;
  likes: number;
  source: string;
  sourceLabel: string;
  sourceColor: string;
  tags: string[];
  vineCategory: VineCategory[];
  vibeScore: VibeScores;
  revineCount: number;
  hasRevined: boolean;
  isFeatured: boolean;
  originalSound?: {
    name: string;
    handle: string;
    avatar?: string;
  };
  challenge?: {
    id: string;
    name: string;
    prize: string;
  };
  crossPlatformLinks?: Array<{ platform: string; url: string; label: string }>;
  canTip: boolean;
  publishedAt: number;
  vertical: boolean;
}

export interface VineFeedResponse {
  shorts: VineShortItem[];
  categories: VineCategory[];
  vibeRange: { min: number; max: number; avg: number };
  featured?: VineShortItem;
  hasMore: boolean;
  cursor: string | null;
  aggregatedAt: number;
}

export interface VineQueueResponse {
  shorts: VineShortItem[];
  queuedAt: number;
  expiresAt: number;
  size: number;
}

export interface UseVineFeedOptions {
  endpoint?: string;
  category?: VineCategory;
  limit?: number;
  minVibe?: number;
  enableQueue?: boolean;
}

export interface UseVineFeedResult {
  /** Current feed shorts */
  shorts: VineShortItem[];
  /** Loading state */
  loading: boolean;
  /** Error message */
  error: string | null;
  /** Whether more content is available */
  hasMore: boolean;
  /** Active categories in current feed */
  activeCategories: VineCategory[];
  /** Vibe range stats */
  vibeRange: { min: number; max: number; avg: number };
  /** Currently featured short */
  featured?: VineShortItem;
  /** Load next page */
  loadMore: () => void;
  /** Refresh from start */
  refresh: () => void;
  /** Revine a short */
  revine: (shortId: string) => Promise<boolean>;
  /** Record a watch event */
  recordWatch: (shortId: string, watchPercent: number, liked?: boolean) => Promise<void>;
  /** Provide feedback (not interested / see more like this) */
  feedback: (shortId: string, action: 'like' | 'not_interested') => Promise<void>;
}

// ─── Constants ────────────────────────────────────────────────────────────

const INITIAL_LIMIT = 20;
const LOAD_MORE_LIMIT = 10;

// ─── Hook ─────────────────────────────────────────────────────────────────

export function useVineFeed(opts: UseVineFeedOptions = {}): UseVineFeedResult {
  const {
    endpoint = '/api/shorts/vine',
    category,
    limit = INITIAL_LIMIT,
    minVibe = 0,
    enableQueue = true,
  } = opts;

  const [feedState, setFeedState] = useState<{
    shorts: VineShortItem[];
    loading: boolean;
    error: string | null;
    hasMore: boolean;
    activeCategories: VineCategory[];
    vibeRange: { min: number; max: number; avg: number };
    featured?: VineShortItem;
  }>({
    shorts: [],
    loading: true,
    error: null,
    hasMore: true,
    activeCategories: [],
    vibeRange: { min: 0, max: 0, avg: 0 },
  });

  const cursorRef = useRef<string | null>(null);
  const loadingRef = useRef(false);
  const queueRef = useRef<VineShortItem[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  // ── Fetch vine feed ──────────────────────────────────────────────────

  const fetchFeed = useCallback(
    async (append = false) => {
      if (loadingRef.current) return;
      loadingRef.current = true;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setFeedState((s) => ({
        ...s,
        ...(append ? {} : { loading: true, error: null }),
      }));

      try {
        const params = new URLSearchParams({
          limit: String(append ? LOAD_MORE_LIMIT : limit),
        });
        if (append && cursorRef.current) params.set('cursor', cursorRef.current);
        if (category) params.set('category', category);
        if (minVibe > 0) params.set('min_vibe', String(minVibe));

        const res = await fetch(`${endpoint}?${params.toString()}`, {
          credentials: 'include',
          signal: controller.signal,
          cache: 'no-store',
          headers: { 'cache-control': 'no-store' },
        });

        if (!res.ok) throw new Error(`Vine feed returned ${res.status}`);
        const data = (await res.json()) as VineFeedResponse;

        setFeedState((prev) => ({
          shorts: append ? [...prev.shorts, ...data.shorts] : data.shorts,
          loading: false,
          error: null,
          hasMore: data.hasMore,
          activeCategories: data.categories,
          vibeRange: data.vibeRange,
          featured: data.featured ?? prev.featured,
        }));

        cursorRef.current = data.cursor;
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setFeedState((prev) => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to load vine feed',
        }));
      } finally {
        loadingRef.current = false;
      }
    },
    [endpoint, category, limit, minVibe],
  );

  // ── Load queue ───────────────────────────────────────────────────────

  const loadQueue = useCallback(async () => {
    try {
      const res = await fetch('/api/shorts/queue', {
        credentials: 'include',
        cache: 'no-store',
      });
      if (res.ok) {
        const data = (await res.json()) as VineQueueResponse;
        queueRef.current = data.shorts;
      }
    } catch {
      // Queue is additive — non-critical
    }
  }, []);

  // ── Load more (from queue first, then API) ────────────────────────────

  const loadMore = useCallback(() => {
    if (feedState.loading || loadingRef.current || !feedState.hasMore) return;

    // Check queue first
    if (queueRef.current.length >= LOAD_MORE_LIMIT) {
      const nextBatch = queueRef.current.splice(0, LOAD_MORE_LIMIT);
      setFeedState((prev) => ({
        ...prev,
        shorts: [...prev.shorts, ...nextBatch],
      }));
      return;
    }

    void fetchFeed(true);
  }, [feedState.loading, feedState.hasMore, fetchFeed]);

  // ── Refresh ──────────────────────────────────────────────────────────

  const refresh = useCallback(() => {
    cursorRef.current = null;
    queueRef.current = [];
    void fetchFeed(false);
    if (enableQueue) void loadQueue();
  }, [fetchFeed, loadQueue, enableQueue]);

  // ── Revine ───────────────────────────────────────────────────────────

  const revine = useCallback(async (shortId: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/shorts/revine', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ shortId, platforms: ['degenfeed', 'farcaster', 'nostr'] }),
      });

      if (!res.ok) return false;

      // Optimistically update revine count
      setFeedState((prev) => ({
        ...prev,
        shorts: prev.shorts.map((s) =>
          s.id === shortId ? { ...s, revineCount: s.revineCount + 1, hasRevined: true } : s,
        ),
      }));

      return true;
    } catch {
      return false;
    }
  }, []);

  // ── Record watch ─────────────────────────────────────────────────────

  const recordWatch = useCallback(async (shortId: string, watchPercent: number, liked = false) => {
    try {
      await fetch('/api/shorts/vine/watch', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          shortId,
          watchPercent,
          liked,
          watchedFull: watchPercent >= 0.9,
          skipped: watchPercent < 0.3,
          watchDurationMs: Math.round(watchPercent * 6000),
        }),
      });
    } catch {
      // Non-critical
    }
  }, []);

  // ── Feedback ─────────────────────────────────────────────────────────

  const feedback = useCallback(async (shortId: string, action: 'like' | 'not_interested') => {
    try {
      await fetch('/api/shorts/feedback', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ shortId, action }),
      });

      // If "not interested", remove from feed
      if (action === 'not_interested') {
        setFeedState((prev) => ({
          ...prev,
          shorts: prev.shorts.filter((s) => s.id !== shortId),
        }));
      }
    } catch {
      // Non-critical
    }
  }, []);

  // ── Initial load ─────────────────────────────────────────────────────

  useEffect(() => {
    void fetchFeed(false);
    if (enableQueue) void loadQueue();
    return () => abortRef.current?.abort();
  }, [fetchFeed, loadQueue, enableQueue]);

  // ── Return ───────────────────────────────────────────────────────────

  return {
    shorts: feedState.shorts,
    loading: feedState.loading,
    error: feedState.error,
    hasMore: feedState.hasMore,
    activeCategories: feedState.activeCategories,
    vibeRange: feedState.vibeRange,
    featured: feedState.featured,
    loadMore,
    refresh,
    revine,
    recordWatch,
    feedback,
  };
}
