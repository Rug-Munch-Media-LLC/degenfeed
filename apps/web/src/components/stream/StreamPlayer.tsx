'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { QUALITY_OPTIONS, type StreamExtended, type StreamQuality } from './types';

/* === Internal HLS/Mock Player ================================= */

function VideoDisplay({ stream }: { stream: StreamExtended }) {
  const gradients: Record<string, string> = {
    gaming: 'from-purple-600/30 via-violet-600/20 to-indigo-800/30',
    music: 'from-pink-600/30 via-rose-600/20 to-red-800/30',
    crypto: 'from-degen-500/20 via-emerald-600/20 to-green-800/30',
    art: 'from-orange-600/30 via-amber-600/20 to-yellow-800/30',
    irl: 'from-teal-600/30 via-cyan-600/20 to-blue-800/30',
    talk: 'from-yellow-600/30 via-amber-600/20 to-orange-800/30',
    education: 'from-blue-600/30 via-indigo-600/20 to-purple-800/30',
    sports: 'from-red-600/30 via-rose-600/20 to-pink-800/30',
    tech: 'from-cyan-600/30 via-sky-600/20 to-blue-800/30',
    trading: 'from-emerald-600/30 via-green-600/20 to-teal-800/30',
  };

  return (
    <div
      className={`absolute inset-0 flex items-center justify-center bg-gradient-to-br ${gradients[stream.category] ?? 'from-gray-800 to-gray-900'}`}
    >
      {/* Noise texture */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />
      {/* Center content */}
      <div className="relative z-10 flex flex-col items-center gap-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-black/30 backdrop-blur-sm">
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="white"
            opacity="0.6"
            aria-hidden="true"
          >
            <polygon points="6 3 20 12 6 21 6 3" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-white/60">{stream.title}</p>
          <p className="mt-1 text-xs text-white/40">
            {stream.viewerCount.toLocaleString()} watching
          </p>
        </div>
      </div>
    </div>
  );
}

/* === Control Icons ============================================ */

function IconPlay({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <polygon points="6 3 20 12 6 21 6 3" />
    </svg>
  );
}

function IconPause({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  );
}

function IconVolume({ muted }: { muted: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {muted ? (
        <>
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <line x1="23" y1="9" x2="17" y2="15" />
          <line x1="17" y1="9" x2="23" y2="15" />
        </>
      ) : (
        <>
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M15.54 8.46a5 5 0 010 7.07" />
          <path d="M19.07 4.93a10 10 0 010 14.14" />
        </>
      )}
    </svg>
  );
}

function IconMaximize() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  );
}

function IconMinimize() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="4 14 10 14 10 20" />
      <polyline points="20 10 14 10 14 4" />
      <line x1="14" y1="10" x2="21" y2="3" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  );
}

function IconPiP() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <rect x="11" y="9" width="8" height="6" rx="1" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}

/* === StreamPlayer ============================================= */

interface StreamPlayerProps {
  stream: StreamExtended;
  onClose?: () => void;
  onTheaterToggle?: () => void;
  isTheater?: boolean;
}

export function StreamPlayer({
  stream,
  onClose,
  onTheaterToggle,
  isTheater = false,
}: StreamPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [quality, setQuality] = useState<StreamQuality>('auto');
  const [showQuality, setShowQuality] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const playerRef = useRef<HTMLDivElement>(null);
  const controlsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const togglePlay = useCallback(() => setIsPlaying((v) => !v), []);
  const toggleMute = useCallback(() => setIsMuted((v) => !v), []);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    if (v === 0) setIsMuted(true);
    else setIsMuted(false);
  }, []);

  const handleFullscreen = useCallback(() => {
    if (!playerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
      setIsFullscreen(false);
    } else {
      playerRef.current.requestFullscreen();
      setIsFullscreen(true);
    }
  }, []);

  const handlePiP = useCallback(async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      }
    } catch {
      // PiP not supported
    }
  }, []);

  // Auto-hide controls
  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    controlsTimeout.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    };
  }, []);

  // Progress bar simulation
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setProgress((p) => (p >= 100 ? 0 : p + 0.1));
    }, 100);
    return () => clearInterval(interval);
  }, [isPlaying]);

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = (x / rect.width) * 100;
    setProgress(Math.max(0, Math.min(100, pct)));
  }, []);

  return (
    <div
      ref={playerRef}
      className="relative w-full overflow-hidden bg-black"
      style={{ aspectRatio: isTheater ? '21/9' : '16/9' }}
      onMouseMove={showControlsTemporarily}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* Video */}
      <VideoDisplay stream={stream} />

      {/* Top gradients */}
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/60 to-transparent transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}
      />

      {/* Top bar */}
      <div
        className={`absolute inset-x-0 top-0 z-20 flex items-center justify-between p-3 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-md bg-red-600 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-lg">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
            </span>
            LIVE
          </span>
          <span className="truncate rounded-md bg-black/50 px-2 py-1 text-xs font-medium text-white/90 backdrop-blur-sm">
            {stream.title}
          </span>
          <span className="rounded-md bg-black/50 px-2 py-1 text-[10px] text-white/60 backdrop-blur-sm">
            {stream.viewerCount.toLocaleString()} watching
          </span>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white/70 backdrop-blur-sm transition-colors hover:bg-black/60 hover:text-white"
            aria-label="Close player"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Center play overlay */}
      {!isPlaying && (
        <button
          type="button"
          onClick={togglePlay}
          className="absolute inset-0 z-15 flex items-center justify-center bg-black/40 transition-opacity hover:bg-black/50"
          aria-label="Play"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-degen-500/90 text-black shadow-2xl transition-transform hover:scale-110">
            <IconPlay size={28} />
          </div>
        </button>
      )}

      {/* Progress bar (clickable) */}
      <div
        ref={progressRef}
        className={`absolute inset-x-0 bottom-12 z-20 h-1 cursor-pointer transition-all hover:h-1.5 ${showControls ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleProgressClick}
      >
        <div className="h-full w-full bg-white/20">
          <div
            className="h-full bg-gradient-to-r from-degen-500 to-emerald-400 transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Bottom controls bar */}
      <div
        className={`absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-8 pb-2 px-3 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        <div className="flex items-center gap-1.5">
          {/* Play/Pause */}
          <button
            type="button"
            onClick={togglePlay}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <IconPause size={18} /> : <IconPlay size={18} />}
          </button>

          {/* Volume */}
          <div className="group flex items-center gap-1">
            <button
              type="button"
              onClick={toggleMute}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white"
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              <IconVolume muted={isMuted} />
            </button>
            <div className="w-0 overflow-hidden transition-all duration-200 group-hover:w-20">
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="h-1 w-20 cursor-pointer appearance-none rounded-full bg-white/20 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                aria-label="Volume"
              />
            </div>
          </div>

          {/* Stream info */}
          <span className="ml-2 text-[11px] text-white/60 tabular-nums">
            {formatDuration(progress)}
          </span>

          <div className="flex-1" />

          {/* Quality selector */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowQuality((v) => !v)}
              className="flex h-8 items-center gap-1 rounded-lg px-2 text-[11px] font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Video quality"
            >
              <IconSettings /> {quality}
            </button>
            {showQuality && (
              <div className="absolute bottom-full right-0 mb-2 w-36 overflow-hidden rounded-xl border border-white/10 bg-gray-900/95 backdrop-blur-xl shadow-2xl">
                {QUALITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setQuality(opt.id);
                      setShowQuality(false);
                    }}
                    className={`flex w-full items-center justify-between px-3 py-2 text-xs transition-colors hover:bg-white/5 ${
                      quality === opt.id ? 'text-degen-400 bg-degen-500/10' : 'text-white/70'
                    }`}
                  >
                    <span>{opt.label}</span>
                    <span className="text-[9px] text-white/40">{opt.bitrate}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Theater mode */}
          <button
            type="button"
            onClick={onTheaterToggle}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            aria-label={isTheater ? 'Exit theater mode' : 'Theater mode'}
            title={isTheater ? 'Exit theater mode' : 'Theater mode'}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              {isTheater ? (
                <>
                  <polyline points="4 14 10 14 10 20" />
                  <polyline points="20 10 14 10 14 4" />
                  <line x1="14" y1="10" x2="21" y2="3" />
                  <line x1="3" y1="21" x2="10" y2="14" />
                </>
              ) : (
                <>
                  <polyline points="15 3 21 3 21 9" />
                  <polyline points="9 21 3 21 3 15" />
                  <line x1="21" y1="3" x2="14" y2="10" />
                  <line x1="3" y1="21" x2="10" y2="14" />
                </>
              )}
            </svg>
          </button>

          {/* Picture-in-Picture */}
          <button
            type="button"
            onClick={handlePiP}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Picture in picture"
          >
            <IconPiP />
          </button>

          {/* Fullscreen */}
          <button
            type="button"
            onClick={handleFullscreen}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <IconMinimize /> : <IconMaximize />}
          </button>
        </div>
      </div>
    </div>
  );
}

/* === Helpers ================================================== */

function formatDuration(_pct: number): string {
  const totalSec = Math.floor(_pct * 60); // sim: 60 min full
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
