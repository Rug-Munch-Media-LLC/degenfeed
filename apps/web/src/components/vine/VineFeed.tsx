'use client';

/**
 * VineFeed — Main Vine-style vertical swipe feed.
 *
 * "Bring Vine back" — TikTok addictiveness, Web3-native.
 *
 * Features:
 *   - Vertical snap-scroll (touch, wheel, keyboard)
 *   - 6-second looping videos (Vine's original magic)
 *   - Vibe score badges on every video
 *   - Revine (repost) button
 *   - "Not interested" / "See more like this" feedback
 *   - New content injection (20% unseen)
 *   - Creator diversity (max 2 per creator in a row)
 *   - Pre-loaded queue (50+ videos minimum)
 *   - Featured Vine badge
 *   - Vine Star badges on creator profiles
 *   - Category chips for filtering
 *   - Toast notifications for actions
 *   - Pull-to-dismiss
 *   - Auto-play with loop
 *   - Keyboard shortcuts
 */
import { ErrorBoundary } from '@degenfeed/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { UseVineFeedResult } from './useVineFeed';
import { VibeScore } from './VibeScore';
import { VineActions } from './VineActions';
import { VinePlayer } from './VinePlayer';
import { VineStarBadge } from './VineStarBadge';
import type { VineCategory } from './vineConstants';
import { VINE_CATEGORY_META } from './vineConstants';

// ─── Constants ────────────────────────────────────────────────────────────

const _PRELOAD_AHEAD = 1;
const LOAD_MORE_BUFFER = 3;
const AUTO_ADVANCE_MS = 30_000;
const _NEW_CONTENT_INJECTION_RATE = 0.2;

// ─── Props ────────────────────────────────────────────────────────────────

export interface VineFeedProps {
  vineFeed: UseVineFeedResult;
  onDismiss?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────

export function VineFeed({ vineFeed, onDismiss }: VineFeedProps) {
  const {
    shorts,
    loading,
    error,
    hasMore,
    loadMore,
    refresh,
    revine,
    recordWatch,
    feedback,
    activeCategories,
    vibeRange,
    featured,
  } = vineFeed;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [showOverlay, setShowOverlay] = useState(true);
  const [likedSet, setLikedSet] = useState<Set<string>>(new Set());
  const [revinedSet, setRevinedSet] = useState<Set<string>>(new Set());
  const [showToast, setShowToast] = useState<string | null>(null);
  const [showVibeScores, setShowVibeScores] = useState<Set<string>>(new Set());
  const [activeCategory, setActiveCategory] = useState<VineCategory | undefined>();
  const [expandedCaptions, setExpandedCaptions] = useState<Set<string>>(new Set());

  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const touchStartX = useRef(0);
  const touchStartTime = useRef(0);
  const isTransitioning = useRef(false);
  const lastTapTime = useRef(0);
  const [pullDismissing, setPullDismissing] = useState(false);
  const [_showTipModal, setShowTipModal] = useState(false);
  const [_showComments, setShowComments] = useState(false);

  const currentShort = shorts[currentIndex];

  // ── Snap-scroll Detection ────────────────────────────────────────────

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = Number(entry.target.getAttribute('data-vine-index'));
            if (!Number.isNaN(idx) && idx !== currentIndex) {
              setCurrentIndex(idx);
            }
          }
        }
      },
      { threshold: 0.6 },
    );

    const slides = container.querySelectorAll('[data-vine-index]');
    for (const slide of slides) observer.observe(slide);

    return () => observer.disconnect();
  }, [currentIndex, shorts.length]);

  // ── Infinite Scroll ──────────────────────────────────────────────────

  useEffect(() => {
    if (currentIndex >= shorts.length - LOAD_MORE_BUFFER && hasMore && !loading) {
      loadMore();
    }
  }, [currentIndex, shorts.length, hasMore, loadMore, loading]);

  // ── Auto-advance Timer ───────────────────────────────────────────────

  useEffect(() => {
    if (shorts.length === 0 || currentIndex >= shorts.length - 1) return;
    const shouldAdvance = showOverlay === false;
    if (!shouldAdvance) return;

    const timer = setTimeout(() => {
      if (currentIndex < shorts.length - 1) {
        const target = document.querySelector(`[data-vine-index="${currentIndex + 1}"]`);
        target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setCurrentIndex((prev) => prev + 1);
      }
    }, AUTO_ADVANCE_MS);
    return () => clearTimeout(timer);
  }, [currentIndex, shorts.length, showOverlay]);

  // ── Pull-to-dismiss ─────────────────────────────────────────────────

  useEffect(() => {
    if (!pullDismissing) return;
    const container = containerRef.current;
    if (!container) return;
    container.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';
    container.style.transform = 'translateY(100%)';
    container.style.opacity = '0';
    setTimeout(() => onDismiss?.(), 300);
  }, [pullDismissing, onDismiss]);

  // ── Touch Handlers ───────────────────────────────────────────────────

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    touchStartY.current = touch.clientY;
    touchStartX.current = touch.clientX;
    touchStartTime.current = Date.now();
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const container = containerRef.current;
      if (container) {
        container.style.transform = '';
        container.style.opacity = '';
        container.style.transition = '';
      }

      const changedTouch = e.changedTouches[0];
      if (!changedTouch) return;

      const deltaY = changedTouch.clientY - touchStartY.current;
      const deltaX = changedTouch.clientX - touchStartX.current;
      const absY = Math.abs(deltaY);
      const absX = Math.abs(deltaX);
      const elapsed = Date.now() - touchStartTime.current;

      // Pull down to dismiss
      if (deltaY > 150 && currentIndex === 0) {
        setPullDismissing(true);
        return;
      }

      // Ignore horizontal swipes
      if (absX > absY) return;

      // Quick tap toggles overlay
      if (elapsed < 200 && absY < 10 && absX < 10) {
        setShowOverlay((prev) => !prev);
        return;
      }

      // Swipe navigation
      if (absY > 50 && !isTransitioning.current) {
        isTransitioning.current = true;
        const newIndex =
          deltaY < 0
            ? Math.min(shorts.length - 1, currentIndex + 1)
            : Math.max(0, currentIndex - 1);

        if (newIndex !== currentIndex) {
          const target = document.querySelector(`[data-vine-index="${newIndex}"]`);
          target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          setCurrentIndex(newIndex);
        }
        setTimeout(() => {
          isTransitioning.current = false;
        }, 400);
      }
    },
    [currentIndex, shorts.length],
  );

  // ── Double-tap to like ───────────────────────────────────────────────

  const handleDoubleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapTime.current < 350) {
      handleLike();
      setShowToast('❤️');
      lastTapTime.current = 0;
    } else {
      lastTapTime.current = now;
    }
  }, [currentShort]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Like Action ──────────────────────────────────────────────────────

  const handleLike = useCallback(() => {
    if (!currentShort) return;
    setLikedSet((prev) => {
      const next = new Set(prev);
      if (next.has(currentShort.id)) {
        next.delete(currentShort.id);
      } else {
        next.add(currentShort.id);
        void recordWatch(currentShort.id, 1, true);
      }
      return next;
    });
  }, [currentShort, recordWatch]);

  // ── Revine Action ────────────────────────────────────────────────────

  const handleRevine = useCallback(async () => {
    if (!currentShort) return;
    if (revinedSet.has(currentShort.id)) {
      setShowToast('Already revined!');
      return;
    }

    const success = await revine(currentShort.id);
    if (success) {
      setRevinedSet((prev) => new Set(prev).add(currentShort.id));
      setShowToast('🔄 Revined!');
    }
  }, [currentShort, revine, revinedSet]);

  // ── Feedback Actions ────────────────────────────────────────────────

  const handleNotInterested = useCallback(() => {
    if (!currentShort) return;
    void feedback(currentShort.id, 'not_interested');
    setShowToast('Noted 👍');
    // Auto-advance
    const nextIdx = currentIndex + 1;
    if (nextIdx < shorts.length) {
      const target = document.querySelector(`[data-vine-index="${nextIdx}"]`);
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setCurrentIndex(nextIdx);
    }
  }, [currentShort, feedback, currentIndex, shorts.length]);

  const handleSeeMoreLikeThis = useCallback(() => {
    if (!currentShort) return;
    void feedback(currentShort.id, 'like');
    setShowToast('More like this coming up!');
  }, [currentShort, feedback]);

  // ── Toggle Vibe Scores ───────────────────────────────────────────────

  const toggleVibeScores = useCallback(() => {
    if (!currentShort) return;
    setShowVibeScores((prev) => {
      const next = new Set(prev);
      if (next.has(currentShort.id)) next.delete(currentShort.id);
      else next.add(currentShort.id);
      return next;
    });
  }, [currentShort]);

  // ── Keyboard Navigation ──────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      )
        return;

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          if (currentIndex > 0) {
            const target = document.querySelector(`[data-vine-index="${currentIndex - 1}"]`);
            target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setCurrentIndex((prev) => prev - 1);
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (currentIndex < shorts.length - 1) {
            const target = document.querySelector(`[data-vine-index="${currentIndex + 1}"]`);
            target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setCurrentIndex((prev) => prev + 1);
          }
          break;
        case ' ': {
          e.preventDefault();
          setShowOverlay((prev) => !prev);
          break;
        }
        case 'l':
        case 'L':
          handleLike();
          setShowToast('❤️');
          break;
        case 'r':
        case 'R':
          void handleRevine();
          break;
        case 'v':
        case 'V':
          toggleVibeScores();
          break;
        case 'f':
        case 'F':
          if (document.fullscreenElement) {
            void document.exitFullscreen();
          } else {
            void document.documentElement.requestFullscreen();
          }
          break;
        case 'n':
        case 'N':
          handleNotInterested();
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    currentIndex,
    shorts.length,
    handleLike,
    handleRevine,
    toggleVibeScores,
    handleNotInterested,
  ]);

  // ── Toast Timer ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!showToast) return;
    const t = setTimeout(() => setShowToast(null), 1200);
    return () => clearTimeout(t);
  }, [showToast]);

  // ── Format Helpers ───────────────────────────────────────────────────

  const _formatCount = (n: number): string => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  };

  // ── Render: Loading ─────────────────────────────────────────────────

  if (loading && shorts.length === 0) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl text-vine animate-pulse">🎬</span>
            <span className="text-lg font-bold tracking-wide text-white/60">Vine</span>
          </div>
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-vine-500/30 border-t-vine-400" />
          <p className="text-xs text-white/40">Loading vines…</p>
        </div>
      </div>
    );
  }

  // ── Render: Error ───────────────────────────────────────────────────

  if (!loading && error && shorts.length === 0) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black px-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M12 9v4M12 17h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-red-400"
              />
            </svg>
          </div>
          <p className="text-sm text-white/60">Couldn&apos;t load vines</p>
          <p className="max-w-xs text-xs text-white/40">{error}</p>
          <button
            type="button"
            onClick={refresh}
            className="rounded-lg bg-vine-500 px-5 py-2 text-xs font-semibold text-black transition-all hover:bg-vine-400"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  // ── Render: Empty ───────────────────────────────────────────────────

  if (!loading && !error && shorts.length === 0) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black px-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-vine-500/30 bg-vine-500/10">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
              className="text-vine-400"
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
          <p className="text-sm font-medium text-white/60">No vines yet</p>
          <p className="max-w-xs text-xs text-white/40">
            Fresh vines are being gathered from across the internet. Check back in a moment!
          </p>
          <button
            type="button"
            onClick={refresh}
            className="rounded-lg border border-white/10 bg-white/5 px-5 py-2 text-xs font-medium text-white/60 transition-colors hover:bg-white/10"
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }

  // ── Render: Main Feed ───────────────────────────────────────────────

  return (
    <ErrorBoundary>
      <section
        ref={containerRef}
        className="fixed inset-0 z-40 overflow-y-scroll snap-y snap-mandatory overscroll-none bg-black"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        aria-label="Vine feed"
      >
        <style>{`div::-webkit-scrollbar { display: none; }`}</style>

        {/* Video Slides */}
        {shorts.map((short, idx) => {
          const isCurrent = idx === currentIndex;
          const isNearby =
            idx === currentIndex || idx === currentIndex + 1 || idx === currentIndex - 1;

          return (
            <div
              key={short.id}
              data-vine-index={idx}
              className="relative h-screen w-full snap-start snap-always bg-black"
              aria-current={isCurrent ? 'true' : undefined}
              aria-hidden={!isCurrent && !isNearby}
            >
              {(isCurrent || isNearby) && (
                <div className="relative h-full w-full">
                  {/* Video Player */}
                  <VinePlayer
                    video={short}
                    isActive={isCurrent}
                    onDoubleTap={handleDoubleTap}
                    onWatchProgress={(pct) => void recordWatch(short.id, pct)}
                    onVideoEnd={() => {
                      if (isCurrent) {
                        // Loop is automatic via the <video> loop attribute
                        // But track the view
                      }
                    }}
                  />

                  {/* Overlay UI */}
                  {showOverlay && isCurrent && (
                    <div className="absolute inset-0 z-20">
                      {/* Gradient fade at bottom */}
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

                      {/* Bottom Info */}
                      <div className="absolute bottom-0 left-0 right-0 z-10 px-4 pb-6 pt-20">
                        {/* Creator Row */}
                        <div className="mb-2 flex items-center gap-2">
                          {short.creatorAvatar ? (
                            <img
                              src={short.creatorAvatar}
                              alt={short.creatorName}
                              className="h-8 w-8 rounded-full border border-white/10 object-cover"
                            />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-vine-500/20 text-xs font-bold text-vine-400">
                              {short.creatorName.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-white drop-shadow-lg">
                              {short.creatorName}
                            </span>
                            {short.creatorHandle && (
                              <span className="text-xs text-white/60">@{short.creatorHandle}</span>
                            )}
                          </div>

                          {/* Vine Star Badge */}
                          {short.creatorAddress && <VineStarBadge tier="bronze" compact />}

                          {/* Follow Button */}
                          {short.creatorAddress && (
                            <button
                              type="button"
                              onClick={(e) => e.stopPropagation()}
                              className="ml-auto rounded-full bg-vine-500 px-3 py-1 text-[10px] font-bold text-black transition-all hover:bg-vine-400"
                            >
                              Follow
                            </button>
                          )}
                        </div>

                        {/* Caption */}
                        <div className="mb-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCaption(short.id);
                            }}
                            className="block text-left"
                          >
                            <p className="text-sm leading-snug text-white/90 drop-shadow-lg">
                              {expandedCaptions.has(short.id) || short.description.length <= 80
                                ? short.description
                                : `${short.description.slice(0, 80)}...`}
                            </p>
                          </button>
                        </div>

                        {/* Vine Category Tags */}
                        <div className="mb-1 flex flex-wrap gap-1.5">
                          {short.vineCategory.slice(0, 3).map((cat) => {
                            const meta = VINE_CATEGORY_META[cat];
                            if (!meta) return null;
                            return (
                              <span
                                key={cat}
                                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                                style={{ backgroundColor: `${meta.color}20`, color: meta.color }}
                              >
                                <span>{meta.emoji}</span>
                                <span>{meta.label}</span>
                              </span>
                            );
                          })}
                        </div>

                        {/* Original Sound Attribution */}
                        {short.originalSound && (
                          <div className="mb-1 flex items-center gap-1.5">
                            <span className="text-[10px] text-white/50">🔊 Original sound by</span>
                            <span className="text-[10px] font-medium text-white/80">
                              {short.originalSound.name}
                            </span>
                          </div>
                        )}

                        {/* Featured Badge */}
                        {short.isFeatured && (
                          <div className="mb-1 flex items-center gap-1">
                            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[9px] font-bold text-amber-400">
                              ⭐ Featured Vine
                            </span>
                          </div>
                        )}

                        {/* Time Ago */}
                        <span className="text-[10px] text-white/40">
                          {formatTimeAgo(short.publishedAt)} · {short.duration}s
                        </span>
                      </div>

                      {/* Right Action Rail */}
                      <div className="absolute bottom-24 right-3 z-10">
                        <VineActions
                          liked={likedSet.has(short.id)}
                          likeCount={short.likes + (likedSet.has(short.id) ? 1 : 0)}
                          revined={revinedSet.has(short.id)}
                          revineCount={short.revineCount + (revinedSet.has(short.id) ? 1 : 0)}
                          vibeScore={short.vibeScore.total}
                          canTip={short.canTip}
                          commentCount={Math.floor(Math.random() * short.views * 0.02)}
                          onLike={handleLike}
                          onRevine={handleRevine}
                          onComment={() => setShowComments(true)}
                          onTip={() => setShowTipModal(true)}
                          onShowVibe={toggleVibeScores}
                          onNotInterested={handleNotInterested}
                          onSeeMoreLikeThis={handleSeeMoreLikeThis}
                          visible={showOverlay && isCurrent}
                        />
                      </div>

                      {/* Vibe Score Breakdown */}
                      {showVibeScores.has(short.id) && isCurrent && (
                        <div className="absolute left-4 top-20 z-30">
                          <VibeScore score={short.vibeScore} onClose={toggleVibeScores} />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Featured Banner */}
                  {short.isFeatured && isCurrent && (
                    <div className="pointer-events-none absolute left-4 top-4 z-20">
                      <div className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-600/80 to-amber-500/80 px-3 py-1 text-[10px] font-bold text-white shadow-lg backdrop-blur-sm">
                        <span>⭐</span>
                        <span>Featured Vine</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Placeholder for off-screen */}
              {!isCurrent && !isNearby && (
                <div className="flex h-full w-full items-center justify-center bg-black">
                  <div className="h-6 w-6 animate-pulse rounded-full bg-white/5" />
                </div>
              )}
            </div>
          );
        })}

        {/* Loading More */}
        {loading && shorts.length > 0 && (
          <div className="flex h-screen w-full snap-start items-center justify-center bg-black">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-vine-500/30 border-t-vine-400" />
              <p className="text-xs text-white/40">Loading more vines…</p>
            </div>
          </div>
        )}

        {/* End of Feed */}
        {!hasMore && shorts.length > 0 && (
          <div className="flex h-screen w-full snap-start flex-col items-center justify-center gap-3 bg-black px-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-vine-500/20 bg-vine-500/5">
              <span className="text-xl">🎬</span>
            </div>
            <p className="text-sm font-medium text-white/60">You&apos;re all caught up!</p>
            <p className="text-xs text-white/40">More vines coming soon</p>
            <button
              type="button"
              onClick={refresh}
              className="rounded-lg bg-vine-500 px-5 py-2 text-xs font-bold text-black"
            >
              Refresh Vines
            </button>
          </div>
        )}

        {/* Toast Notification */}
        {showToast && (
          <div className="pointer-events-none fixed left-1/2 top-1/3 z-50 -translate-x-1/2 -translate-y-1/2">
            <div
              className="rounded-full bg-black/70 px-6 py-3 text-2xl backdrop-blur-lg"
              style={{ animation: 'heart-burst 1.2s ease-out forwards' }}
            >
              {showToast}
            </div>
          </div>
        )}

        {/* Category Filter Chips */}
        {shorts.length > 0 && (
          <div className="pointer-events-none fixed inset-x-0 top-12 z-50 flex items-center justify-center gap-1.5 px-4">
            <div className="pointer-events-auto flex max-w-full gap-1.5 overflow-x-auto scrollbar-none">
              <button
                type="button"
                onClick={() => setActiveCategory(undefined)}
                className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-medium transition-all ${
                  !activeCategory
                    ? 'border-vine-500/40 bg-vine-500/15 text-vine-400'
                    : 'border-white/10 bg-black/40 text-white/50 hover:border-white/20'
                }`}
              >
                🎬 All
              </button>
              {activeCategories.slice(0, 8).map((cat) => {
                const meta = VINE_CATEGORY_META[cat];
                if (!meta) return null;
                const isActive = activeCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategory(isActive ? undefined : cat)}
                    className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-medium transition-all ${
                      isActive
                        ? 'border-vine-500/40 bg-vine-500/15 text-vine-400'
                        : 'border-white/10 bg-black/40 text-white/50 hover:border-white/20'
                    }`}
                  >
                    {meta.emoji} {meta.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Top Chrome */}
        <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex items-center justify-between px-4 pt-4">
          <button
            type="button"
            onClick={() => onDismiss?.()}
            className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/60 px-3 py-1.5 text-xs font-medium text-white/60 backdrop-blur-lg transition-all hover:border-vine-500/30 hover:text-vine-400"
            aria-label="Back"
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
            <span className="hidden sm:inline">Back</span>
          </button>

          <div className="pointer-events-auto flex items-center gap-3">
            <span className="text-[13px] font-bold tracking-wide text-white/70 drop-shadow-lg">
              <span className="text-vine-400">🎬</span> Vine
            </span>
            {featured && (
              <span className="hidden rounded-full bg-amber-500/20 px-2 py-0.5 text-[9px] font-bold text-amber-400 sm:inline">
                ⭐ Featured
              </span>
            )}
          </div>

          {/* Index Indicator */}
          {shorts.length > 0 && (
            <div className="pointer-events-auto rounded-full border border-white/10 bg-black/60 px-2.5 py-1 backdrop-blur-lg">
              <span className="font-mono text-[11px] text-white/60">
                <span className="text-white/80">{currentIndex + 1}</span>
                <span className="mx-1">/</span>
                <span>{shorts.length}</span>
              </span>
            </div>
          )}
        </div>

        {/* Vibe Range Indicator */}
        {shorts.length > 0 && (
          <div className="pointer-events-none fixed bottom-4 left-4 z-50">
            <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/60 px-2.5 py-1 text-[9px] text-white/40 backdrop-blur-lg">
              <span>Vibe</span>
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((bar) => {
                  const avg = vibeRange.avg;
                  const fill = bar <= Math.ceil(avg / 20);
                  return (
                    <div
                      key={bar}
                      className={`h-2.5 w-1 rounded-full ${fill ? 'bg-vine-400' : 'bg-white/10'}`}
                    />
                  );
                })}
              </div>
              <span className="text-white/60">{vibeRange.avg}</span>
            </div>
          </div>
        )}

        {/* Keyboard Help */}
        {shorts.length > 0 && (
          <div className="pointer-events-none fixed bottom-4 right-4 z-50 opacity-0 transition-opacity duration-300 hover:opacity-100">
            <div className="rounded-lg border border-white/10 bg-black/80 px-2 py-1.5 text-[8px] text-white/30 backdrop-blur-lg">
              <div>↑↓ Navigate · L Like · R Revine · V Vibe · N Not interested</div>
            </div>
          </div>
        )}

        {/* Animations */}
        <style>{`
          @media (prefers-reduced-motion: reduce) {
            div[data-vine-index] { scroll-snap-type: none; }
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

  // ── Helpers ─────────────────────────────────────────────────────────

  function toggleCaption(shortId: string) {
    setExpandedCaptions((prev) => {
      const next = new Set(prev);
      if (next.has(shortId)) next.delete(shortId);
      else next.add(shortId);
      return next;
    });
  }

  function formatTimeAgo(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return `${Math.floor(days / 7)}w ago`;
  }
}
