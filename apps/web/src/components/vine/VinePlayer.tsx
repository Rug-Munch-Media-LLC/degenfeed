'use client';

/**
 * VinePlayer — 6-second looping video player.
 *
 * "Vine's original magic number" — optimized for 6-second loops
 * but supports up to 60s. Auto-plays with loop, tracks watch progress,
 * double-tap to like, tap to pause.
 *
 * Features:
 *   - Looping playback (like Vine)
 *   - 6-second optimal duration
 *   - Watch progress tracking
 *   - Double-tap to like
 *   - Tap to pause/play
 *   - Loading skeleton
 *   - Error fallback
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { VineShortItem } from './useVineFeed';

// ─── Props ────────────────────────────────────────────────────────────────

export interface VinePlayerProps {
  video: VineShortItem;
  isActive: boolean;
  onDoubleTap?: () => void;
  onWatchProgress?: (percent: number) => void;
  onVideoEnd?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────

export function VinePlayer({
  video,
  isActive,
  onDoubleTap,
  onWatchProgress,
  onVideoEnd,
}: VinePlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loopCount, setLoopCount] = useState(0);
  const lastTapRef = useRef(0);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Auto-play / pause based on active state ──────────────────────────

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (isActive) {
      videoEl.muted = true;
      videoEl.playsInline = true;
      videoEl.loop = true;
      videoEl.play().catch(() => {
        // Autoplay blocked — user interaction needed
        setIsPaused(true);
      });
      setIsPaused(false);
    } else {
      videoEl.pause();
      setIsPaused(true);
    }
  }, [isActive]);

  // ── Reset when video changes ─────────────────────────────────────────

  useEffect(() => {
    setIsLoading(true);
    setHasError(false);
    setProgress(0);
    setLoopCount(0);
  }, []);

  // ── Progress tracking ────────────────────────────────────────────────

  useEffect(() => {
    if (!isActive) {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      return;
    }

    progressIntervalRef.current = setInterval(() => {
      const videoEl = videoRef.current;
      if (!videoEl?.duration) return;

      const pct = videoEl.currentTime / videoEl.duration;
      setProgress(Math.min(pct, 1));
      onWatchProgress?.(Math.min(pct, 1));
    }, 200);

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [isActive, onWatchProgress]);

  // ── Track loop count ─────────────────────────────────────────────────

  const handleTimeUpdate = useCallback(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    // Detect loop: when currentTime < previous currentTime
    if (videoEl.currentTime < 0.5 && videoEl.currentTime > 0) {
      setLoopCount((prev) => prev + 1);
    }
  }, []);

  // ── Handle video end (for non-looping) ───────────────────────────────

  const handleEnded = useCallback(() => {
    onVideoEnd?.();
    // If not looping, restart
    const videoEl = videoRef.current;
    if (videoEl && !videoEl.loop) {
      videoEl.currentTime = 0;
      videoEl.play().catch(() => {});
    }
  }, [onVideoEnd]);

  // ── Handle click (double-tap to like / tap to pause) ─────────────────

  const handleClick = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 350) {
      // Double tap
      onDoubleTap?.();
      lastTapRef.current = 0;
      return;
    }
    lastTapRef.current = now;

    // Single tap: toggle pause
    const videoEl = videoRef.current;
    if (!videoEl) return;
    if (videoEl.paused) {
      videoEl.play().catch(() => {});
      setIsPaused(false);
    } else {
      videoEl.pause();
      setIsPaused(true);
    }
  }, [onDoubleTap]);

  // ── Handle video metadata loaded ────────────────────────────────────

  const handleLoadedMetadata = useCallback(() => {
    setIsLoading(false);
    if (isActive) {
      const videoEl = videoRef.current;
      if (videoEl) {
        videoEl.play().catch(() => {});
      }
    }
  }, [isActive]);

  // ── Handle error ────────────────────────────────────────────────────

  const handleError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
  }, []);

  // ── Determine progress bar segments ─────────────────────────────────

  const loopDuration = video.loopDuration || Math.min(video.duration, 6);
  const progressPercent = progress * 100;

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black">
      {/* Video Element */}
      <video
        ref={videoRef}
        className="h-full w-full object-contain"
        src={video.videoUrl}
        poster={video.thumbnailUrl}
        playsInline
        muted
        loop
        preload="auto"
        onClick={handleClick}
        onLoadedMetadata={handleLoadedMetadata}
        onError={handleError}
        onEnded={handleEnded}
        onTimeUpdate={handleTimeUpdate}
      />

      {/* Loading State */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-vine-500/30 border-t-vine-400" />
            <p className="text-[10px] text-white/40">Loading vine…</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <div className="flex flex-col items-center gap-2 text-center px-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 9v4M12 17h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="text-red-400"
                />
              </svg>
            </div>
            <p className="text-xs text-white/50">Couldn&apos;t load video</p>
            <button
              type="button"
              onClick={() => {
                setHasError(false);
                setIsLoading(true);
                const videoEl = videoRef.current;
                if (videoEl) {
                  videoEl.load();
                  videoEl.play().catch(() => {});
                }
              }}
              className="rounded-lg bg-vine-500 px-3 py-1 text-[10px] font-semibold text-black"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Pause Indicator */}
      {isPaused && !isLoading && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="white" aria-hidden="true">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          </div>
        </div>
      )}

      {/* Loop Duration Badge */}
      {!isLoading && !hasError && (
        <div className="pointer-events-none absolute right-3 top-3 z-10">
          <span className="rounded-full bg-black/50 px-2 py-0.5 text-[9px] font-mono text-white/50 backdrop-blur-sm">
            {loopDuration}s
            {loopCount > 0 && <span className="ml-1 text-vine-400">×{loopCount + 1}</span>}
          </span>
        </div>
      )}

      {/* Progress Bar (Vine-style thin line at top) */}
      {isActive && (
        <div className="pointer-events-none absolute left-0 right-0 top-0 z-10">
          <div className="h-0.5 bg-white/10">
            <div
              className="h-full bg-gradient-to-r from-vine-400 to-vine-500 transition-all duration-200"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Vine Classic "6s" Mark */}
      {loopDuration <= 6 && !isLoading && !hasError && (
        <div className="pointer-events-none absolute left-3 top-3 z-10">
          <span className="rounded-full bg-vine-500/20 px-2 py-0.5 text-[9px] font-bold text-vine-400 backdrop-blur-sm border border-vine-500/30">
            🎬 Vine
          </span>
        </div>
      )}
    </div>
  );
}
