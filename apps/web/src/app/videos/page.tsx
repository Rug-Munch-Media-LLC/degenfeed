'use client';

/**
 * @degenfeed/web — /videos
 *
 * Full YouTube + PeerTube integration with tabs, category filters, sort,
 * and infinite-scroll grid. Sources both from the @degenfeed/youtube-provider
 * (YouTube RSS feeds) and the PeerTube API (from video.degenfeed.xyz).
 *
 * Aesthetic direction: dark cyberpunk with neon-green accents. The grid uses
 * a 3-column bento layout (desktop) with staggered card reveals on load.
 */

import {
  ErrorBoundary,
  MixedVideoGrid,
  type VideoCategory,
  VideoFilterBar,
  type VideoSort,
  type VideoTab,
  type YouTubeVideoCardItem,
} from '@degenfeed/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// ─── Constants ──────────────────────────────────────────────────────────

const PEERTUBE_INSTANCE = 'video.degenfeed.xyz';
const YOUTUBE_FEED_LIMIT = 30;
const PEERTUBE_API_LIMIT = 20;
const FEDERATED_INSTANCE_COUNT = 15; // From @degenfeed/peertube-provider/federated — kept in sync manually

// ─── PeerTube API types ────────────────────────────────────────────────

interface PeerTubeApiVideo {
  uuid: string;
  name: string;
  thumbnailPath: string;
  channel: {
    displayName: string;
    name: string;
  };
  publishedAt: string;
  views: number;
  duration?: number;
  category?: number;
  description?: string;
}

interface PeerTubeApiResponse {
  data: PeerTubeApiVideo[];
  total: number;
  next?: string;
}

// ─── Category mapping ───────────────────────────────────────────────────

function detectCategory(title: string, description?: string): string {
  const text = `${title} ${description ?? ''}`.toLowerCase();
  if (
    text.includes('bitcoin') ||
    text.includes('btc') ||
    text.includes('crypto') ||
    text.includes('ethereum') ||
    text.includes('eth') ||
    text.includes('blockchain')
  )
    return 'crypto';
  if (
    text.includes('defi') ||
    text.includes('liquidity') ||
    text.includes('yield') ||
    text.includes('staking') ||
    text.includes('lending') ||
    text.includes('swap')
  )
    return 'defi';
  if (
    text.includes('nft') ||
    text.includes('nfts') ||
    text.includes('collectible') ||
    text.includes('mint')
  )
    return 'nft';
  if (
    text.includes('tutorial') ||
    text.includes('guide') ||
    text.includes('how to') ||
    text.includes('learn') ||
    text.includes('explained') ||
    text.includes('beginner')
  )
    return 'tutorial';
  if (
    text.includes('news') ||
    text.includes('update') ||
    text.includes('latest') ||
    text.includes('breaking') ||
    text.includes('report')
  )
    return 'news';
  if (
    text.includes('podcast') ||
    text.includes('interview') ||
    text.includes('vlog') ||
    text.includes('music') ||
    text.includes('entertainment')
  )
    return 'entertainment';
  return 'crypto';
}

function peerTubeCategoryToId(category: number): string {
  // PeerTube category IDs: 1=Music, 2=Films, 3=Comics, 4=Books, 5=Tech, etc.
  // Map to our categories
  const map: Record<number, string> = {
    1: 'entertainment',
    2: 'entertainment',
    5: 'tutorial',
    8: 'news',
    10: 'crypto',
    11: 'defi',
    12: 'nft',
    13: 'entertainment',
  };
  return map[category] ?? 'crypto';
}

// ─── Time duration formatting ───────────────────────────────────────────

function formatDuration(seconds?: number): string {
  if (seconds == null || seconds <= 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  if (m > 0) return `${m}:${String(s).padStart(2, '0')}`;
  return `0:${String(s).padStart(2, '0')}`;
}

// ─── Fetch Federated PeerTube feed ───────────────────────────────────────
// Searches across multiple PeerTube instances for crypto/tech content.

interface FederatedVideoItem {
  id: string;
  title: string;
  url: string;
  instanceUrl: string;
  instanceName: string;
  channelName: string;
  channelUrl: string | null;
  thumbnailUrl: string | null;
  publishedAt: string;
  publishedMs: number;
  views: number;
  likes: number;
  duration: number;
  description: string;
  tags: string[];
  source: string;
}

async function fetchFederatedFeed(
  sort: string = 'trending',
  limit: number = 30,
  signal?: AbortSignal,
): Promise<YouTubeVideoCardItem[]> {
  try {
    const { getFederatedFeed } = await import('@degenfeed/peertube-provider/federated');
    const result = await getFederatedFeed({ sort, limit });
    return result.items.map((v) => ({
      id: `federated-${v.id}`,
      title: v.title,
      channelName: `${v.channelName} (@${v.source})`,
      channelUrl: v.channelUrl ?? v.instanceUrl,
      thumbnailUrl: v.thumbnailUrl ?? `https://${v.source}/static/thumbnails/${v.id}.jpg`,
      url: v.url,
      publishedAt: v.publishedAt,
      publishedMs: v.publishedMs,
      duration: formatDuration(v.duration),
      views: v.views,
      description: v.description,
      category: detectCategory(v.title, v.description),
      source: 'federated' as const,
    }));
  } catch (err) {
    console.warn('[videos] Federated provider not available', err);
    return [];
  }
}

// ─── Fetch YouTube feed (RSS-based) ─────────────────────────────────────

async function fetchYouTubeFeed(
  category?: string,
  limit = YOUTUBE_FEED_LIMIT,
  signal?: AbortSignal,
): Promise<YouTubeVideoCardItem[]> {
  try {
    // Dynamic import to avoid bundling issues if package isn't installed
    const { fetchYouTubeFeed: fetchYT } = await import('@degenfeed/youtube-provider');
    const items = await fetchYT({
      category: category === 'all' ? undefined : category,
      limit,
      signal,
      sort: 'recent',
    });
    return items.map((item) => ({
      ...item,
      source: 'youtube' as const,
    }));
  } catch (err) {
    console.warn('[videos] YouTube provider not available, falling back to RSS proxy', err);
    return fetchYouTubeFeedFallback(category, limit, signal);
  }
}

/**
 * Fallback: proxy YouTube RSS through a Cloudflare worker or direct fetch.
 */
async function fetchYouTubeFeedFallback(
  _category?: string,
  _limit = 20,
  signal?: AbortSignal,
): Promise<YouTubeVideoCardItem[]> {
  try {
    const response = await fetch('/api/feed/videos?source=youtube&limit=20', {
      signal,
      credentials: 'include',
    });
    if (!response.ok) return [];
    const data = (await response.json()) as { data?: YouTubeVideoCardItem[] };
    return data.data ?? [];
  } catch {
    return [];
  }
}

// ─── Fetch PeerTube feed ────────────────────────────────────────────────

async function fetchPeerTubeFeed(
  category?: string,
  limit = PEERTUBE_API_LIMIT,
  page = 1,
  signal?: AbortSignal,
): Promise<{ items: YouTubeVideoCardItem[]; total: number }> {
  try {
    const params = new URLSearchParams({
      start: String((page - 1) * limit),
      count: String(limit),
      sort: '-publishedAt',
    });

    if (category && category !== 'all') {
      // PeerTube category ID for crypto topic
      params.set('categoryOneOf', '10');
    }

    const url = `https://${PEERTUBE_INSTANCE}/api/v1/videos?${params.toString()}`;
    const response = await fetch(url, {
      signal,
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) return { items: [], total: 0 };

    const data = (await response.json()) as PeerTubeApiResponse;

    const items: YouTubeVideoCardItem[] = (data.data ?? []).map((v) => ({
      id: v.uuid,
      title: v.name,
      channelName: v.channel.displayName,
      channelUrl: `https://${PEERTUBE_INSTANCE}/c/${v.channel.name}`,
      thumbnailUrl: v.thumbnailPath
        ? `https://${PEERTUBE_INSTANCE}${v.thumbnailPath}`
        : `https://${PEERTUBE_INSTANCE}/static/thumbnails/${v.uuid}.jpg`,
      url: `https://${PEERTUBE_INSTANCE}/w/${v.uuid}`,
      publishedAt: v.publishedAt,
      publishedMs: new Date(v.publishedAt).getTime(),
      duration: formatDuration(v.duration),
      views: v.views,
      description: v.description,
      category: v.category
        ? peerTubeCategoryToId(v.category)
        : detectCategory(v.name, v.description),
      source: 'peertube' as const,
    }));

    return { items, total: data.total };
  } catch {
    return { items: [], total: 0 };
  }
}

// ─── Page Components ────────────────────────────────────────────────────

export default function VideosPage() {
  // ── State ──
  const [videos, setVideos] = useState<YouTubeVideoCardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  // Filters
  const [activeTab, setActiveTab] = useState<VideoTab>('all');
  const [activeCategory, setActiveCategory] = useState<VideoCategory>('all');
  const [sort, setSort] = useState<VideoSort>('recent');

  // Pagination
  const [_youtubePage, setYoutubePage] = useState(1);
  const [peertubePage, setPeertubePage] = useState(1);
  const [youtubeExhausted, setYoutubeExhausted] = useState(false);
  const [peertubeExhausted, setPeertubeExhausted] = useState(false);

  // Federated tab — no pagination (cached server-side, single fetch)
  const [federatedLoading, setFederatedLoading] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const loadingRef = useRef(false);

  // ── Load data ──
  const loadVideos = useCallback(
    async (append = false) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      setLoading(true);
      setError(null);

      // Abort previous request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        // ── Federated tab: single fetch, no pagination ──────────────
        if (activeTab === 'federated') {
          setFederatedLoading(true);
          const sortParam = sort === 'trending' ? 'trending' : sort === 'recent' ? 'recent' : 'trending';
          const federatedItems = await fetchFederatedFeed(sortParam, 50, controller.signal);
          if (controller.signal.aborted) return;
          setVideos(federatedItems);
          setHasMore(false);
          return;
        }

        const category = activeCategory === 'all' ? undefined : activeCategory;
        const currentPT = append ? peertubePage : 1;

        // Fetch YouTube + local PeerTube in parallel
        const [ytItems, ptResult] = await Promise.all([
          !youtubeExhausted || !append
            ? fetchYouTubeFeed(category, YOUTUBE_FEED_LIMIT, controller.signal)
            : Promise.resolve<YouTubeVideoCardItem[]>([]),
          !peertubeExhausted || !append
            ? fetchPeerTubeFeed(category, PEERTUBE_API_LIMIT, currentPT, controller.signal)
            : Promise.resolve<{ items: YouTubeVideoCardItem[]; total: number }>({
                items: [],
                total: 0,
              }),
        ]);

        if (controller.signal.aborted) return;

        // Interleave YouTube + PeerTube for mixed view
        let combined: YouTubeVideoCardItem[];

        if (append) {
          // Append to existing list
          const existing = new Set(videos.map((v) => `${v.source}-${v.id}`));
          const newItems = [
            ...ytItems.filter((i) => !existing.has(`${i.source}-${i.id}`)),
            ...ptResult.items.filter((i) => !existing.has(`${i.source}-${i.id}`)),
          ];
          combined = [...videos, ...newItems];
          setYoutubePage((p) => p + (ytItems.length > 0 ? 1 : 0));
          setPeertubePage((p) => p + (ptResult.items.length > 0 ? 1 : 0));
        } else {
          // Fresh load — interleave
          const maxLen = Math.max(ytItems.length, ptResult.items.length);
          const interleaved: YouTubeVideoCardItem[] = [];
          for (let i = 0; i < maxLen; i++) {
            const ytItem = ytItems[i];
            const ptItem = ptResult.items[i];
            if (ytItem) interleaved.push(ytItem);
            if (ptItem) interleaved.push(ptItem);
          }
          combined = interleaved;
        }

        setVideos(combined);
        setHasMore(
          ytItems.length >= YOUTUBE_FEED_LIMIT || ptResult.items.length >= PEERTUBE_API_LIMIT,
        );

        if (ytItems.length < YOUTUBE_FEED_LIMIT) setYoutubeExhausted(true);
        if (ptResult.items.length < PEERTUBE_API_LIMIT) setPeertubeExhausted(true);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError('Failed to load videos. Please try again.');
        console.warn('[videos] Load error:', err);
      } finally {
        setLoading(false);
        setInitialLoad(false);
        loadingRef.current = false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps — youtubePage unused after removing currentYT
    [activeCategory, peertubePage, youtubeExhausted, peertubeExhausted, videos],
  );

  // ── Load on mount & filter change ──
  useEffect(() => {
    setYoutubePage(1);
    setPeertubePage(1);
    setYoutubeExhausted(false);
    setPeertubeExhausted(false);
    setVideos([]);
    setHasMore(true);
    loadVideos(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps — loadVideos intentionally omitted to prevent infinite loop on state reset
  }, [activeTab, activeCategory]);

  // ── Load more handler ──
  const handleLoadMore = useCallback(() => {
    if (!loading && hasMore) {
      loadVideos(true);
    }
  }, [loading, hasMore, loadVideos]);

  // ── Sort handler (client-side reorder) ──
  const sortedVideos = useMemo(() => {
    const sorted = [...videos];
    if (sort === 'recent') {
      sorted.sort((a, b) => b.publishedMs - a.publishedMs);
    } else if (sort === 'popular') {
      sorted.sort((a, b) => (b.views ?? 0) - (a.views ?? 0));
    } else if (sort === 'trending') {
      sorted.sort((a, b) => {
        const scoreA = (a.views ?? 0) / Math.max(1, (Date.now() - a.publishedMs) / 3600000);
        const scoreB = (b.views ?? 0) / Math.max(1, (Date.now() - b.publishedMs) / 3600000);
        return scoreB - scoreA;
      });
    }
    return sorted;
  }, [videos, sort]);

  // ── Play handler ──
  const handlePlay = useCallback((video: YouTubeVideoCardItem) => {
    window.open(video.url, '_blank', 'noopener noreferrer');
  }, []);

  // ── Refresh handler ──
  const handleRefresh = useCallback(() => {
    setYoutubePage(1);
    setPeertubePage(1);
    setYoutubeExhausted(false);
    setPeertubeExhausted(false);
    setFederatedLoading(false);
    setVideos([]);
    setHasMore(true);
    loadVideos(false);
  }, [loadVideos]);

  return (
    <ErrorBoundary>
      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* ── Header ── */}
        <header className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-xs tracking-widest text-degen-400 uppercase">
                Video Feed
              </p>
              <h1 className="text-3xl font-bold text-[var(--color-fg)] tracking-tight">Videos</h1>
              <p className="mt-1 text-sm text-[var(--color-muted)] max-w-lg">
                YouTube crypto channels, PeerTube federated video, and more — all in one feed.
              </p>
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading}
              className="rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-card)] px-3 py-2 text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:border-degen-500/30 transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-degen-500/40"
              aria-label="Refresh videos"
            >
              {loading ? (
                <span className="flex items-center gap-1.5">
                  <div className="h-3 w-3 rounded-full border-2 border-degen-500/30 border-t-degen-500 animate-spin" />
                  Loading
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M1 4V10H7"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M3.51 15a9 9 0 102.13-9.36L1 10"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Refresh
                </span>
              )}
            </button>
          </div>
        </header>

        {/* ── Filter Bar ── */}
        <VideoFilterBar
          activeTab={activeTab}
          activeCategory={activeCategory}
          sort={sort}
          onTabChange={setActiveTab}
          onCategoryChange={setActiveCategory}
          onSortChange={setSort}
        />

        {/* ── Stats Line ── */}
        {!initialLoad && !loading && videos.length > 0 && (
          <p className="mb-3 text-xs text-[var(--color-muted)]">
            <span className="tabular-nums">{videos.length}</span> videos loaded
            {activeCategory !== 'all' && (
              <>
                {' '}
                in <span className="font-medium text-degen-400">{activeCategory}</span>
              </>
            )}
          </p>
        )}

        {/* ── Video Grid ── */}
        <MixedVideoGrid
          videos={sortedVideos}
          activeTab={activeTab}
          activeCategory={activeCategory}
          sort={sort}
          onPlay={handlePlay}
          onLoadMore={handleLoadMore}
          loading={loading}
          hasMore={hasMore}
          error={error}
        />

        {/* ── Footer note ── */}
        {!loading && videos.length > 0 && (
          <footer className="mt-8 text-center">
            <p className="text-[11px] text-[var(--color-muted)]">
              Videos sourced from YouTube RSS feeds,
              {' '}<a
                href={`https://${PEERTUBE_INSTANCE}`}
                target="_blank" rel="noopener noreferrer"
                rel="noopener noreferrer"
                className="text-degen-500 hover:text-degen-400 transition-colors underline underline-offset-2"
              >
                {PEERTUBE_INSTANCE}
              </a>,{' '}
              and{' '}
              <a
                href="https://sepiasearch.org"
                target="_blank" rel="noopener noreferrer"
                rel="noopener noreferrer"
                className="text-degen-500 hover:text-degen-400 transition-colors underline underline-offset-2"
              >
                {FEDERATED_INSTANCE_COUNT} federated instances
              </a>
              {' '}— cached for 15 minutes
            </p>
          </footer>
        )}
      </div>
    </ErrorBoundary>
  );
}
