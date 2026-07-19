'use client';

/**
 * @degenfeed/web — /videos
 *
 * Full YouTube + PeerTube integration with tabs, category filters, sort,
 * and infinite-scroll grid. Theater mode, PiP, and quality selector.
 *
 * Aesthetic direction: dark cyberpunk with neon-green accents.
 */

import {
  ErrorBoundary,
  MixedVideoGrid,
  PeerTubeTipOverlay,
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
const FEDERATED_INSTANCE_COUNT = 15;

// ─── PeerTube API types ─────────────────────────────────────────────────

interface PeerTubeApiVideo {
  uuid: string;
  name: string;
  thumbnailPath: string;
  channel: { displayName: string; name: string };
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

// ─── Fetch Federated PeerTube feed ──────────────────────────────────────

async function fetchFederatedFeed(
  sort: string = 'trending',
  limit: number = 30,
  _signal?: AbortSignal,
): Promise<YouTubeVideoCardItem[]> {
  try {
    const { getFederatedFeed } = await import('@degenfeed/peertube-provider');
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

// ─── Fetch YouTube feed ─────────────────────────────────────────────────

async function fetchYouTubeFeed(
  category?: string,
  limit = YOUTUBE_FEED_LIMIT,
  signal?: AbortSignal,
): Promise<YouTubeVideoCardItem[]> {
  try {
    const { fetchYouTubeFeed: fetchYT } = await import('@degenfeed/youtube-provider');
    const items = await fetchYT({
      category: category === 'all' ? undefined : category,
      limit,
      signal,
      sort: 'recent',
    });
    return items.map((item) => ({ ...item, source: 'youtube' as const }));
  } catch (err) {
    console.warn('[videos] YouTube provider not available, falling back to RSS proxy', err);
    return fetchYouTubeFeedFallback(category, limit, signal);
  }
}

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
    if (category && category !== 'all') params.set('categoryOneOf', '10');
    const url = `https://${PEERTUBE_INSTANCE}/api/v1/videos?${params.toString()}`;
    const response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
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
  const [videos, setVideos] = useState<YouTubeVideoCardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [tipVideo, setTipVideo] = useState<YouTubeVideoCardItem | null>(null);
  const [theaterMode, setTheaterMode] = useState(false);
  const [pipSupported, setPipSupported] = useState(true);
  const [qualityMenu, setQualityMenu] = useState(false);
  const [selectedQuality, setSelectedQuality] = useState('Auto');

  // Filters
  const [activeTab, setActiveTab] = useState<VideoTab>('all');
  const [activeCategory, setActiveCategory] = useState<VideoCategory>('all');
  const [sort, setSort] = useState<VideoSort>('recent');

  // Pagination
  const [_youtubePage, setYoutubePage] = useState(1);
  const [peertubePage, setPeertubePage] = useState(1);
  const [youtubeExhausted, setYoutubeExhausted] = useState(false);
  const [peertubeExhausted, setPeertubeExhausted] = useState(false);
  const [_federatedLoading, setFederatedLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const loadingRef = useRef(false);

  // Detect PiP support on mount
  useEffect(() => {
    setPipSupported(!!document.pictureInPictureEnabled);
  }, []);

  // ── Load data ──
  const loadVideos = useCallback(
    async (append = false) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      setLoading(true);
      setError(null);
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        if (activeTab === 'federated') {
          setFederatedLoading(true);
          const sortParam =
            sort === 'trending' ? 'trending' : sort === 'recent' ? 'recent' : 'trending';
          const federatedItems = await fetchFederatedFeed(sortParam, 50, controller.signal);
          if (controller.signal.aborted) return;
          setVideos(federatedItems);
          setHasMore(false);
          return;
        }

        const category = activeCategory === 'all' ? undefined : activeCategory;
        const currentPT = append ? peertubePage : 1;

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

        let combined: YouTubeVideoCardItem[];

        if (append) {
          const existing = new Set(videos.map((v) => `${v.source}-${v.id}`));
          const newItems = [
            ...ytItems.filter((i) => !existing.has(`${i.source}-${i.id}`)),
            ...ptResult.items.filter((i) => !existing.has(`${i.source}-${i.id}`)),
          ];
          combined = [...videos, ...newItems];
          setYoutubePage((p) => p + (ytItems.length > 0 ? 1 : 0));
          setPeertubePage((p) => p + (ptResult.items.length > 0 ? 1 : 0));
        } else {
          const maxLen = Math.max(ytItems.length, ptResult.items.length);
          const interleaved: YouTubeVideoCardItem[] = [];
          for (let i = 0; i < maxLen; i++) {
            if (ytItems[i]) interleaved.push(ytItems[i]);
            if (ptResult.items[i]) interleaved.push(ptResult.items[i]);
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
    [activeCategory, peertubePage, youtubeExhausted, peertubeExhausted, videos, sort, activeTab],
  );

  useEffect(() => {
    setYoutubePage(1);
    setPeertubePage(1);
    setYoutubeExhausted(false);
    setPeertubeExhausted(false);
    setVideos([]);
    setHasMore(true);
    loadVideos(false);
  }, [loadVideos]);

  const handleLoadMore = useCallback(() => {
    if (!loading && hasMore) loadVideos(true);
  }, [loading, hasMore, loadVideos]);

  const sortedVideos = useMemo(() => {
    const sorted = [...videos];
    if (sort === 'recent') sorted.sort((a, b) => b.publishedMs - a.publishedMs);
    else if (sort === 'popular') sorted.sort((a, b) => (b.views ?? 0) - (a.views ?? 0));
    else if (sort === 'trending') {
      sorted.sort((a, b) => {
        const scoreA = (a.views ?? 0) / Math.max(1, (Date.now() - a.publishedMs) / 3600000);
        const scoreB = (b.views ?? 0) / Math.max(1, (Date.now() - b.publishedMs) / 3600000);
        return scoreB - scoreA;
      });
    }
    return sorted;
  }, [videos, sort]);

  const handlePlay = useCallback((video: YouTubeVideoCardItem) => {
    window.open(video.url, '_blank', 'noopener noreferrer');
  }, []);

  const handleTip = useCallback((video: YouTubeVideoCardItem) => {
    if (video.source === 'peertube') setTipVideo(video);
    else {
      window.dispatchEvent(
        new CustomEvent('df-toast', {
          detail: { kind: 'info', message: `Tip ${video.channelName} on YouTube` },
        }),
      );
      window.open(video.channelUrl ?? video.url, '_blank', 'noopener noreferrer');
    }
  }, []);

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

  const toggleTheater = useCallback(() => {
    setTheaterMode((prev) => !prev);
    window.dispatchEvent(
      new CustomEvent('df-toast', {
        detail: { kind: 'info', message: theaterMode ? 'Theater mode off' : 'Theater mode on' },
      }),
    );
  }, [theaterMode]);

  const togglePiP = useCallback(async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        // Find the first video element on the page
        const video = document.querySelector('video');
        if (video) await video.requestPictureInPicture();
      }
    } catch {
      window.dispatchEvent(
        new CustomEvent('df-toast', {
          detail: { kind: 'error', message: 'Picture-in-picture not available' },
        }),
      );
    }
  }, []);

  const qualities = ['Auto', '1080p', '720p', '480p', '360p'];

  return (
    <ErrorBoundary>
      <div
        className={`mx-auto transition-all duration-300 ${theaterMode ? 'max-w-full px-0' : 'max-w-7xl px-4'} py-6`}
      >
        {/* ── Header ── */}
        <header className={`mb-6 ${theaterMode ? 'px-4' : ''}`}>
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

            {/* Player controls row */}
            <div className="hidden items-center gap-2 sm:flex">
              {/* Theater mode */}
              <button
                type="button"
                onClick={toggleTheater}
                className={`rounded-lg border px-3 py-2 text-xs transition-all ${
                  theaterMode
                    ? 'border-degen-500/30 bg-degen-500/10 text-degen-400'
                    : 'border-[var(--color-glass-border)] text-[var(--color-muted)] hover:text-[var(--color-fg)]'
                }`}
                aria-label="Toggle theater mode"
                title={theaterMode ? 'Exit theater mode' : 'Enter theater mode'}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <path d="M8 21h8M12 17v4" />
                </svg>
              </button>

              {/* Picture-in-Picture */}
              {pipSupported && (
                <button
                  type="button"
                  onClick={togglePiP}
                  className="rounded-lg border border-[var(--color-glass-border)] px-3 py-2 text-xs text-[var(--color-muted)] transition-all hover:text-[var(--color-fg)]"
                  aria-label="Toggle picture-in-picture"
                  title="Picture-in-picture"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <rect x="2" y="3" width="20" height="14" rx="2" />
                    <rect
                      x="11"
                      y="9"
                      width="8"
                      height="5"
                      rx="1"
                      fill="currentColor"
                      opacity="0.3"
                    />
                  </svg>
                </button>
              )}

              {/* Quality selector */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setQualityMenu((prev) => !prev)}
                  className="rounded-lg border border-[var(--color-glass-border)] px-3 py-2 text-xs text-[var(--color-muted)] transition-all hover:text-[var(--color-fg)]"
                  aria-label="Select video quality"
                >
                  {selectedQuality}
                </button>
                {qualityMenu && (
                  <div className="absolute right-0 top-full z-50 mt-1 w-24 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-2xl">
                    {qualities.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => {
                          setSelectedQuality(q);
                          setQualityMenu(false);
                        }}
                        className={`w-full px-3 py-2 text-left text-xs transition-colors hover:bg-[var(--color-muted)]/10 ${
                          selectedQuality === q
                            ? 'text-degen-400 bg-degen-500/10'
                            : 'text-[var(--color-muted)]'
                        }`}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Refresh */}
              <button
                type="button"
                onClick={handleRefresh}
                disabled={loading}
                className="rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-card)] px-3 py-2 text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:border-degen-500/30 transition-colors disabled:opacity-50"
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
          </div>
        </header>

        {/* ── Filter Bar ── */}
        <div className={theaterMode ? 'px-4' : ''}>
          <VideoFilterBar
            activeTab={activeTab}
            activeCategory={activeCategory}
            sort={sort}
            onTabChange={setActiveTab}
            onCategoryChange={setActiveCategory}
            onSortChange={setSort}
          />
        </div>

        {/* ── Stats Line ── */}
        {!initialLoad && !loading && videos.length > 0 && (
          <p className={`mb-3 text-xs text-[var(--color-muted)] ${theaterMode ? 'px-4' : ''}`}>
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
          onTip={handleTip}
          onLoadMore={handleLoadMore}
          loading={loading}
          hasMore={hasMore}
          error={error}
        />

        {/* ── Theater mode hint ── */}
        {theaterMode && videos.length > 0 && (
          <div className="mx-auto mt-4 flex max-w-3xl items-center justify-center gap-4 px-4">
            <button
              type="button"
              onClick={() => setTheaterMode(false)}
              className="rounded-lg border border-[var(--color-glass-border)] px-4 py-2 text-xs text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
            >
              Exit Theater Mode
            </button>
            <span className="text-[10px] text-[var(--color-muted)]">
              Press{' '}
              <kbd className="rounded border border-[var(--color-glass-border)] px-1 font-mono text-[10px]">
                F
              </kbd>{' '}
              for fullscreen
            </span>
          </div>
        )}

        {/* ── PeerTube Tip Overlay ── */}
        {tipVideo && tipVideo.source === 'peertube' && (
          <div className="fixed bottom-6 right-6 z-50">
            <PeerTubeTipOverlay
              videoId={tipVideo.id}
              creatorName={tipVideo.channelName}
              creatorChannel={tipVideo.channelName.toLowerCase().replace(/\s+/g, '-')}
              videoTitle={tipVideo.title}
              instanceDomain={PEERTUBE_INSTANCE}
              className="shadow-2xl"
            />
            <button
              type="button"
              onClick={() => setTipVideo(null)}
              className="mt-1 w-full rounded-lg bg-black/60 px-3 py-1 text-[10px] text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors backdrop-blur-sm"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ── Footer ── */}
        {!loading && videos.length > 0 && (
          <footer className={`mt-8 text-center ${theaterMode ? 'px-4' : ''}`}>
            <p className="text-[11px] text-[var(--color-muted)]">
              Videos sourced from YouTube RSS feeds,{' '}
              <a
                href={`https://${PEERTUBE_INSTANCE}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-degen-500 hover:text-degen-400 transition-colors underline underline-offset-2"
              >
                {PEERTUBE_INSTANCE}
              </a>
              , and{' '}
              <a
                href="https://sepiasearch.org"
                target="_blank"
                rel="noopener noreferrer"
                className="text-degen-500 hover:text-degen-400 transition-colors underline underline-offset-2"
              >
                {FEDERATED_INSTANCE_COUNT} federated instances
              </a>{' '}
              — cached for 15 minutes
            </p>
          </footer>
        )}
      </div>
    </ErrorBoundary>
  );
}
