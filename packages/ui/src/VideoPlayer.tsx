'use client';

/**
 * @degenfeed/ui — VideoPlayer
 *
 * Native HTML5 <video> player with custom controls, YouTube embed fallback,
 * IntersectionObserver lazy-loading, short-form vertical video support,
 * and accessibility-first design.
 *
 * Design direction: dark, minimal, neon-accented — matching the degenfeed
 * cyberpunk tone. Controls fade on idle, appear on hover/focus. Progress
 * bar doubles as a scrubber with a subtle glow.
 *
 * States:
 *   - pre-play: thumbnail + overlay play button
 *   - loading: spinner + "buffering" indicator
 *   - playing: controls auto-hide after 3s idle
 *   - paused: centered play button
 *   - error: error message + retry
 *
 * a11y: full keyboard operability, visible focus rings, accessible labels,
 *       aria-valuenow on progress, role="application" on container.
 */

import { memo, useCallback, useEffect, useRef, useState } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────

export type VideoPlatform = 'direct' | 'youtube' | 'peertube';
export type AspectRatio = '16:9' | '9:16' | 'auto';

export interface VideoPlayerProps {
  /** Direct video source URL (.mp4, .webm) */
  src?: string;
  /** Poster / thumbnail image URL */
  poster?: string;
  /** Video title for metadata and a11y */
  title?: string;
  /** Platform/origin of the video — controls rendering strategy */
  platform?: VideoPlatform;
  /** Aspect ratio container. 'auto' uses the video's intrinsic ratio */
  aspectRatio?: AspectRatio;
  /** Additional className */
  className?: string;

  // ── YouTube-specific ──
  /** YouTube video ID (extracted from URL) */
  youtubeId?: string;

  // ── PeerTube-specific ──
  /** PeerTube instance domain (e.g. video.degenfeed.xyz) */
  peertubeInstance?: string;
  /** PeerTube video UUID */
  peertubeUuid?: string;

  // ── Short-form / vertical video navigation (TikTok-style) ──
  /** Called when user swipes up for next video */
  onSwipeUp?: () => void;
  /** Called when user swipes down for previous video */
  onSwipeDown?: () => void;

  // ── Lifecycle callbacks ──
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onError?: (message: string) => void;

  // ── Metadata display ──
  showMetadata?: boolean;
  channelName?: string;
  views?: number;
  likes?: number;
}

// ─── Constants ────────────────────────────────────────────────────────────

const CONTROLS_HIDE_DELAY = 3000; // ms before controls auto-hide
const SEEK_STEP = 5; // seconds for arrow key seek
const VOLUME_STEP = 0.1;
const SWIPE_THRESHOLD = 60; // px for swipe detection

// ─── Helpers ──────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatCount(n?: number): string {
  if (n == null) return '';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function getThumbnailUrl(youtubeId?: string, poster?: string): string | undefined {
  if (poster) return poster;
  if (youtubeId) return `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`;
  return undefined;
}

// ─── Controls Component ──────────────────────────────────────────────────

interface ControlsProps {
  playing: boolean;
  muted: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  buffered: number;
  onPlayPause: () => void;
  onMuteToggle: () => void;
  onVolumeChange: (v: number) => void;
  onSeek: (t: number) => void;
  onFullscreen: () => void;
  fullscreenSupported: boolean;
  visible: boolean;
}

const Controls = memo(function Controls({
  playing,
  muted,
  volume,
  currentTime,
  duration,
  buffered,
  onPlayPause,
  onMuteToggle,
  onVolumeChange,
  onSeek,
  onFullscreen,
  fullscreenSupported,
  visible,
}: ControlsProps) {
  const progressRef = useRef<HTMLDivElement>(null);
  const seekProgress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedProgress = duration > 0 ? (buffered / duration) * 100 : 0;

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = progressRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const fraction = Math.max(0, Math.min(1, x / rect.width));
      onSeek(fraction * duration);
    },
    [duration, onSeek],
  );

  const handleProgressKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        onSeek(Math.min(duration, currentTime + SEEK_STEP));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onSeek(Math.max(0, currentTime - SEEK_STEP));
      }
    },
    [duration, currentTime, onSeek],
  );

  const volumePercent = muted ? 0 : volume * 100;

  return (
    <div
      className={`absolute inset-x-0 bottom-0 z-20 transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      aria-hidden={!visible}
    >
      {/* Gradient backdrop */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none" />

      <div className="relative z-10 px-3 pb-2 pt-8">
        {/* ── Progress bar (clickable + scrubbable) ── */}
        <div
          ref={progressRef}
          role="slider"
          tabIndex={0}
          aria-label="Video progress"
          aria-valuemin={0}
          aria-valuemax={duration}
          aria-valuenow={currentTime}
          aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
          className="group/progress relative mb-2 h-1.5 cursor-pointer rounded-full bg-white/20 transition-all hover:h-2"
          onClick={handleProgressClick}
          onKeyDown={handleProgressKeyDown}
        >
          {/* Buffered bar */}
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-white/30 transition-all"
            style={{ width: `${bufferedProgress}%` }}
          />
          {/* Seeked bar */}
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-degen-400 transition-all"
            style={{ width: `${seekProgress}%` }}
          />
          {/* Thumb */}
          <div
            className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-degen-400 shadow-lg shadow-degen-400/50 opacity-0 transition-all group-hover/progress:opacity-100"
            style={{ left: `calc(${seekProgress}% - 6px)` }}
          />
        </div>

        {/* ── Controls row ── */}
        <div className="flex items-center gap-2 text-white">
          {/* Play/Pause */}
          <button
            type="button"
            onClick={onPlayPause}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-degen-400/60"
            aria-label={playing ? 'Pause' : 'Play'}
          >
            {playing ? (
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="currentColor"
                aria-hidden="true"
              >
                <rect x="3" y="2" width="4" height="12" rx="1" />
                <rect x="9" y="2" width="4" height="12" rx="1" />
              </svg>
            ) : (
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M4 2L14 8L4 14V2Z" />
              </svg>
            )}
          </button>

          {/* Time display */}
          <span className="min-w-[80px] text-[11px] font-mono tabular-nums text-white/80 select-none">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Volume */}
          <div className="group/vol flex items-center gap-1">
            <button
              type="button"
              onClick={onMuteToggle}
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-degen-400/60"
              aria-label={muted ? 'Unmute' : 'Mute'}
            >
              {muted || volume === 0 ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M11 5L6 9H2v6h4l5 4V5z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                  <line
                    x1="16"
                    y1="9"
                    x2="22"
                    y2="15"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <line
                    x1="22"
                    y1="9"
                    x2="16"
                    y2="15"
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
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M11 5L6 9H2v6h4l5 4V5z" />
                  <path
                    d="M15.54 8.46a5 5 0 010 7.07"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M19.07 4.93a10 10 0 010 14.14"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </button>
            {/* Volume slider — hidden on narrow */}
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => onVolumeChange(Number(e.target.value))}
              className="hidden sm:block h-1 w-0 cursor-pointer appearance-none rounded-full bg-white/20 accent-degen-400 transition-all group-hover/vol:w-20 focus:w-20 focus:outline-none"
              aria-label="Volume"
              style={{
                background: `linear-gradient(to right, #00ff41 ${volumePercent}%, rgba(255,255,255,0.2) ${volumePercent}%)`,
              }}
            />
          </div>

          {/* Fullscreen */}
          {fullscreenSupported && (
            <button
              type="button"
              onClick={onFullscreen}
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-degen-400/60"
              aria-label="Fullscreen"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

// ─── Video Player Component ──────────────────────────────────────────────

export const VideoPlayer = memo(function VideoPlayer({
  src,
  poster,
  title,
  platform = 'direct',
  aspectRatio = '16:9',
  className = '',
  youtubeId,
  onSwipeUp,
  onSwipeDown,
  onPlay: onPlayCb,
  onPause: onPauseCb,
  onEnded: onEndedCb,
  onError: onErrorCb,
  showMetadata = true,
  channelName,
  views,
}: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartRef = useRef<{ y: number; x: number } | null>(null);

  // ── State ──
  const [inView, setInView] = useState(false);
  const [userInitiated, setUserInitiated] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isVertical, setIsVertical] = useState(aspectRatio === '9:16');
  const [showPlayOverlay, setShowPlayOverlay] = useState(true);

  const fullscreenSupported = typeof document !== 'undefined' && document.fullscreenEnabled;

  // ── Detect reduced motion preference ──
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // ── IntersectionObserver: auto-pause when out of view ──
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const isInView = !!entry?.isIntersecting;
        setInView(isInView);
        if (!isInView && playing) {
          videoRef.current?.pause();
        }
      },
      { threshold: [0.3, 0.7] },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [playing]);

  // ── Lazy load: start loading when in view or user initiates ──
  const shouldLoad = inView || userInitiated;

  // ── YouTube embed mode ──
  const isYouTube = platform === 'youtube' || !!youtubeId;

  // ── Controls auto-hide timer ──
  const resetControlsTimer = useCallback(() => {
    setControlsVisible(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    if (playing) {
      controlsTimerRef.current = setTimeout(() => {
        setControlsVisible(false);
      }, CONTROLS_HIDE_DELAY);
    }
  }, [playing]);

  useEffect(() => {
    if (playing && !reducedMotion) {
      resetControlsTimer();
    }
    return () => {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    };
  }, [playing, reducedMotion, resetControlsTimer]);

  // ── Video event handlers ──
  const handlePlayPauseToggle = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play();
    } else {
      video.pause();
    }
  }, []);

  const handleVideoPlay = useCallback(() => {
    setPlaying(true);
    setLoading(false);
    setShowPlayOverlay(false);
    onPlayCb?.();
  }, [onPlayCb]);

  const handleVideoPause = useCallback(() => {
    setPlaying(false);
    setControlsVisible(true);
    onPauseCb?.();
  }, [onPauseCb]);

  const handleVideoEnded = useCallback(() => {
    setPlaying(false);
    setShowPlayOverlay(true);
    setControlsVisible(true);
    onEndedCb?.();
  }, [onEndedCb]);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setCurrentTime(video.currentTime);
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setDuration(video.duration);
    setLoading(false);

    // Auto-detect vertical aspect ratio
    if (video.videoHeight > video.videoWidth && aspectRatio === 'auto') {
      setIsVertical(true);
    }
  }, [aspectRatio]);

  const handleProgress = useCallback(() => {
    const video = videoRef.current;
    if (!video?.buffered.length) return;
    setBuffered(video.buffered.end(video.buffered.length - 1));
  }, []);

  const handleVideoError = useCallback(() => {
    const video = videoRef.current;
    const message = video?.error?.message ?? 'Video failed to load';
    setError(message);
    setLoading(false);
    onErrorCb?.(message);
  }, [onErrorCb]);

  const handleSeek = useCallback((t: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = t;
    setCurrentTime(t);
  }, []);

  const handleVolumeChange = useCallback((v: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = v;
    video.muted = v === 0;
    setVolume(v);
    setMuted(v === 0);
  }, []);

  const handleMuteToggle = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  }, []);

  const handleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void el.requestFullscreen();
    }
  }, []);

  // ── Play on click on the "pre-play" overlay ──
  const handleInitiatePlay = useCallback(() => {
    setUserInitiated(true);
    // Small delay to allow the video element to mount before playing
    setTimeout(() => {
      videoRef.current?.play().catch(() => {
        setError('Playback was blocked');
      });
    }, 50);
  }, []);

  // ── Global keyboard shortcuts ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Only intercept if this player is the active/focused one
      if (document.activeElement && !containerRef.current?.contains(document.activeElement)) {
        return;
      }
      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          if (!isYouTube) handlePlayPauseToggle();
          break;
        case 'f':
          e.preventDefault();
          handleFullscreen();
          break;
        case 'm':
          e.preventDefault();
          handleMuteToggle();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (!isYouTube) handleSeek(Math.max(0, currentTime - SEEK_STEP));
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (!isYouTube) handleSeek(Math.min(duration, currentTime + SEEK_STEP));
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (!isYouTube) handleVolumeChange(Math.min(1, volume + VOLUME_STEP));
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (!isYouTube) handleVolumeChange(Math.max(0, volume - VOLUME_STEP));
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    isYouTube,
    handlePlayPauseToggle,
    handleFullscreen,
    handleMuteToggle,
    handleSeek,
    currentTime,
    duration,
    handleVolumeChange,
    volume,
  ]);

  // ── Keyboard shortcuts (container level, for focus without tab) ──
  const handleContainerKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          if (isYouTube) return; // Let iframe handle its own controls
          handlePlayPauseToggle();
          break;
        case 'f':
          e.preventDefault();
          handleFullscreen();
          break;
        case 'm':
          e.preventDefault();
          handleMuteToggle();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (!isYouTube) handleSeek(Math.max(0, currentTime - SEEK_STEP));
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (!isYouTube) handleSeek(Math.min(duration, currentTime + SEEK_STEP));
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (!isYouTube) handleVolumeChange(Math.min(1, volume + VOLUME_STEP));
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (!isYouTube) handleVolumeChange(Math.max(0, volume - VOLUME_STEP));
          break;
      }
    },
    [
      isYouTube,
      handlePlayPauseToggle,
      handleFullscreen,
      handleMuteToggle,
      handleSeek,
      currentTime,
      duration,
      handleVolumeChange,
      volume,
    ],
  );

  // ── Swipe gesture for short-form vertical videos ──
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      if (!touch) return;
      touchStartRef.current = {
        y: touch.clientY,
        x: touch.clientX,
      };
    }
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStartRef.current) return;
      const touch = e.changedTouches[0];
      if (!touch) return;
      const dy = touch.clientY - touchStartRef.current.y;
      const dx = touch.clientX - touchStartRef.current.x;
      touchStartRef.current = null;

      // Only trigger swipe for vertical videos and if vertical movement dominates
      if (!isVertical || Math.abs(dy) < SWIPE_THRESHOLD || Math.abs(dy) < Math.abs(dx) * 1.5)
        return;

      if (dy < 0) {
        onSwipeUp?.();
      } else {
        onSwipeDown?.();
      }
    },
    [isVertical, onSwipeUp, onSwipeDown],
  );

  // ── Thumbnail URL ──
  const thumbnailUrl = getThumbnailUrl(youtubeId, poster);

  // ─── Render ──────────────────────────────────────────────────────────

  const aspectRatioClass =
    aspectRatio === '9:16'
      ? 'aspect-[9/16]'
      : aspectRatio === 'auto'
        ? 'aspect-video'
        : 'aspect-video';

  // YouTube embed iframe
  if (isYouTube && shouldLoad && userInitiated) {
    const youTubeUrl = `https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0&modestbranding=1`;
    return (
      <div
        ref={containerRef}
        className={`relative overflow-hidden rounded-xl bg-black ${aspectRatioClass} ${className}`}
      >
        <iframe
          src={youTubeUrl}
          className="h-full w-full"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          title={title ?? 'YouTube video'}
          loading="lazy"
        />
        {/* Metadata overlay at bottom */}
        {showMetadata && (channelName || title) && (
          <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/70 to-transparent px-3 pb-3 pt-8 pointer-events-none">
            {title && (
              <p className="text-sm font-semibold text-white drop-shadow-lg line-clamp-1">
                {title}
              </p>
            )}
            {channelName && <p className="mt-0.5 text-[11px] text-white/70">{channelName}</p>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      role="application"
      aria-label={title ? `Video player: ${title}` : 'Video player'}
      className={`relative overflow-hidden rounded-xl bg-black select-none group ${aspectRatioClass} ${isVertical ? 'max-h-[80vh]' : ''} ${className}`}
      onMouseMove={resetControlsTimer}
      onMouseEnter={() => setControlsVisible(true)}
      onMouseLeave={() => {
        if (playing) setControlsVisible(false);
      }}
      onKeyDown={handleContainerKeyDown}
      onTouchStart={isVertical ? handleTouchStart : undefined}
      onTouchEnd={isVertical ? handleTouchEnd : undefined}
    >
      {/* ── Pre-play: thumbnail + play button ── */}
      {!userInitiated && thumbnailUrl && (
        <div className="absolute inset-0 z-10">
          {/* biome-ignore lint/performance/noImgElement: external video thumbnail — can't optimize with next/Image */}
          <img
            src={thumbnailUrl}
            alt={title ? `Thumbnail for ${title}` : 'Video thumbnail'}
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
            fetchpriority={userInitiated ? undefined : 'high'}
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
          {/* Title overlay */}
          {title && (
            <div className="absolute bottom-16 left-3 right-3">
              <p className="text-sm font-semibold text-white drop-shadow-lg line-clamp-2">
                {title}
              </p>
              {channelName && <p className="mt-0.5 text-[11px] text-white/60">{channelName}</p>}
            </div>
          )}
          {/* Play button */}
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              type="button"
              onClick={handleInitiatePlay}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition-all hover:scale-110 hover:bg-white/25 focus:outline-none focus:ring-2 focus:ring-degen-400/60"
              aria-label={title ? `Play ${title}` : 'Play video'}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M8 5V19L19 12L8 5Z" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ── Native <video> element ── */}
      {!isYouTube && shouldLoad && (
        <>
          {
            // biome-ignore lint/a11y/useMediaCaption: feed videos don't have caption tracks
          }
          <video
            ref={videoRef}
            src={src}
            poster={userInitiated ? undefined : thumbnailUrl}
            className={`h-full w-full object-contain ${loading ? 'opacity-0' : 'opacity-100'}`}
            playsInline
            preload={userInitiated ? 'auto' : 'metadata'}
            onPlay={handleVideoPlay}
            onPause={handleVideoPause}
            onEnded={handleVideoEnded}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onProgress={handleProgress}
            onError={handleVideoError}
            onClick={handlePlayPauseToggle}
            aria-label={title ?? 'Video'}
          />

          {/* ── Loading spinner ── */}
          {loading && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <div
                className={`h-8 w-8 rounded-full border-2 border-white/20 border-t-degen-400 ${
                  reducedMotion ? 'animate-none' : 'animate-spin'
                }`}
                role="status"
                aria-label="Loading video"
              />
            </div>
          )}

          {/* ── Centered play/pause overlay (shown when paused, hidden during playback) ── */}
          {!playing && !loading && !error && !showPlayOverlay && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M8 5V19L19 12L8 5Z" />
                </svg>
              </div>
            </div>
          )}

          {/* ── Error state ── */}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 gap-3 px-4">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
                className="text-red-400"
              >
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
                <line
                  x1="12"
                  y1="8"
                  x2="12"
                  y2="13"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <circle cx="12" cy="16" r="1" fill="currentColor" />
              </svg>
              <p className="text-xs text-center text-white/70">Video unavailable</p>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setLoading(true);
                  setUserInitiated(false);
                  setTimeout(() => {
                    setUserInitiated(true);
                  }, 100);
                }}
                className="rounded-lg bg-white/10 px-4 py-1.5 text-xs text-white hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-degen-400/60"
              >
                Retry
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Controls overlay (hidden during pre-play) ── */}
      {userInitiated && !isYouTube && !error && (
        <Controls
          playing={playing}
          muted={muted}
          volume={volume}
          currentTime={currentTime}
          duration={duration}
          buffered={buffered}
          onPlayPause={handlePlayPauseToggle}
          onMuteToggle={handleMuteToggle}
          onVolumeChange={handleVolumeChange}
          onSeek={handleSeek}
          onFullscreen={handleFullscreen}
          fullscreenSupported={fullscreenSupported}
          visible={controlsVisible}
        />
      )}

      {/* ── Short-form vertical swipe hint ── */}
      {isVertical && !playing && !userInitiated && (
        <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2">
          <div className="flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 text-[10px] text-white/60 backdrop-blur-sm">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M12 5v14M5 12l7-7 7 7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Swipe
          </div>
        </div>
      )}

      {/* ── Metadata footer ── */}
      {showMetadata && !userInitiated && !isYouTube && (channelName || title) && (
        <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/70 to-transparent px-3 pb-3 pt-8 pointer-events-none">
          {title && (
            <p className="text-sm font-semibold text-white drop-shadow-lg line-clamp-1">{title}</p>
          )}
          <div className="mt-0.5 flex items-center gap-2">
            {channelName && <span className="text-[11px] text-white/70">{channelName}</span>}
            {views != null && (
              <span className="text-[11px] text-white/50">{formatCount(views)} views</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
