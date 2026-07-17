'use client';

/**
 * @pages/shorts — Full-screen TikTok-style vertical video feed.
 *
 * Design direction: Immersive dark cyberpunk. Neon-green degen accents.
 * Each video fills the viewport. Swipe up/down to navigate. Auto-play.
 * Right-side action rail. Bottom info overlay. Keyboard shortcuts for desktop.
 *
 * States: loading, loaded, empty, error, infinite-scroll-more.
 * Tests at 390px (mobile portrait) AND 1280px (desktop).
 */

import type { UnifiedPost } from '@degenfeed/types';
import { ErrorBoundary } from '@degenfeed/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ShortVideoCard } from '../../components/ShortVideoCard';

// ─── Constants ────────────────────────────────────────────────────────────

const SWIPE_THRESHOLD = 50; // px — minimum drag distance to trigger nav
const PRELOAD_AHEAD = 2; // preload this many videos ahead
const UNLOAD_BEHIND_MS = 2_000; // ms after which to unload prev videos
const LOAD_MORE_BUFFER = 3; // videos remaining before fetching more
const INITIAL_LIMIT = 20;
const LOAD_MORE_LIMIT = 10;

// ─── Custom fetch hook ────────────────────────────────────────────────────

interface FetchState {
  posts: UnifiedPost[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
}

function useShortFeed(): FetchState & { loadMore: () => void; refresh: () => void } {
  const [state, setState] = useState<FetchState>({
    posts: [],
    loading: true,
    loadingMore: false,
    error: null,
    hasMore: true,
  });
  const loadedRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const fetchVideos = useCallback(async (append = false) => {
    // Abort any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (!append) {
      setState((s) => ({ ...s, loading: true, error: null }));
    } else {
      setState((s) => ({ ...s, loadingMore: true }));
    }

    try {
      const params = new URLSearchParams({
        type: 'video',
        sort: 'new',
        limit: String(append ? LOAD_MORE_LIMIT : INITIAL_LIMIT),
      });
      if (append) params.set('offset', String(loadedRef.current));

      const res = await fetch(`/api/feed/home?${params.toString()}`, {
        credentials: 'include',
        signal: controller.signal,
        cache: 'no-store',
        headers: { 'cache-control': 'no-store' },
      });

      if (!res.ok) throw new Error(`Feed returned ${res.status}`);
      const data = (await res.json()) as { data?: UnifiedPost[]; meta?: { total?: number } };
      const fetched = data.data ?? [];
      const total = data.meta?.total ?? 0;
      const totalLoaded = loadedRef.current + fetched.length;

      loadedRef.current = totalLoaded;

      setState((prev) => ({
        posts: append ? [...prev.posts, ...fetched] : fetched,
        loading: false,
        loadingMore: false,
        error: null,
        hasMore: total > totalLoaded || fetched.length === LOAD_MORE_LIMIT,
      }));
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setState((prev) => ({
        ...prev,
        loading: false,
        loadingMore: false,
        error: err instanceof Error ? err.message : 'Failed to load videos',
      }));
    }
  }, []);

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
    return () => {
      abortRef.current?.abort();
    };
  }, [fetchVideos]);

  return { ...state, loadMore, refresh };
}

// ─── Page Component ───────────────────────────────────────────────────────

export default function ShortsPage() {
  const { posts, loading, loadingMore, error, hasMore, loadMore, refresh } = useShortFeed();
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const touchStartX = useRef(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [prerenderedVideos, setPrerenderedVideos] = useState<Set<number>>(new Set());
  const [showToast, setShowToast] = useState<string | null>(null);

  // Scroll-to-top on refresh (when posts array is replaced, not appended)
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts.length]);

  // ── Preloading & unloading ──────────────────────────────────────────────
  useEffect(() => {
    const nextBatch = new Set<number>();
    for (let i = currentIndex; i < currentIndex + PRELOAD_AHEAD && i < posts.length; i++) {
      nextBatch.add(i);
    }
    // Keep current + next, schedule unload of older ones
    const timer = setTimeout(
      () => {
        setPrerenderedVideos(nextBatch);
      },
      currentIndex > 0 ? UNLOAD_BEHIND_MS : 0,
    );
    return () => clearTimeout(timer);
  }, [currentIndex, posts.length]);

  // ── Infinite scroll — trigger loadMore when near end ────────────────────
  useEffect(() => {
    if (currentIndex >= posts.length - LOAD_MORE_BUFFER && hasMore) {
      loadMore();
    }
  }, [currentIndex, posts.length, hasMore, loadMore]);

  // ── Touch handlers for swipe ───────────────────────────────────────────
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const deltaY = e.changedTouches[0].clientY - touchStartY.current;
      const deltaX = e.changedTouches[0].clientX - touchStartX.current;
      const absY = Math.abs(deltaY);
      const absX = Math.abs(deltaX);

      // Ignore if horizontal swipe (likely a video scrub or scroll on desktop)
      if (absX > absY) return;

      if (absY > SWIPE_THRESHOLD && !isTransitioning) {
        setIsTransitioning(true);
        if (deltaY < 0 && currentIndex < posts.length - 1) {
          // Swipe up → next
          setCurrentIndex((prev) => prev + 1);
        } else if (deltaY > 0 && currentIndex > 0) {
          // Swipe down → previous
          setCurrentIndex((prev) => prev - 1);
        }
        setTimeout(() => setIsTransitioning(false), 400);
      }
    },
    [currentIndex, posts.length, isTransitioning],
  );

  // ── Keyboard navigation ────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't capture when user is typing in an input
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
          setCurrentIndex((prev) => Math.max(0, prev - 1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setCurrentIndex((prev) => Math.min(posts.length - 1, prev + 1));
          break;
        case ' ':
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('shorts-toggle-pause'));
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          void document.fullscreenElement
            ? document.exitFullscreen()
            : document.documentElement.requestFullscreen();
          break;
        case 'm':
        case 'M':
          // Handled inside ShortVideoCard via custom event
          window.dispatchEvent(new CustomEvent('shorts-toggle-mute'));
          break;
        case 'l':
        case 'L':
          window.dispatchEvent(new CustomEvent('shorts-like-current'));
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
  }, [posts.length]);

  // ── Toast timed display ────────────────────────────────────────────────
  useEffect(() => {
    if (!showToast) return;
    const t = setTimeout(() => setShowToast(null), 2000);
    return () => clearTimeout(t);
  }, [showToast]);

  // ── Listen for like/tip events to show feedback ────────────────────────
  useEffect(() => {
    const onLike = () => setShowToast('❤️ Liked!');
    const onBookmark = () => setShowToast('🔖 Bookmarked!');
    const onTip = () => setShowToast('⚡ Tip sent!');
    window.addEventListener('shorts-like-current', onLike);
    window.addEventListener('shorts-bookmark-current', onBookmark);
    window.addEventListener('shorts-tip-current', onTip);
    return () => {
      window.removeEventListener('shorts-like-current', onLike);
      window.removeEventListener('shorts-bookmark-current', onBookmark);
      window.removeEventListener('shorts-tip-current', onTip);
    };
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <ErrorBoundary>
      <div
        ref={containerRef}
        className="fixed inset-0 z-40 touch-pan-y overscroll-none"
        style={{ backgroundColor: '#000' }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        aria-label="Shorts video feed"
        role="region"
      >
        {/* ── Dim overlay on the shell aurora ── */}
        <div className="absolute inset-0 z-0 bg-black" />

        {/* ── Loading state ── */}
        {loading && posts.length === 0 && (
          <div className="relative z-10 flex h-full flex-col items-center justify-center">
            <div className="mb-4 h-12 w-12 animate-spin rounded-full border-2 border-degen-500 border-t-transparent" />
            <p className="text-sm text-gray-500" style={{ fontFamily: 'var(--font-mono)' }}>
              Loading shorts…
            </p>
          </div>
        )}

        {/* ── Error state ── */}
        {!loading && error && posts.length === 0 && (
          <div className="relative z-10 flex h-full flex-col items-center justify-center gap-4 px-6">
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
            <button type="button" onClick={refresh} className="btn-primary text-sm">
              Try again
            </button>
          </div>
        )}

        {/* ── Empty state ── */}
        {!loading && !error && posts.length === 0 && (
          <div className="relative z-10 flex h-full flex-col items-center justify-center gap-4 px-6">
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
              Video shorts will appear here as they&apos;re discovered from YouTube, PeerTube, and
              other protocols.
            </p>
            <button type="button" onClick={refresh} className="btn-primary text-sm">
              Refresh
            </button>
          </div>
        )}

        {/* ── Video feed ── */}
        {posts.length > 0 && (
          <div
            className="relative z-10 h-full w-full"
            style={{
              transform: `translateY(-${currentIndex * 100}vh)`,
              transition: isTransitioning
                ? 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)'
                : 'none',
            }}
          >
            {posts.map((post, idx) => {
              const isCurrent = idx === currentIndex;
              const isNearby =
                Math.abs(idx - currentIndex) <= PRELOAD_AHEAD || prerenderedVideos.has(idx);

              return (
                <div
                  key={post.id}
                  id={`shorts-video-${idx}`}
                  className="relative h-screen w-full snap-start"
                  aria-current={isCurrent ? 'true' : undefined}
                  aria-hidden={!isCurrent && !isNearby}
                >
                  {(isCurrent || isNearby || prerenderedVideos.has(idx)) && (
                      <ShortVideoCard
                      post={post}
                      isActive={isCurrent}
                      onPlayStateChange={setPaused}
                    />
                  )}

                  {/* Loading placeholder for non-nearby videos (to maintain scroll position) */}
                  {!isCurrent && !isNearby && !prerenderedVideos.has(idx) && (
                    <div className="flex h-full w-full items-center justify-center bg-black">
                      <div className="h-6 w-6 animate-pulse rounded-full bg-white/5" />
                    </div>
                  )}
                </div>
              );
            })}

            {/* ── Loading more indicator ── */}
            {loadingMore && (
              <div className="flex h-screen w-full items-center justify-center bg-black">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-degen-500/50 border-t-degen-400" />
                  <p className="text-xs text-gray-600">Loading more shorts…</p>
                </div>
              </div>
            )}

            {/* ── End of feed ── */}
            {!hasMore && posts.length > 0 && (
              <div className="flex h-screen w-full flex-col items-center justify-center gap-3 bg-black px-6">
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
                <button type="button" onClick={refresh} className="btn-primary text-sm">
                  Refresh
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Toast notification ── */}
        {showToast && (
          <div className="pointer-events-none absolute left-1/2 top-24 z-50 -translate-x-1/2">
            <div className="animate-fade-in rounded-full border border-degen-500/30 bg-black/80 px-5 py-2 text-sm font-medium text-degen-400 backdrop-blur-lg shadow-[0_0_20px_rgba(0,255,65,0.15)]">
              {showToast}
            </div>
          </div>
        )}

        {/* ── Mobile keyboard hint (shown briefly) ── */}
        <div className="pointer-events-none absolute bottom-24 left-1/2 z-50 hidden -translate-x-1/2 sm:block">
          <p className="text-[10px] text-gray-600/60 opacity-0 transition-opacity duration-1000">
            ↑↓ navigate · Space pause · F fullscreen · M mute · L like
          </p>
        </div>

        {/* ── Navigation pill at top left — back to feed ── */}
        <a
          href="/feed"
          className="absolute left-4 top-4 z-50 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/60 px-3 py-1.5 text-xs font-medium text-gray-400 backdrop-blur-lg transition-all hover:border-degen-500/30 hover:text-degen-400"
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

        {/* ── DegenFeed logo (top center) ── */}
        <div className="pointer-events-none absolute left-1/2 top-4 z-50 -translate-x-1/2">
          <span className="text-[13px] font-bold tracking-wide text-white/70 drop-shadow-lg">
            <span className="text-degen-400">◆</span> Shorts
          </span>
        </div>

        {/* ── Index indicator (bottom-left) ── */}
        {posts.length > 0 && (
          <div className="pointer-events-none absolute bottom-24 left-4 z-50 sm:bottom-28">
            <div className="rounded-full border border-white/10 bg-black/60 px-2.5 py-1 backdrop-blur-lg">
              <span className="font-mono text-[11px] text-gray-500">
                <span className="text-white/80">{currentIndex + 1}</span>
                <span className="mx-1">/</span>
                <span>{posts.length}</span>
              </span>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
