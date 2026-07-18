'use client';

/**
 * @pages/shorts — Full-screen TikTok-style vertical video feed.
 *
 * Design: Immersive dark cyberpunk with neon-green degen accents.
 * Snap scrolling between videos (scroll-snap-type: y mandatory).
 * Auto-play current, pause others. Preload next.
 * Touch gestures, keyboard controls, responsive for 390px + 1280px.
 */

import type { UnifiedPost } from '@degenfeed/types';
import { ErrorBoundary } from '@degenfeed/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ShortVideoCard } from '../../components/ShortVideoCard';

// ─── Inline types for the shorts API response ────────────────────────────

interface ShortVideoItem {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  videoUrl: string;
  duration: number;
  authorName: string;
  authorAvatar?: string;
  views: number;
  likes: number;
  source: 'peertube' | 'youtube' | 'twitter' | 'tiktok_rss' | 'direct';
  sourceUrl: string;
  topics: string[];
  publishedAt: number;
  vertical: boolean;
  qualityScore: number;
  sourceLabel: string;
}

interface ShortsResponse {
  videos: ShortVideoItem[];
  sources: {
    peertube: number;
    youtube: number;
  };
  cursor: string | null;
  hasMore: boolean;
}

// ─── Adapter: ShortVideoItem → UnifiedPost-like shape ───────────────────

function shortToPostShape(video: ShortVideoItem, idx: number): UnifiedPost {
  const id = `short:${video.source}:${video.id}`;
  return {
    id,
    protocol: video.source === 'youtube' ? 'youtube' : 'peertube',
    author: {
      id: `${video.source}:${video.authorName.replace(/[^a-zA-Z0-9]/g, '_')}`,
      primary: { protocol: video.source === 'youtube' ? 'youtube' : 'peertube', id: video.authorName },
      handles: {} as Record<string, string | null>,
      displayName: video.authorName,
      bio: '',
      avatarUrl: video.authorAvatar ?? '',
      verified: [],
      followerCount: 0,
      followingCount: 0,
      links: [],
      keys: {},
    },
    text: video.title,
    html: undefined,
    embeds: [
      { kind: 'video', url: video.videoUrl, meta: { thumbnail: video.thumbnailUrl, duration: video.duration } },
      { kind: 'link', url: video.sourceUrl },
    ],
    createdAt: video.publishedAt,
    metrics: { likes: video.likes, reposts: 0, replies: 0, quotes: 0, views: video.views },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: video.likes, reposts: 0, replies: 0, quotes: 0 },
    },
    raw: video,
    niches: video.topics,
    dfUri: `df://shorts/${video.source}/${idx}`,
    contentType: 'video',
    tipCount: 0,
  };
}

// ─── Constants ────────────────────────────────────────────────────────────

const PRELOAD_AHEAD = 1;
const UNLOAD_BEHIND_MS = 2_000;
const LOAD_MORE_BUFFER = 3;
const INITIAL_LIMIT = 20;
const LOAD_MORE_LIMIT = 10;

// ─── Custom fetch hook ────────────────────────────────────────────────────

interface FetchState {
  posts: ShortVideoItem[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  sourceCounts: {
    peertube: number;
    youtube: number;
  };
}

function useShortFeed(): FetchState & { loadMore: () => void; refresh: () => void } {
  const [state, setState] = useState<FetchState>({
    posts: [],
    loading: true,
    loadingMore: false,
    error: null,
    hasMore: true,
    sourceCounts: { peertube: 0, youtube: 0 },
  });
  const cursorRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Read topic filter from URL params or use defaults
  const [topicFilter, setTopicFilter] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    const params = new URLSearchParams(window.location.search);
    const topics = params.get('topics');
    return topics ? topics.split(',').filter(Boolean) : [];
  });

  const fetchVideos = useCallback(async (append = false) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState((s) => ({
      ...s,
      ...(append ? { loadingMore: true } : { loading: true, error: null }),
    }));

    try {
      const params = new URLSearchParams({
        limit: String(append ? LOAD_MORE_LIMIT : INITIAL_LIMIT),
      });
      if (append && cursorRef.current) params.set('cursor', cursorRef.current);
      if (topicFilter.length > 0) params.set('topics', topicFilter.join(','));

      const res = await fetch(`/api/shorts?${params.toString()}`, {
        credentials: 'include',
        signal: controller.signal,
        cache: 'no-store',
        headers: { 'cache-control': 'no-store' },
      });

      if (!res.ok) throw new Error(`Shorts feed returned ${res.status}`);
      const data = (await res.json()) as ShortsResponse;
      const fetched = data.videos ?? [];
      cursorRef.current = data.cursor;

      setState((prev) => ({
        posts: append ? [...prev.posts, ...fetched] : fetched,
        loading: false,
        loadingMore: false,
        error: null,
        hasMore: data.hasMore,
        sourceCounts: data.sources,
      }));
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setState((prev) => ({
        ...prev,
        loading: false,
        loadingMore: false,
        error: err instanceof Error ? err.message : 'Failed to load shorts',
      }));
    }
  }, [topicFilter]);

  const loadMore = useCallback(() => {
    if (state.loadingMore || !state.hasMore) return;
    void fetchVideos(true);
  }, [state.loadingMore, state.hasMore, fetchVideos]);

  const refresh = useCallback(() => {
    loadedRef.current = 0;
    void fetchVideos(false);
  }, [fetchVideos]);

  useEffect(() => {
    void fetchVideos(false);
    return () => abortRef.current?.abort();
  }, [fetchVideos]);

  return { ...state, loadMore, refresh };
}

// ─── Page Component ───────────────────────────────────────────────────────

export default function ShortsPage() {
  const { posts, loading, loadingMore, error, hasMore, loadMore, refresh, sourceCounts } = useShortFeed();
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const isTransitioning = useRef(false);
  const touchStartY = useRef(0);
  const touchStartX = useRef(0);
  const touchStartTime = useRef(0);
  const lastTapTime = useRef(0);
  const [showToast, setShowToast] = useState<string | null>(null);
  const [prerenderedVideos, setPrerenderedVideos] = useState<Set<number>>(new Set());

  // ── Snap-scroll detection via IntersectionObserver ─────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = Number(entry.target.getAttribute('data-video-index'));
            if (!Number.isNaN(idx) && idx !== currentIndex) {
              setCurrentIndex(idx);
            }
          }
        }
      },
      { threshold: 0.6 },
    );

    const slides = container.querySelectorAll('[data-video-index]');
    for (const slide of slides) observer.observe(slide);

    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  // ── Preloading & unloading ──────────────────────────────────────────────
  useEffect(() => {
    const nextBatch = new Set<number>();
    for (let i = currentIndex; i <= currentIndex + PRELOAD_AHEAD && i < posts.length; i++) {
      nextBatch.add(i);
    }
    // Keep previous index for smooth backward transition
    if (currentIndex > 0) nextBatch.add(currentIndex - 1);

    const timer = setTimeout(
      () => setPrerenderedVideos(nextBatch),
      currentIndex > 0 ? UNLOAD_BEHIND_MS : 0,
    );
    return () => clearTimeout(timer);
  }, [currentIndex, posts.length]);

  // ── Infinite scroll — trigger loadMore when near end ────────────────────
  useEffect(() => {
    if (currentIndex >= posts.length - LOAD_MORE_BUFFER && hasMore && !loadingMore) {
      loadMore();
    }
  }, [currentIndex, posts.length, hasMore, loadMore, loadingMore]);

  // ── Touch handlers for swipe ───────────────────────────────────────────
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    touchStartY.current = touch.clientY;
    touchStartX.current = touch.clientX;
    touchStartTime.current = Date.now();
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const changedTouch = e.changedTouches[0];
      if (!changedTouch) return;
      const deltaY = changedTouch.clientY - touchStartY.current;
      const deltaX = changedTouch.clientX - touchStartX.current;
      const absY = Math.abs(deltaY);
      const absX = Math.abs(deltaX);
      const elapsed = Date.now() - touchStartTime.current;

      // Ignore horizontal swipes (volume scrub on videos)
      if (absX > absY) return;

      // Quick tap (under 200ms and minimal movement) — toggles overlay
      if (elapsed < 200 && absY < 10 && absX < 10) {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = changedTouch.clientX - rect.left;
        const width = rect.width;

        // Tap left 1/3 → seek back (delegated to ShortVideoCard)
        if (x < width * 0.3) {
          window.dispatchEvent(new CustomEvent('shorts-seek-back'));
          return;
        }
        // Tap right 1/3 → seek forward
        if (x > width * 0.7) {
          window.dispatchEvent(new CustomEvent('shorts-seek-forward'));
          return;
        }
        // Middle tap — toggle overlay
        window.dispatchEvent(new CustomEvent('shorts-toggle-overlay'));
        return;
      }

      // Swipe threshold
      if (absY > 50 && !isTransitioning.current) {
        isTransitioning.current = true;
        const newIndex =
          deltaY < 0 ? Math.min(posts.length - 1, currentIndex + 1) : Math.max(0, currentIndex - 1);
        if (newIndex !== currentIndex) {
          // Use native scroll-snap for the transition
          const target = document.querySelector(`[data-video-index="${newIndex}"]`);
          target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          setCurrentIndex(newIndex);
        }
        setTimeout(() => {
          isTransitioning.current = false;
        }, 400);
      }
    },
    [currentIndex, posts.length],
  );

  // ── Double-tap to like ──────────────────────────────────────────────────
  const handleDoubleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapTime.current < 350) {
      window.dispatchEvent(new CustomEvent('shorts-double-tap-like'));
      setShowToast('❤️');
      lastTapTime.current = 0;
    } else {
      lastTapTime.current = now;
    }
  }, []);

  // ── Keyboard navigation ────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        (document.activeElement as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          if (currentIndex > 0) {
            const target = document.querySelector(`[data-video-index="${currentIndex - 1}"]`);
            target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setCurrentIndex((prev) => prev - 1);
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (currentIndex < posts.length - 1) {
            const target = document.querySelector(`[data-video-index="${currentIndex + 1}"]`);
            target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setCurrentIndex((prev) => prev + 1);
          }
          break;
        case ' ':
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('shorts-toggle-pause'));
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          if (document.fullscreenElement) {
            void document.exitFullscreen();
          } else {
            void document.documentElement.requestFullscreen();
          }
          break;
        case 'm':
        case 'M':
          window.dispatchEvent(new CustomEvent('shorts-toggle-mute'));
          break;
        case 'l':
        case 'L':
          window.dispatchEvent(new CustomEvent('shorts-double-tap-like'));
          setShowToast('❤️');
          break;
        case 't':
        case 'T':
          window.dispatchEvent(new CustomEvent('shorts-tip-current'));
          break;
        case 'b':
        case 'B':
          window.dispatchEvent(new CustomEvent('shorts-bookmark-current'));
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentIndex, posts.length]);

  // ── Toast display ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!showToast) return;
    const t = setTimeout(() => setShowToast(null), 1200);
    return () => clearTimeout(t);
  }, [showToast]);

  // ── Toast via custom events ────────────────────────────────────────────
  useEffect(() => {
    const onLike = () => setShowToast('❤️');
    const onBookmark = () => setShowToast('🔖 Saved');
    const onTip = () => setShowToast('⚡ Tip');
    const onSeekBack = () => setShowToast('⏪');
    const onSeekForward = () => setShowToast('⏩');
    window.addEventListener('shorts-like-current', onLike);
    window.addEventListener('shorts-bookmark-current', onBookmark);
    window.addEventListener('shorts-tip-current', onTip);
    window.addEventListener('shorts-seek-back', onSeekBack);
    window.addEventListener('shorts-seek-forward', onSeekForward);
    return () => {
      window.removeEventListener('shorts-like-current', onLike);
      window.removeEventListener('shorts-bookmark-current', onBookmark);
      window.removeEventListener('shorts-tip-current', onTip);
      window.removeEventListener('shorts-seek-back', onSeekBack);
      window.removeEventListener('shorts-seek-forward', onSeekForward);
    };
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <ErrorBoundary>
      <section
        ref={containerRef}
        className="fixed inset-0 z-40 overflow-y-scroll snap-y snap-mandatory overscroll-none"
        style={{ backgroundColor: '#000', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        aria-label="Shorts video feed"
      >
        {/* Hide scrollbar */}
        <style>{`div::-webkit-scrollbar { display: none; }`}</style>

        {/* ── Loading state — full-screen skeleton ── */}
        {loading && posts.length === 0 && (
          <div className="flex h-screen w-full snap-start flex-col items-center justify-center bg-black">
            <div className="mb-6 flex items-center gap-2">
              <span className="text-lg text-degen-400">◆</span>
              <span className="text-sm font-bold tracking-wide text-white/40">Shorts</span>
            </div>
            <div className="mb-4 h-10 w-10 animate-spin rounded-full border-2 border-degen-500/30 border-t-degen-400" />
            <p className="text-xs text-gray-600">Loading shorts…</p>
          </div>
        )}

        {/* ── Error state ── */}
        {!loading && error && posts.length === 0 && (
          <div className="flex h-screen w-full snap-start flex-col items-center justify-center gap-4 bg-black px-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 9v4M12 17h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  className="text-red-400"
                />
              </svg>
            </div>
            <p className="text-sm text-gray-400">Couldn&apos;t load shorts</p>
            <p className="max-w-xs text-center text-xs text-gray-600">{error}</p>
            <button
              type="button"
              onClick={refresh}
              className="rounded-lg bg-degen-500 px-5 py-2 text-xs font-semibold text-black transition-all hover:bg-degen-400 hover:shadow-[0_0_12px_rgba(0,255,65,0.25)]"
            >
              Try again
            </button>
          </div>
        )}

        {/* ── Empty state ── */}
        {!loading && !error && posts.length === 0 && (
          <div className="flex h-screen w-full snap-start flex-col items-center justify-center gap-4 bg-black px-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-degen-500/30 bg-degen-500/10">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
                className="text-degen-400"
              >
                <rect
                  x="4"
                  y="4"
                  width="16"
                  height="16"
                  rx="3"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path d="M10 9L16 12L10 15V9Z" fill="currentColor" />
              </svg>
            </div>
            <p className="text-sm text-gray-400">No shorts yet</p>
            <p className="max-w-xs text-center text-xs text-gray-600">
              No shorts available. Check back later — they appear here as they&apos;re discovered
              from YouTube, PeerTube, and other protocols.
            </p>
            <button
              type="button"
              onClick={refresh}
              className="rounded-lg border border-white/10 bg-white/5 px-5 py-2 text-xs font-medium text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
            >
              Refresh
            </button>
          </div>
        )}

        {/* ── Video feed with snap scrolling ── */}
        {posts.length > 0 &&
          posts.map((video, idx) => {
            const post = shortToPostShape(video, idx);
            const isCurrent = idx === currentIndex;
            const isNearby =
              idx === currentIndex ||
              idx === currentIndex + 1 ||
              idx === currentIndex - 1 ||
              prerenderedVideos.has(idx);

            return (
              <div
                key={video.id}
                data-video-index={idx}
                className="relative h-screen w-full snap-start snap-always"
                aria-current={isCurrent ? 'true' : undefined}
                aria-hidden={!isCurrent && !isNearby}
              >
                {(isCurrent || isNearby) && (
                  <ShortVideoCard
                    post={post}
                    isActive={isCurrent}
                    onDoubleTap={handleDoubleTap}
                    onPlayStateChange={() => {}}
                  />
                )}

                {/* Thin placeholder when video is off-screen */}
                {!isCurrent && !isNearby && (
                  <div className="flex h-full w-full items-center justify-center bg-black">
                    <div className="h-6 w-6 animate-pulse rounded-full bg-white/5" />
                  </div>
                )}
              </div>
            );
          })}

        {/* ── Loading more indicator ── */}
        {loadingMore && (
          <div className="flex h-screen w-full snap-start items-center justify-center bg-black">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-degen-500/30 border-t-degen-400" />
              <p className="text-xs text-gray-600">Loading more…</p>
            </div>
          </div>
        )}

        {/* ── End of feed ── */}
        {!hasMore && posts.length > 0 && (
          <div className="flex h-screen w-full snap-start flex-col items-center justify-center gap-3 bg-black px-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-degen-500/20 bg-degen-500/5">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
                className="text-degen-400/60"
              >
                <rect
                  x="4"
                  y="4"
                  width="16"
                  height="16"
                  rx="3"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path d="M10 9L16 12L10 15V9Z" fill="currentColor" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-400">You&apos;re all caught up</p>
            <p className="text-xs text-gray-600">More shorts coming soon</p>
            <button
              type="button"
              onClick={refresh}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
            >
              Refresh
            </button>
          </div>
        )}

        {/* ── Toast notification ── */}
        {showToast && (
          <div className="pointer-events-none fixed left-1/2 top-1/3 z-50 -translate-x-1/2 -translate-y-1/2">
            <div
              className="animate-bounce-in rounded-full bg-black/70 px-6 py-3 text-2xl backdrop-blur-lg"
              style={{ animation: 'heart-burst 1.2s ease-out forwards' }}
            >
              {showToast}
            </div>
          </div>
        )}

        {/* ── Topic filter chips ── */}
        {posts.length > 0 && (
          <div className="pointer-events-none fixed inset-x-0 top-12 z-50 flex items-center justify-center gap-1.5 px-4">
            <div className="pointer-events-auto flex max-w-full gap-1.5 overflow-x-auto scrollbar-none">
              {['defi', 'nft', 'trading', 'bitcoin', 'memecoin', 'ai'].map((topic) => {
                const active = topicFilter.includes(topic);
                return (
                  <button
                    key={topic}
                    type="button"
                    onClick={() => {
                      const next = active
                        ? topicFilter.filter((t) => t !== topic)
                        : [...topicFilter, topic];
                      setTopicFilter(next);
                      // Update URL without navigation
                      const u = new URL(window.location.href);
                      if (next.length > 0) u.searchParams.set('topics', next.join(','));
                      else u.searchParams.delete('topics');
                      window.history.replaceState({}, '', u.toString());
                    }}
                    className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-medium transition-all ${
                      active
                        ? 'border-degen-500/40 bg-degen-500/15 text-degen-400'
                        : 'border-white/10 bg-black/40 text-gray-500 hover:border-white/20 hover:text-gray-300'
                    }`}
                  >
                    {topic}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Persistent UI chrome (fixed, not scrollable) ── */}
        <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex items-center justify-between px-4 pt-4">
          <a
            href="/feed"
            className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/60 px-3 py-1.5 text-xs font-medium text-gray-400 backdrop-blur-lg transition-all hover:border-degen-500/30 hover:text-degen-400"
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

          <div className="pointer-events-auto flex items-center gap-2">
            <span className="text-[13px] font-bold tracking-wide text-white/70 drop-shadow-lg">
              <span className="text-degen-400">◆</span> Shorts
            </span>
            {/* Source badges */}
            {sourceCounts.peertube > 0 && (
              <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-purple-500/20 bg-purple-500/10 px-2 py-0.5 text-[10px] font-medium text-purple-400">
                PeerTube {sourceCounts.peertube}
              </span>
            )}
            {sourceCounts.youtube > 0 && (
              <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-400">
                YouTube {sourceCounts.youtube}
              </span>
            )}
          </div>

          {/* Index indicator */}
          {posts.length > 0 && (
            <div className="pointer-events-auto rounded-full border border-white/10 bg-black/60 px-2.5 py-1 backdrop-blur-lg">
              <span className="font-mono text-[11px] text-gray-500">
                <span className="text-white/80">{currentIndex + 1}</span>
                <span className="mx-1">/</span>
                <span>{posts.length}</span>
              </span>
            </div>
          )}
        </div>

        {/* ── Reduced motion ── */}
        <style>{`
          @media (prefers-reduced-motion: reduce) {
            div[data-video-index] { scroll-snap-type: none; }
          }
          @keyframes heart-burst {
            0% { transform: scale(0.3); opacity: 0; }
            20% { transform: scale(1.4); opacity: 1; }
            40% { transform: scale(1); opacity: 1; }
            80% { opacity: 1; }
            100% { transform: scale(1) translateY(-40px); opacity: 0; }
          }
        `}</style>
      </section>
    </ErrorBoundary>
  );
}
