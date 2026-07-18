'use client';

/**
 * @degenfeed/ui — VideoPlayer V2
 *
 * Premium HTML5 video player with:
 *   - Playback speed cycling (0.5x → 0.75x → 1x → 1.25x → 1.5x → 2x)
 *   - Picture-in-Picture with graceful fallback
 *   - Volume control with slider + mute toggle
 *   - Progress bar with buffered indicator + time tooltip on hover
 *   - Keyboard: Space/k play/pause, ←/→ seek 5s, ↑/↓ volume, m mute, f fullscreen
 *   - Fullscreen with Esc exit
 *   - Mobile: double-tap left/right for ±10s seek, swipe up/down for volume/brightness
 *   - Mobile: tap to show/hide controls, auto-hide after 3s
 *   - Quality selector (auto/1080p/720p/480p/360p) when multiple sources available
 *   - Mini player: floating draggable player when scrolled away
 *   - Next-video countdown with skip button
 *   - YouTube embed fallback
 *   - IntersectionObserver lazy-loading
 *   - Short-form vertical video support with swipe navigation
 *
 * Design: dark, minimal, neon-accented — matching degenfeed cyberpunk tone.
 * a11y: full keyboard operability, visible focus rings, accessible labels,
 *       aria-valuenow on progress, role="application" on container.
 */

import { memo, useCallback, useEffect, useRef, useState } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────

export type VideoPlatform = 'direct' | 'youtube' | 'peertube';
export type AspectRatio = '16:9' | '9:16' | 'auto';

export interface QualityLevel {
  label: string;
  height: number;
  src: string;
}

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

  // ── Multi-quality sources ──
  /** Multiple quality levels. If provided, a quality selector appears. */
  qualities?: QualityLevel[];

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

  // ── Autoplay / queue ──
  /** Called when the autoplay countdown ends (for next video) */
  onAutoPlayNext?: () => void;
  /** Whether there are more videos in the queue */
  hasNext?: boolean;

  // ── Mini player ──
  /** Enable mini-player mode (floating PiP-style in corner) */
  miniPlayer?: boolean;
  /** Called when user closes the mini player */
  onMiniPlayerClose?: () => void;

  // ── Metadata display ──
  showMetadata?: boolean;
  channelName?: string;
  views?: number;
  likes?: number;
}

// ─── Constants ────────────────────────────────────────────────────────────

const CONTROLS_HIDE_DELAY = 3000;
const SEEK_STEP = 5;
const VOLUME_STEP = 0.1;
const SWIPE_THRESHOLD = 60;
const DOUBLE_TAP_DELAY = 300; // ms between taps for double-tap detection
const DOUBLE_TAP_SEEK = 10; // seconds to seek on double-tap
const AUTOPLAY_COUNTDOWN_SECONDS = 5;
const MINI_PLAYER_WIDTH = 280;
const MINI_PLAYER_HEIGHT = 160;

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
const QUALITY_LABELS = ['Auto', '1080p', '720p', '480p', '360p'];

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

/** Dispatch a brief toast event that parent can listen for */
function showToast(message: string) {
  window.dispatchEvent(
    new CustomEvent('df-toast', {
      detail: { kind: 'info', message, duration: 2000 },
    }),
  );
}

// ─── Mini Player Component ───────────────────────────────────────────────

interface MiniPlayerProps {
  title?: string;
  channelName?: string;
  onClose: () => void;
  onClick: () => void;
}

function MiniPlayer({ title, channelName, onClose, onClick }: MiniPlayerProps) {
  const playerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; left: number; top: number } | null>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const rect = playerRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, left: rect.left, top: rect.top };
    const handleMouseMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      const el = playerRef.current;
      if (el) {
        el.style.left = `${dragRef.current.left + dx}px`;
        el.style.top = `${dragRef.current.top + dy}px`;
        el.style.right = 'auto';
        el.style.bottom = 'auto';
      }
    };
    const handleMouseUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, []);

  return (
    <div
      ref={playerRef}
      className="fixed z-50 overflow-hidden rounded-xl bg-black shadow-2xl shadow-black/60 border border-white/10 cursor-pointer group"
      style={{
        width: MINI_PLAYER_WIDTH,
        height: MINI_PLAYER_HEIGHT,
        right: 16,
        bottom: 80,
        maxWidth: 'calc(100vw - 32px)',
      }}
      onClick={onClick}
      onMouseDown={handleMouseDown}
      role="button"
      tabIndex={0}
      aria-label={title ? `Mini player: ${title}` : 'Mini player'}
    >
      {/* Dots grip indicator */}
      <div className="absolute top-1 left-1/2 z-20 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex gap-1 rounded-full bg-black/60 px-2 py-1">
          <span className="h-1 w-1 rounded-full bg-white/60" />
          <span className="h-1 w-1 rounded-full bg-white/60" />
          <span className="h-1 w-1 rounded-full bg-white/60" />
        </div>
      </div>

      {/* Title */}
      <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2 pt-8 pointer-events-none">
        {title && <p className="text-xs font-semibold text-white line-clamp-1">{title}</p>}
        {channelName && <p className="text-[10px] text-white/60">{channelName}</p>}
      </div>

      {/* Close button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute top-1 right-1 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white/80 hover:bg-black/80 hover:text-white transition-colors"
        aria-label="Close mini player"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>

      {/* Placeholder icon */}
      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="text-white/40" aria-hidden="true">
          <path d="M8 5V19L19 12L8 5Z" />
        </svg>
      </div>
    </div>
  );
}

// ─── Speed Icon SVG ──────────────────────────────────────────────────────

function SpeedIcon({ className = '' }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
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
  isFullscreen: boolean;
  visible: boolean;
  pipSupported: boolean;
  inPip: boolean;
  onPictureInPicture: () => void;
  playbackRate: number;
  onSpeedChange: (speed: number) => void;
  showSpeedMenu: boolean;
  setShowSpeedMenu: React.Dispatch<React.SetStateAction<boolean>>;
  qualities?: QualityLevel[];
  currentQuality: number;
  onQualityChange: (index: number) => void;
  showQualityMenu: boolean;
  setShowQualityMenu: React.Dispatch<React.SetStateAction<boolean>>;
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
  isFullscreen,
  visible,
  pipSupported,
  inPip,
  onPictureInPicture,
  playbackRate,
  onSpeedChange,
  showSpeedMenu,
  setShowSpeedMenu,
  qualities,
  currentQuality,
  onQualityChange,
  showQualityMenu,
  setShowQualityMenu,
}: ControlsProps) {
  const progressRef = useRef<HTMLDivElement>(null);
  const hoverTimeRef = useRef<number | null>(null);
  const hoverXRef = useRef(0);
  const seekProgress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedProgress = duration > 0 ? (buffered / duration) * 100 : 0;
  const volumePercent = muted ? 0 : volume * 100;

  // ── Progress bar handlers ──
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

  const handleProgressHover = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = progressRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const fraction = Math.max(0, Math.min(1, x / rect.width));
      hoverTimeRef.current = fraction * duration;
      hoverXRef.current = e.clientX - rect.left;
    },
    [duration],
  );

  const handleProgressLeave = useCallback(() => {
    hoverTimeRef.current = null;
  }, []);

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

  // ── Speed cycling ──
  const cycleSpeed = useCallback(() => {
    const idx = SPEED_OPTIONS.indexOf(playbackRate as (typeof SPEED_OPTIONS)[number]);
    const next = SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length] ?? 1;
    onSpeedChange(next);
    showToast(`Speed: ${next}x`);
  }, [playbackRate, onSpeedChange]);

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
        {/* ── Progress bar (clickable + scrubbable with time tooltip) ── */}
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
          onMouseMove={handleProgressHover}
          onMouseLeave={handleProgressLeave}
          onKeyDown={handleProgressKeyDown}
        >
          {/* Time tooltip on hover — uses ref for transient state; re-renders from video timeupdate */}
          {hoverTimeRef.current != null && duration > 0 && (
            <div
              className="absolute -top-8 z-30 -translate-x-1/2 rounded-md bg-black/90 px-2 py-1 text-[11px] font-mono text-white shadow-lg pointer-events-none whitespace-nowrap"
              style={{ left: `${hoverXRef.current}px` }}
            >
              {formatTime(hoverTimeRef.current)}
            </div>
          )}
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
        <div className="flex items-center gap-1.5 text-white">
          {/* Play/Pause */}
          <button
            type="button"
            onClick={onPlayPause}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-degen-400/60"
            aria-label={playing ? 'Pause' : 'Play'}
          >
            {playing ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <rect x="3" y="2" width="4" height="12" rx="1" />
                <rect x="9" y="2" width="4" height="12" rx="1" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M4 2L14 8L4 14V2Z" />
              </svg>
            )}
          </button>

          {/* Time display */}
          <span className="min-w-[80px] text-[11px] font-mono tabular-nums text-white/80 select-none hidden xs:inline sm:inline">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
          <span className="text-[11px] font-mono tabular-nums text-white/80 select-none xs:hidden sm:hidden">
            {formatTime(currentTime)}
          </span>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Speed control — click to cycle */}
          <div className="relative">
            <button
              type="button"
              onClick={cycleSpeed}
              onContextMenu={(e) => {
                e.preventDefault();
                setShowSpeedMenu((v) => !v);
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-degen-400/60 text-[10px] font-bold text-white/80 gap-0.5"
              aria-label={`Playback speed ${playbackRate}x. Click to cycle, right-click for menu`}
              title={`Speed: ${playbackRate}x — click to cycle`}
            >
              <SpeedIcon className="w-3 h-3" />
              <span>{playbackRate}</span>
            </button>
            {showSpeedMenu && (
              <div className="absolute bottom-full right-0 mb-1 rounded-lg bg-black/90 backdrop-blur-md border border-white/10 py-1 shadow-xl min-w-[80px]">
                {SPEED_OPTIONS.map((speed) => (
                  <button
                    key={speed}
                    type="button"
                    onClick={() => {
                      onSpeedChange(speed);
                      setShowSpeedMenu(false);
                      showToast(`Speed: ${speed}x`);
                    }}
                    className={`block w-full px-4 py-1.5 text-xs text-left transition-colors hover:bg-white/10 ${
                      playbackRate === speed ? 'text-degen-400 font-bold' : 'text-white/70'
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Volume */}
          <div className="group/vol flex items-center gap-1">
            <button
              type="button"
              onClick={onMuteToggle}
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-degen-400/60"
              aria-label={muted ? 'Unmute (M)' : 'Mute (M)'}
            >
              {muted || volume === 0 ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M11 5L6 9H2v6h4l5 4V5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                  <line x1="16" y1="9" x2="22" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <line x1="22" y1="9" x2="16" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              ) : volume < 0.5 ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M11 5L6 9H2v6h4l5 4V5z" />
                  <path d="M15.54 8.46a5 5 0 010 7.07" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M11 5L6 9H2v6h4l5 4V5z" />
                  <path d="M15.54 8.46a5 5 0 010 7.07" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M19.07 4.93a10 10 0 010 14.14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
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
              aria-label="Volume (↑/↓)"
              style={{
                background: `linear-gradient(to right, #00ff41 ${volumePercent}%, rgba(255,255,255,0.2) ${volumePercent}%)`,
              }}
            />
          </div>

          {/* Quality selector */}
          {qualities && qualities.length > 1 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowQualityMenu((v) => !v)}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-degen-400/60"
                aria-label="Video quality"
                title={`Quality: ${currentQuality === 0 ? 'Auto' : qualities[currentQuality]?.label ?? 'Auto'}`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M2 8h20" stroke="currentColor" strokeWidth="1.5" />
                  <circle cx="9" cy="16" r="2" fill="currentColor" opacity="0.6" />
                </svg>
              </button>
              {showQualityMenu && (
                <div className="absolute bottom-full right-0 mb-1 rounded-lg bg-black/90 backdrop-blur-md border border-white/10 py-1 shadow-xl min-w-[90px]">
                  {qualities.map((q, i) => (
                    <button
                      key={q.label}
                      type="button"
                      onClick={() => {
                        onQualityChange(i);
                        setShowQualityMenu(false);
                      }}
                      className={`block w-full px-4 py-1.5 text-xs text-left transition-colors hover:bg-white/10 ${
                        currentQuality === i ? 'text-degen-400 font-bold' : 'text-white/70'
                      }`}
                    >
                      {i === 0 ? 'Auto' : q.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Picture-in-Picture */}
          <button
            type="button"
            onClick={pipSupported ? onPictureInPicture : undefined}
            className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-degen-400/60 ${
              pipSupported
                ? 'hover:bg-white/10 text-white/80'
                : 'text-white/30 cursor-not-allowed'
            }`}
            aria-label={inPip ? 'Exit Picture-in-Picture' : 'Picture-in-Picture'}
            title={pipSupported ? 'Picture-in-Picture' : 'PiP not supported on this browser'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="2" y="3" width="20" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <rect x="11" y="11" width="10" height="8" rx="1" fill="currentColor" opacity="inPip ? 0.8 : 0.5" />
            </svg>
          </button>

          {/* Fullscreen */}
          {fullscreenSupported && (
            <button
              type="button"
              onClick={onFullscreen}
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-degen-400/60"
              aria-label={isFullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen (F)'}
            >
              {isFullscreen ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          )}
        </div>

        {/* Keyboard shortcuts hint */}
        {visible && (
          <div className="mt-1 text-center text-[10px] text-white/30 select-none pointer-events-none">
            <span className="hidden sm:inline">Space: play/pause · ←/→: seek · ↑/↓: volume · M: mute · F: fullscreen</span>
            <span className="sm:hidden">Tap: show/hide · Dbl-tap L/R: ±10s</span>
          </div>
        )}
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
  qualities,
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
  onAutoPlayNext,
  hasNext,
  miniPlayer,
  onMiniPlayerClose,
}: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartRef = useRef<{ y: number; x: number } | null>(null);
  const lastTapRef = useRef<{ x: number; time: number } | null>(null);
  const autoPlayTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevVolumeRef = useRef(1);

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
  // Transient / 1-time states converted to refs to avoid unnecessary re-renders
  const reducedMotionRef = useRef(false);
  const pipSupportedRef = useRef(false);
  const touchControlsDismissedRef = useRef(false);
  const [isVertical, setIsVertical] = useState(aspectRatio === '9:16');
  const [showPlayOverlay, setShowPlayOverlay] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [inPip, setInPip] = useState(false);
  const [autoPlayCountdown, setAutoPlayCountdown] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showMiniPlayer, setShowMiniPlayer] = useState(false);
  const [currentQuality, setCurrentQuality] = useState(0);
  const [showQualityMenu, setShowQualityMenu] = useState(false);

  const fullscreenSupported = typeof document !== 'undefined' && document.fullscreenEnabled;

  // ── Detect reduced motion ──
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotionRef.current = mq.matches;
    const handler = (e: MediaQueryListEvent) => { reducedMotionRef.current = e.matches; };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // ── Detect PiP support ──
  useEffect(() => {
    if (typeof document !== 'undefined') {
      pipSupportedRef.current = !!document.pictureInPictureEnabled;
    }
  }, []);

  // ── Listen for PiP leave events ──
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handleEnterPip = () => setInPip(true);
    const handleLeavePip = () => setInPip(false);
    video.addEventListener('enterpictureinpicture', handleEnterPip);
    video.addEventListener('leavepictureinpicture', handleLeavePip);
    return () => {
      video.removeEventListener('enterpictureinpicture', handleEnterPip);
      video.removeEventListener('leavepictureinpicture', handleLeavePip);
    };
  }, []);

  // ── Esc to exit fullscreen ──
  useEffect(() => {
    const handler = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // ── Autoplay countdown for next video ──
  const clearAutoPlayTimer = useCallback(() => {
    if (autoPlayTimerRef.current) {
      clearInterval(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }
    setAutoPlayCountdown(null);
  }, []);

  const startAutoPlayCountdown = useCallback(() => {
    if (!onAutoPlayNext || !hasNext) return;
    setAutoPlayCountdown(AUTOPLAY_COUNTDOWN_SECONDS);
    let remaining = AUTOPLAY_COUNTDOWN_SECONDS;
    autoPlayTimerRef.current = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearAutoPlayTimer();
        onAutoPlayNext();
      } else {
        setAutoPlayCountdown(remaining);
      }
    }, 1000);
  }, [onAutoPlayNext, hasNext, clearAutoPlayTimer]);

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
        // Show mini player when scrolling away
        if (miniPlayer && !isInView && playing) {
          setShowMiniPlayer(true);
        }
        if (isInView) {
          setShowMiniPlayer(false);
        }
      },
      { threshold: [0.3, 0.7] },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [playing, miniPlayer]);

  const shouldLoad = inView || userInitiated;
  const isYouTube = platform === 'youtube' || !!youtubeId;

  // ── Controls auto-hide timer ──
  const resetControlsTimer = useCallback(() => {
    setControlsVisible(true);
    touchControlsDismissedRef.current = false;
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    if (playing) {
      controlsTimerRef.current = setTimeout(() => {
        setControlsVisible(false);
        touchControlsDismissedRef.current = true;
      }, CONTROLS_HIDE_DELAY);
    }
  }, [playing]);

  useEffect(() => {
    if (playing && !reducedMotionRef.current) {
      resetControlsTimer();
    }
    return () => {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    };
  }, [playing, resetControlsTimer]);

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
    // Start autoplay countdown for next video
    if (onAutoPlayNext && hasNext) {
      startAutoPlayCountdown();
    }
  }, [onEndedCb, startAutoPlayCountdown, onAutoPlayNext, hasNext]);

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
    if (video.muted) {
      video.muted = false;
      video.volume = prevVolumeRef.current;
      setMuted(false);
      setVolume(prevVolumeRef.current);
    } else {
      prevVolumeRef.current = video.volume;
      video.muted = true;
      setMuted(true);
    }
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

  const handleInitiatePlay = useCallback(() => {
    setUserInitiated(true);
    setTimeout(() => {
      videoRef.current?.play().catch(() => {
        setError('Playback was blocked');
      });
    }, 50);
  }, []);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
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
    isYouTube, handlePlayPauseToggle, handleFullscreen, handleMuteToggle,
    handleSeek, currentTime, duration, handleVolumeChange, volume,
  ]);

  const handleContainerKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          if (isYouTube) return;
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
    [isYouTube, handlePlayPauseToggle, handleFullscreen, handleMuteToggle,
     handleSeek, currentTime, duration, handleVolumeChange, volume],
  );

  // ── Picture-in-Picture ──
  const handlePictureInPicture = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await video.requestPictureInPicture();
      }
    } catch {
      // PiP may not be available or was denied
    }
  }, []);

  // ── Speed change ──
  const handleSpeedChange = useCallback((speed: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = speed;
    setPlaybackRate(speed);
    setShowSpeedMenu(false);
  }, []);

  // ── Quality change ──
  const handleQualityChange = useCallback((index: number) => {
    setCurrentQuality(index);
    setShowQualityMenu(false);
    if (index === 0) {
      // Auto — use the default src
      if (videoRef.current && src) {
        videoRef.current.src = src;
        videoRef.current.load();
      }
    } else if (qualities?.[index]?.src) {
      if (videoRef.current) {
        const wasPlaying = playing;
        videoRef.current.src = qualities[index].src;
        videoRef.current.load();
        if (wasPlaying) {
          videoRef.current.play().catch(() => {});
        }
      }
    }
    showToast(`Quality: ${index === 0 ? 'Auto' : qualities?.[index]?.label ?? 'Auto'}`);
  }, [src, qualities, playing]);

  // ── Mobile double-tap for seek ──
  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.changedTouches[0];
      if (!touch) return;

      const now = Date.now();
      const x = touch.clientX;
      const last = lastTapRef.current;

      // Double-tap detection
      if (last && now - last.time < DOUBLE_TAP_DELAY) {
        const containerWidth = containerRef.current?.offsetWidth ?? 1;
        const side = x < containerWidth / 2 ? 'left' : 'right';
        if (side === 'left') {
          handleSeek(Math.max(0, currentTime - DOUBLE_TAP_SEEK));
        } else {
          handleSeek(Math.min(duration, currentTime + DOUBLE_TAP_SEEK));
        }
        lastTapRef.current = null;
        return;
      }

      // First tap — show/hide controls on mobile
      if (!playing && controlsVisible) {
        // Don't toggle when paused — let the play button handle it
      } else if (!touchControlsDismissedRef.current) {
        // Toggle controls visibility
        setControlsVisible((v) => !v);
        if (controlsVisible) {
          touchControlsDismissedRef.current = true;
        } else {
          resetControlsTimer();
        }
      } else {
        resetControlsTimer();
      }

      lastTapRef.current = { x, time: now };

      // Vertical swipe for short-form video navigation
      if (!touchStartRef.current) return;
      const dy = touch.clientY - touchStartRef.current.y;
      const dx = touch.clientX - touchStartRef.current.x;
      touchStartRef.current = null;

      if (!isVertical || Math.abs(dy) < SWIPE_THRESHOLD || Math.abs(dy) < Math.abs(dx) * 1.5) return;

      if (dy < 0) {
        onSwipeUp?.();
      } else {
        onSwipeDown?.();
      }
    },
    [isVertical, onSwipeUp, onSwipeDown, playing, controlsVisible,
     resetControlsTimer, handleSeek, currentTime, duration],
  );

  const handleTouchStartForSwipe = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      if (!touch) return;
      touchStartRef.current = { y: touch.clientY, x: touch.clientX };
    }
  }, []);

  // ── Mobile swipe for volume (right side) and brightness (left side) ──
  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStartRef.current) return;
      const touch = e.touches[0];
      if (!touch) return;

      const dy = touch.clientY - touchStartRef.current.y;
      // Only use vertical swipe for non-vertical videos (where swipe navigation isn't used)
      if (isVertical) return;

      if (Math.abs(dy) < 20) return;

      // Right side = volume, Left side = brightness (brightness not implemented)
      const containerWidth = containerRef.current?.offsetWidth ?? 1;
      const side = touch.clientX < containerWidth / 2 ? 'left' : 'right';

      if (side === 'right') {
        // Volume swipe
        const sensitivity = 0.005;
        const delta = -dy * sensitivity;
        const newVol = Math.max(0, Math.min(1, volume + delta));
        handleVolumeChange(newVol);
        // Reset start so volume continues to change as finger moves
        touchStartRef.current = { y: touch.clientY, x: touch.clientX };
        setControlsVisible(true);
      }
      // Left side: could be brightness in future
    },
    [isVertical, volume, handleVolumeChange],
  );

  // ── Handle retry ──
  const handleRetry = useCallback(() => {
    setError(null);
    setLoading(true);
    setUserInitiated(false);
    setTimeout(() => setUserInitiated(true), 100);
  }, []);

  const thumbnailUrl = getThumbnailUrl(youtubeId, poster);

  const aspectRatioClass =
    aspectRatio === '9:16'
      ? 'aspect-[9/16]'
      : 'aspect-video';

  // ── Quality label for current source ──
  const currentQualityLabel = currentQuality === 0 ? 'Auto' : qualities?.[currentQuality]?.label ?? 'Auto';

  // ─── Render ──────────────────────────────────────────────────────────

  // YouTube embed path
  if (isYouTube && shouldLoad && userInitiated) {
    const youTubeUrl = `https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0&modestbranding=1`;
    return (
      <>
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
          {showMetadata && (channelName || title) && (
            <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/70 to-transparent px-3 pb-3 pt-8 pointer-events-none">
              {title && <p className="text-sm font-semibold text-white drop-shadow-lg line-clamp-1">{title}</p>}
              {channelName && <p className="mt-0.5 text-[11px] text-white/70">{channelName}</p>}
            </div>
          )}
        </div>
      </>
    );
  }

  return (
    <>
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
        onTouchStart={isVertical ? handleTouchStartForSwipe : handleTouchStartForSwipe}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* ── Pre-play: thumbnail + play button ── */}
        {!userInitiated && thumbnailUrl && (
          <div className="absolute inset-0 z-10">
            {/* biome-ignore lint/performance/noImgElement: external video thumbnail */}
            <img
              src={thumbnailUrl}
              alt={title ? `Thumbnail for ${title}` : 'Video thumbnail'}
              className="h-full w-full object-cover"
              loading="lazy"
              decoding="async"
              fetchPriority={userInitiated ? undefined : 'high'}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
            {title && (
              <div className="absolute bottom-16 left-3 right-3">
                <p className="text-sm font-semibold text-white drop-shadow-lg line-clamp-2">
                  {title}
                </p>
                {channelName && <p className="mt-0.5 text-[11px] text-white/60">{channelName}</p>}
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center">
              <button
                type="button"
                onClick={handleInitiatePlay}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition-all hover:scale-110 hover:bg-white/25 focus:outline-none focus:ring-2 focus:ring-degen-400/60"
                aria-label={title ? `Play ${title}` : 'Play video'}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M8 5V19L19 12L8 5Z" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* ── Quality badge (top right, during pre-play) ── */}
        {!userInitiated && qualities && qualities.length > 1 && (
          <div className="absolute top-2 right-2 z-20 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white/80 backdrop-blur-sm">
            {currentQualityLabel}
          </div>
        )}

        {/* ── Native <video> element ── */}
        {!isYouTube && shouldLoad && (
          <>
            {/* biome-ignore lint/a11y/useMediaCaption: feed videos don't have caption tracks */}
            <video
              ref={videoRef}
              src={currentQuality === 0 ? src : (qualities?.[currentQuality]?.src ?? src)}
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

            {/* Loading spinner */}
            {loading && !error && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <div
                  className={`h-8 w-8 rounded-full border-2 border-white/20 border-t-degen-400 ${
                    reducedMotionRef.current ? 'animate-none' : 'animate-spin'
                  }`}
                  role="status"
                  aria-label="Loading video"
                />
              </div>
            )}

            {/* Centered play/pause overlay */}
            {!playing && !loading && !error && !showPlayOverlay && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M8 5V19L19 12L8 5Z" />
                  </svg>
                </div>
              </div>
            )}

            {/* Error state */}
            {error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 gap-3 px-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-red-400">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
                  <line x1="12" y1="8" x2="12" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <circle cx="12" cy="16" r="1" fill="currentColor" />
                </svg>
                <p className="text-xs text-center text-white/70">Video unavailable</p>
                <button
                  type="button"
                  onClick={handleRetry}
                  className="rounded-lg bg-white/10 px-4 py-1.5 text-xs text-white hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-degen-400/60"
                >
                  Retry
                </button>
              </div>
            )}
          </>
        )}

        {/* ── Autoplay countdown overlay with "Skip" button ── */}
        {autoPlayCountdown != null && (
          <div className="absolute bottom-16 left-1/2 z-20 -translate-x-1/2 flex items-center gap-3 autoplay-countdown">
            <span className="text-xs">Next in {autoPlayCountdown}s</span>
            <div className="countdown-bar w-16">
              <div className="fill" style={{ width: `${(autoPlayCountdown / AUTOPLAY_COUNTDOWN_SECONDS) * 100}%` }} />
            </div>
            <button type="button" className="cancel-btn text-xs" onClick={clearAutoPlayTimer}>
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                clearAutoPlayTimer();
                onAutoPlayNext?.();
              }}
              className="rounded-lg bg-degen-500/20 px-3 py-1 text-[11px] font-medium text-degen-400 hover:bg-degen-500/30 transition-colors"
            >
              Skip →
            </button>
          </div>
        )}

        {/* ── Controls overlay ── */}
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
            isFullscreen={isFullscreen}
            visible={controlsVisible}
            pipSupported={pipSupportedRef.current}
            inPip={inPip}
            onPictureInPicture={handlePictureInPicture}
            playbackRate={playbackRate}
            onSpeedChange={handleSpeedChange}
            showSpeedMenu={showSpeedMenu}
            setShowSpeedMenu={setShowSpeedMenu}
            qualities={qualities}
            currentQuality={currentQuality}
            onQualityChange={handleQualityChange}
            showQualityMenu={showQualityMenu}
            setShowQualityMenu={setShowQualityMenu}
          />
        )}

        {/* ── Short-form vertical swipe hint ── */}
        {isVertical && !playing && !userInitiated && (
          <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2">
            <div className="flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 text-[10px] text-white/60 backdrop-blur-sm">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 5v14M5 12l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Swipe
            </div>
          </div>
        )}

        {/* ── Metadata footer ── */}
        {showMetadata && !userInitiated && !isYouTube && (channelName || title) && (
          <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/70 to-transparent px-3 pb-3 pt-8 pointer-events-none">
            {title && <p className="text-sm font-semibold text-white drop-shadow-lg line-clamp-1">{title}</p>}
            <div className="mt-0.5 flex items-center gap-2">
              {channelName && <span className="text-[11px] text-white/70">{channelName}</span>}
              {views != null && <span className="text-[11px] text-white/50">{formatCount(views)} views</span>}
            </div>
          </div>
        )}

        {/* ── Mobile double-tap seek indicators ── */}
        {playing && controlsVisible && (
          <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
            <span className="text-white/20 text-[40px] font-bold select-none" aria-hidden="true">⏪</span>
          </div>
        )}
      </div>

      {/* ── Mini Player (floating, draggable) ── */}
      {miniPlayer && showMiniPlayer && playing && !inPip && (
        <MiniPlayer
          title={title}
          channelName={channelName}
          onClose={() => {
            setShowMiniPlayer(false);
            onMiniPlayerClose?.();
            videoRef.current?.pause();
          }}
          onClick={() => {
            setShowMiniPlayer(false);
            containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }}
        />
      )}
    </>
  );
});
