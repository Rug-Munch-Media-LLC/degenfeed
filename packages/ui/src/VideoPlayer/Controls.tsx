'use client';

import { memo, useCallback, useRef } from 'react';
import { SEEK_STEP, SPEED_OPTIONS } from './constants';
import { formatTime, showToast } from './helpers';
import type { QualityLevel } from './types';

// ─── Speed Icon SVG ──────────────────────────────────────────────────────

function SpeedIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}

// ─── Props ─────────────────────────────────────────────────────────────────

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

// ─── Component ─────────────────────────────────────────────────────────────

export const Controls = memo(function Controls({
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
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none" />
      <div className="relative z-10 px-3 pb-2 pt-8">
        {/* Progress bar */}
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
          {hoverTimeRef.current != null && duration > 0 && (
            <div
              className="absolute -top-8 z-30 -translate-x-1/2 rounded-md bg-black/90 px-2 py-1 text-[11px] font-mono text-white shadow-lg pointer-events-none whitespace-nowrap"
              style={{ left: `${hoverXRef.current}px` }}
            >
              {formatTime(hoverTimeRef.current)}
            </div>
          )}
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-white/30 transition-all"
            style={{ width: `${bufferedProgress}%` }}
          />
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-degen-400 transition-all"
            style={{ width: `${seekProgress}%` }}
          />
          <div
            className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-degen-400 shadow-lg shadow-degen-400/50 opacity-0 transition-all group-hover/progress:opacity-100"
            style={{ left: `calc(${seekProgress}% - 6px)` }}
          />
        </div>

        {/* Controls row */}
        <div className="flex items-center gap-1.5 text-white">
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
          <span className="min-w-[80px] text-[11px] font-mono tabular-nums text-white/80 select-none hidden xs:inline sm:inline">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
          <span className="text-[11px] font-mono tabular-nums text-white/80 select-none xs:hidden sm:hidden">
            {formatTime(currentTime)}
          </span>

          <div className="flex-1" />

          {/* Speed */}
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
              title={`Speed: ${playbackRate}x \u2014 click to cycle`}
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
                    className={`block w-full px-4 py-1.5 text-xs text-left transition-colors hover:bg-white/10 ${playbackRate === speed ? 'text-degen-400 font-bold' : 'text-white/70'}`}
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
              ) : volume < 0.5 ? (
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
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => onVolumeChange(Number(e.target.value))}
              className="hidden sm:block h-1 w-0 cursor-pointer appearance-none rounded-full bg-white/20 accent-degen-400 transition-all group-hover/vol:w-20 focus:w-20 focus:outline-none"
              aria-label="Volume (\u2191/\u2193)"
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
                title={`Quality: ${currentQuality === 0 ? 'Auto' : (qualities[currentQuality]?.label ?? 'Auto')}`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <rect
                    x="2"
                    y="4"
                    width="20"
                    height="16"
                    rx="2"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
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
                      className={`block w-full px-4 py-1.5 text-xs text-left transition-colors hover:bg-white/10 ${currentQuality === i ? 'text-degen-400 font-bold' : 'text-white/70'}`}
                    >
                      {i === 0 ? 'Auto' : q.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* PiP */}
          <button
            type="button"
            onClick={pipSupported ? onPictureInPicture : undefined}
            className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-degen-400/60 ${pipSupported ? 'hover:bg-white/10 text-white/80' : 'text-white/30 cursor-not-allowed'}`}
            aria-label={inPip ? 'Exit Picture-in-Picture' : 'Picture-in-Picture'}
            title={pipSupported ? 'Picture-in-Picture' : 'PiP not supported on this browser'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect
                x="2"
                y="3"
                width="20"
                height="18"
                rx="2"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <rect
                x="11"
                y="11"
                width="10"
                height="8"
                rx="1"
                fill="currentColor"
                opacity={inPip ? 0.8 : 0.5}
              />
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
                  <path
                    d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
          )}
        </div>

        {/* Keyboard shortcuts hint */}
        {visible && (
          <div className="mt-1 text-center text-[10px] text-white/30 select-none pointer-events-none">
            <span className="hidden sm:inline">
              Space: play/pause \u00b7 \u2190/\u2192: seek \u00b7 \u2191/\u2193: volume \u00b7 M:
              mute \u00b7 F: fullscreen
            </span>
            <span className="sm:hidden">Tap: show/hide \u00b7 Dbl-tap L/R: \u00b110s</span>
          </div>
        )}
      </div>
    </div>
  );
});
