'use client';

/**
 * ShortsPlayer — TikTok-style vertical swipe video player component.
 *
 * Features:
 *   - Vertical swipe (touch + mouse wheel) for next/prev
 *   - Auto-play with mute/unmute toggle
 *   - Overlay UI: creator info, caption, like/comment/share/tip buttons
 *   - Source badge, progress bar, category pills
 *   - Loading skeleton, empty state, end-of-feed state
 *   - Watch event tracking for algorithm learning
 *   - Auto-advance on completion or skip
 *
 * Design: Immersive dark cyberpunk with neon-green degen accents.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────

export interface ShortItem {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  videoUrl: string;
  duration: number;
  creatorName: string;
  creatorAvatar?: string;
  creatorHandle?: string;
  views: number;
  likes: number;
  source: string;
  sourceLabel: string;
  sourceColor: string;
  tags: string[];
  categories: string[];
  publishedAt: number;
  vertical: boolean;
  canTip: boolean;
}

export interface ShortsPlayerProps {
  /** Array of shorts to play */
  shorts: ShortItem[];
  /** Currently active index */
  initialIndex?: number;
  /** Category filter options */
  categories?: string[];
  /** Active category filter */
  activeCategory?: string;
  /** Callback when category changes */
  onCategoryChange?: (category: string | undefined) => void;
  /** Callback when user reaches end of feed */
  onEndReached?: () => void;
  /** Callback for watch event tracking */
  onWatchEvent?: (event: {
    shortId: string;
    watchPercent: number;
    liked: boolean;
    shared: boolean;
    watchedFull: boolean;
    skipped: boolean;
    watchDurationMs: number;
  }) => void;
  /** Callback for like action */
  onLike?: (shortId: string) => void;
  /** Callback for share action */
  onShare?: (shortId: string) => void;
  /** Callback for tip action */
  onTip?: (shortId: string) => void;
  /** Callback for comment action */
  onComment?: (shortId: string) => void;
  /** Callback for follow creator */
  onFollow?: (creatorName: string) => void;
  /** Loading more indicator */
  isLoadingMore?: boolean;
  /** Has more pages */
  hasMore?: boolean;
  /** Manual load more trigger */
  onLoadMore?: () => void;
  /** Error state */
  error?: string;
  /** Retry callback */
  onRetry?: () => void;
}

// ─── Default Categories ─────────────────────────────────────────────────

const _DEFAULT_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'music', label: 'Music' },
  { id: 'gaming', label: 'Gaming' },
  { id: 'tech', label: 'Tech' },
  { id: 'comedy', label: 'Comedy' },
  { id: 'crypto', label: 'Crypto' },
  { id: 'defi', label: 'DeFi' },
  { id: 'trading', label: 'Trading' },
  { id: 'nft', label: 'NFT' },
  { id: 'sports', label: 'Sports' },
  { id: 'education', label: 'Education' },
  { id: 'streaming', label: 'Streaming' },
];

// ─── Player Component ───────────────────────────────────────────────────

export function ShortsPlayer({
  shorts,
  initialIndex = 0,
  _categories,
  _activeCategory,
  _onCategoryChange,
  onEndReached,
  onWatchEvent,
  onLike,
  onShare,
  onTip,
  onComment,
  onFollow,
  isLoadingMore = false,
  hasMore = true,
  onLoadMore,
  error,
  onRetry,
}: ShortsPlayerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [muted, setMuted] = useState(true);
  const [likedSet, setLikedSet] = useState<Set<string>>(new Set());
  const [expandedCaptions, setExpandedCaptions] = useState<Set<string>>(new Set());
  const [showOverlay, setShowOverlay] = useState(true);
  const [_isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<'up' | 'down' | null>(null);
  const [_showTipModal, setShowTipModal] = useState(false);
  const [_showComments, setShowComments] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const touchStartX = useRef(0);
  const isSwiping = useRef(false);
  const watchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const watchStartRef = useRef(Date.now());
  const overlayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentShort = shorts[currentIndex];
  const totalShorts = shorts.length;

  // ── Track Watch Event ──────────────────────────────────────────────

  const trackWatchEvent = useCallback(
    (event: {
      shortId: string;
      watchPercent: number;
      liked: boolean;
      shared: boolean;
      watchedFull: boolean;
      skipped: boolean;
      watchDurationMs: number;
    }) => {
      onWatchEvent?.(event);
    },
    [onWatchEvent],
  );

  // ── Watch Timer ─────────────────────────────────────────────────────

  const stopWatchTimer = useCallback(() => {
    if (watchTimerRef.current) {
      clearInterval(watchTimerRef.current);
      watchTimerRef.current = null;
    }
  }, []);

  const startWatchTimer = useCallback(() => {
    stopWatchTimer();
    watchStartRef.current = Date.now();

    watchTimerRef.current = setInterval(() => {
      const video = videoRef.current;
      if (!video || !currentShort) return;

      const elapsed = Date.now() - watchStartRef.current;
      const watchPercent = video.duration > 0 ? video.currentTime / video.duration : 0;
      setProgress(Math.min(watchPercent, 1));

      // Track full watch
      if (watchPercent >= 0.9) {
        trackWatchEvent({
          shortId: currentShort.id,
          watchPercent: 0.95,
          liked: likedSet.has(currentShort.id),
          shared: false,
          watchedFull: true,
          skipped: false,
          watchDurationMs: elapsed,
        });
      }
    }, 500);
  }, [currentShort?.id, likedSet, trackWatchEvent, stopWatchTimer, currentShort]);

  // ── Video Playback ──────────────────────────────────────────────────

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (currentShort) {
      video.src = currentShort.videoUrl;
      video.muted = muted;
      video.playsInline = true;
      video.load();

      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
      }

      watchStartRef.current = Date.now();
      startWatchTimer();

      // Reset overlay visibility
      setShowOverlay(true);

      // Auto-hide overlay after 3s
      if (overlayTimeoutRef.current) clearTimeout(overlayTimeoutRef.current);
      overlayTimeoutRef.current = setTimeout(() => {
        setShowOverlay(false);
      }, 3000);
    }

    return () => {
      video.pause();
      video.src = '';
      stopWatchTimer();
    };
  }, [currentShort?.videoUrl, currentShort, stopWatchTimer, startWatchTimer, muted]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = muted;
    }
  }, [muted]);

  // ── Navigation ─────────────────────────────────────────────────────

  const goNext = useCallback(() => {
    if (isTransitioning) return;

    // Track skip for current video
    const video = videoRef.current;
    if (video && currentShort) {
      const watchPercent = video.duration > 0 ? video.currentTime / video.duration : 0;
      if (watchPercent < 0.9) {
        trackWatchEvent({
          shortId: currentShort.id,
          watchPercent,
          liked: likedSet.has(currentShort.id),
          shared: false,
          watchedFull: false,
          skipped: true,
          watchDurationMs: Date.now() - watchStartRef.current,
        });
      }
    }

    setIsTransitioning(true);
    setSwipeDirection('up');

    if (currentIndex < totalShorts - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else if (onLoadMore && hasMore) {
      onLoadMore();
    } else {
      onEndReached?.();
    }

    setTimeout(() => {
      setIsTransitioning(false);
      setSwipeDirection(null);
    }, 300);
  }, [
    currentIndex,
    totalShorts,
    isTransitioning,
    currentShort,
    likedSet,
    trackWatchEvent,
    onLoadMore,
    hasMore,
    onEndReached,
  ]);

  const goPrev = useCallback(() => {
    if (isTransitioning || currentIndex <= 0) return;

    setIsTransitioning(true);
    setSwipeDirection('down');

    setCurrentIndex((prev) => prev - 1);

    setTimeout(() => {
      setIsTransitioning(false);
      setSwipeDirection(null);
    }, 300);
  }, [currentIndex, isTransitioning]);

  // ── Touch / Wheel Handler ──────────────────────────────────────────

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0]?.clientY ?? 0;
    touchStartX.current = e.touches[0]?.clientX ?? 0;
    isSwiping.current = true;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!isSwiping.current) return;
      isSwiping.current = false;

      const touchEndY = e.changedTouches[0]?.clientY ?? 0;
      const touchEndX = e.changedTouches[0]?.clientX ?? 0;

      const deltaY = touchStartY.current - touchEndY;
      const deltaX = touchStartX.current - touchEndX;

      // Require minimum swipe distance (80px) and more vertical than horizontal
      if (Math.abs(deltaY) > 80 && Math.abs(deltaY) > Math.abs(deltaX) * 1.5) {
        if (deltaY > 0) {
          goNext();
        } else {
          goPrev();
        }
      }
    },
    [goNext, goPrev],
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (Math.abs(e.deltaY) > 30) {
        if (e.deltaY > 0) {
          goNext();
        } else {
          goPrev();
        }
      }
    },
    [goNext, goPrev],
  );

  // ── Keyboard Nav ──────────────────────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp') goPrev();
      if (e.key === 'ArrowDown') goNext();
      if (e.key === ' ' || e.key === 'k') {
        e.preventDefault();
        const video = videoRef.current;
        if (video) {
          if (video.paused) {
            video.play().catch(() => {});
            setIsPlaying(true);
          } else {
            video.pause();
            setIsPlaying(false);
          }
        }
      }
      if (e.key === 'm') setMuted((prev) => !prev);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goNext, goPrev]);

  // ── Video End → Auto-advance ──────────────────────────────────────

  const handleVideoEnded = useCallback(() => {
    trackWatchEvent({
      shortId: currentShort?.id ?? '',
      watchPercent: 1,
      liked: likedSet.has(currentShort?.id ?? ''),
      shared: false,
      watchedFull: true,
      skipped: false,
      watchDurationMs: Date.now() - watchStartRef.current,
    });
    goNext();
  }, [currentShort?.id, likedSet, trackWatchEvent, goNext]);

  // ── Like Toggle ────────────────────────────────────────────────────

  const toggleLike = useCallback(() => {
    if (!currentShort) return;
    setLikedSet((prev) => {
      const next = new Set(prev);
      if (next.has(currentShort.id)) {
        next.delete(currentShort.id);
      } else {
        next.add(currentShort.id);
        onLike?.(currentShort.id);
      }
      return next;
    });
  }, [currentShort, onLike]);

  // ── Overlay Visibility ─────────────────────────────────────────────

  const toggleOverlay = useCallback(() => {
    setShowOverlay((prev) => !prev);
  }, []);

  const toggleCaptionExpand = useCallback(() => {
    if (!currentShort) return;
    setExpandedCaptions((prev) => {
      const next = new Set(prev);
      if (next.has(currentShort.id)) {
        next.delete(currentShort.id);
      } else {
        next.add(currentShort.id);
      }
      return next;
    });
  }, [currentShort]);

  // ── Format Helpers ─────────────────────────────────────────────────

  const formatCount = (count: number): string => {
    if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
    if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
    return String(count);
  };

  const formatTimeAgo = (timestamp: number): string => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return `${Math.floor(days / 7)}w ago`;
  };

  // ── Render: Empty State ───────────────────────────────────────────

  if (!currentShort && !isLoadingMore) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-4 px-6 text-center">
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
          <p className="text-sm font-medium text-white/60">No shorts available</p>
          <p className="max-w-xs text-xs text-white/40">
            {error ? error : 'No more shorts! Check back soon or try a different category.'}
          </p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-lg bg-degen-500 px-5 py-2 text-xs font-semibold text-black transition-all hover:bg-degen-400"
            >
              Try again
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Render: Loading State ─────────────────────────────────────────

  if (!currentShort && isLoadingMore) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-2 border-degen-500/30 border-t-degen-400" />
          <p className="text-xs text-white/40">Loading shorts...</p>
        </div>
      </div>
    );
  }

  // ── Render: End of Feed ───────────────────────────────────────────

  if (!currentShort && !hasMore) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-4 px-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-degen-500/20 bg-degen-500/5">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
              className="text-degen-400/60"
            >
              <path
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            </svg>
          </div>
          <p className="text-sm font-medium text-white/60">You&apos;re all caught up</p>
          <p className="text-xs text-white/40">More shorts coming soon</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-white/40 transition-colors hover:bg-white/10 hover:text-white"
            >
              Refresh
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Render: Main Player ───────────────────────────────────────────

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-40 bg-black"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
      onClick={toggleOverlay}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        className="h-full w-full object-contain"
        playsInline
        loop
        muted={muted}
        onEnded={handleVideoEnded}
        onClick={(e) => {
          e.stopPropagation();
          const video = videoRef.current;
          if (video) {
            if (video.paused) {
              video.play().catch(() => {});
              setIsPlaying(true);
            } else {
              video.pause();
              setIsPlaying(false);
            }
          }
        }}
      />

      {/* Transition animation overlay */}
      {isTransitioning && (
        <div
          className={`absolute inset-0 z-20 bg-black/60 transition-all duration-300 ${
            swipeDirection === 'up' ? 'animate-slide-up' : 'animate-slide-down'
          }`}
        />
      )}

      {/* Source Badge (top-right) */}
      {currentShort && (
        <div className="pointer-events-none absolute right-4 top-16 z-30">
          <span
            className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium backdrop-blur-sm"
            style={{
              backgroundColor: `${currentShort.sourceColor}18`,
              borderColor: `${currentShort.sourceColor}40`,
              color: currentShort.sourceColor,
            }}
          >
            {currentShort.sourceLabel}
          </span>
        </div>
      )}

      {/* Progress Bar */}
      {currentShort && (
        <div className="absolute left-0 right-0 top-0 z-30">
          <div className="h-0.5 bg-white/10">
            <div
              className="h-full bg-degen-400 transition-all duration-200"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Mute/Unmute Button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setMuted(!muted);
        }}
        className="absolute right-4 top-20 z-30 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm transition-all hover:bg-black/60"
        aria-label={muted ? 'Unmute' : 'Mute'}
      >
        {muted ? (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className="text-white"
          >
            <path d="M11 5L6 9H2v6h4l5 4V5z" stroke="currentColor" strokeWidth="1.5" fill="none" />
            <path
              d="M23 9l-6 6M17 9l6 6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className="text-white"
          >
            <path d="M11 5L6 9H2v6h4l5 4V5z" stroke="currentColor" strokeWidth="1.5" fill="none" />
            <path
              d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        )}
      </button>

      {/* Overlay UI (shown on tap) */}
      {showOverlay && currentShort && (
        <div
          className="absolute inset-0 z-20 transition-opacity duration-300"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Gradient fade at bottom */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

          {/* Bottom Info Section */}
          <div className="absolute bottom-0 left-0 right-0 z-10 px-4 pb-6 pt-20">
            {/* Creator Info */}
            <div className="mb-3 flex items-center gap-2">
              {currentShort.creatorAvatar ? (
                <img
                  src={currentShort.creatorAvatar}
                  alt={currentShort.creatorName}
                  className="h-8 w-8 rounded-full border border-white/10 object-cover"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-degen-500/20 text-xs font-bold text-degen-400">
                  {currentShort.creatorName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-white drop-shadow-lg">
                  {currentShort.creatorName}
                </span>
                {currentShort.creatorHandle && (
                  <span className="text-xs text-white/60 drop-shadow-lg">
                    @{currentShort.creatorHandle}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onFollow?.(currentShort.creatorName);
                }}
                className="ml-1 rounded-full bg-degen-500 px-3 py-1 text-[10px] font-bold text-black transition-all hover:bg-degen-400"
              >
                Follow
              </button>
            </div>

            {/* Caption */}
            <div className="mb-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleCaptionExpand();
                }}
                className="block text-left"
              >
                <p className="text-sm leading-snug text-white/90 drop-shadow-lg">
                  {expandedCaptions.has(currentShort.id) || currentShort.description.length <= 100
                    ? currentShort.description
                    : `${currentShort.description.slice(0, 100)}...`}
                </p>
                {currentShort.description.length > 100 &&
                  !expandedCaptions.has(currentShort.id) && (
                    <span className="text-[11px] font-medium text-white/50">more</span>
                  )}
              </button>
            </div>

            {/* Tags */}
            {currentShort.tags.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {currentShort.tags.slice(0, 5).map((tag) => (
                  <span key={tag} className="text-xs font-medium text-degen-400/90 drop-shadow-lg">
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* Time Ago */}
            <div className="flex items-center gap-1.5">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
                className="text-white/50"
              >
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
                <path
                  d="M12 6v6l4 2"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              <span className="text-xs text-white/60 drop-shadow-lg">
                {formatTimeAgo(currentShort.publishedAt)} · {currentShort.duration}s
              </span>
            </div>
          </div>

          {/* Right Action Rail */}
          <div className="absolute bottom-24 right-3 z-10 flex flex-col items-center gap-4">
            {/* Like */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleLike();
              }}
              className="flex flex-col items-center gap-0.5"
              aria-label="Like"
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill={likedSet.has(currentShort.id) ? '#ff3040' : 'none'}
                aria-hidden="true"
                className={`transition-all ${likedSet.has(currentShort.id) ? 'text-[#ff3040]' : 'text-white'}`}
              >
                <path
                  d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="text-[10px] font-medium text-white">
                {formatCount(currentShort.likes + (likedSet.has(currentShort.id) ? 1 : 0))}
              </span>
            </button>

            {/* Comment */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onComment?.(currentShort.id);
                setShowComments(true);
              }}
              className="flex flex-col items-center gap-0.5"
              aria-label="Comment"
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
                className="text-white"
              >
                <path
                  d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            {/* Share */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onShare?.(currentShort.id);
              }}
              className="flex flex-col items-center gap-0.5"
              aria-label="Share"
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
                className="text-white"
              >
                <path
                  d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            {/* Tip */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onTip?.(currentShort.id);
                setShowTipModal(true);
              }}
              className="flex flex-col items-center gap-0.5"
              aria-label="Tip"
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
                className="text-degen-400"
              >
                <path
                  d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Swipe indicator */}
      {isTransitioning && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className={`text-white/80 transition-all ${
              swipeDirection === 'up' ? 'animate-bounce' : 'animate-bounce'
            }`}
          >
            {swipeDirection === 'up' ? (
              <path
                d="M12 5v14M5 12l7 7 7-7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : (
              <path
                d="M12 19V5M5 12l7-7 7 7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </svg>
        </div>
      )}

      {/* Loading More Indicator */}
      {isLoadingMore && (
        <div className="absolute bottom-20 left-0 right-0 z-30 flex justify-center">
          <div className="flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 backdrop-blur-sm">
            <div className="h-3 w-3 animate-spin rounded-full border border-degen-500/30 border-t-degen-400" />
            <span className="text-[10px] text-white/60">Loading more...</span>
          </div>
        </div>
      )}
    </div>
  );
}
