'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  QUALITY_OPTIONS,
  type PlaybackMode,
  type PlaybackSettings,
  type StreamExtended,
  type StreamQuality,
} from './types';

/* ─── Hooks ──────────────────────────────────────────────────── */

/**
 * Bandwidth detection hook.
 * Estimates available bandwidth using a lightweight probe and selects optimal quality.
 */
function useBandwidthDetect(settings: PlaybackSettings) {
  const [estimatedMbps, setEstimatedMbps] = useState<number | null>(null);
  const [detecting, setDetecting] = useState(false);

  const runDetection = useCallback(async () => {
    if (!settings.bandwidthSaver) return;
    setDetecting(true);
    const start = performance.now();
    try {
      // Fetch a small probe chunk from CDN
      const probeUrl = 'https://cdn.degenfeed.xyz/probe/1MB.bin?t=' + Date.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const resp = await fetch(probeUrl, {
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(timeout);
      if (!resp.ok) throw new Error('probe failed');
      const blob = await resp.blob();
      const durationMs = performance.now() - start;
      const mbits = (blob.size * 8) / durationMs / 1000;
      setEstimatedMbps(mbits);
    } catch {
      // Fallback: assume moderate bandwidth
      setEstimatedMbps(5);
    }
    setDetecting(false);
  }, [settings.bandwidthSaver]);

  useEffect(() => {
    if (settings.bandwidthSaver) {
      runDetection();
      // Re-detect every 60 seconds
      const interval = setInterval(runDetection, 60000);
      return () => clearInterval(interval);
    }
  }, [settings.bandwidthSaver, runDetection]);

  return { estimatedMbps, detecting };
}

/**
 * Audio-only / background play hook.
 * On mobile, preserves audio playback when app is backgrounded.
 */
function useBackgroundAudio(isPlaying: boolean, mode: PlaybackMode) {
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (mode === 'audio-only' && isPlaying) {
      // Create an offscreen AudioContext to persist audio in background
      // (mobile browsers pause <video> but AudioContext can survive)
      try {
        const ctx = new AudioContext();
        audioCtxRef.current = ctx;
        // Resume after any autoplay policy
        if (ctx.state === 'suspended') ctx.resume();
      } catch {
        // AudioContext not available
      }
    }

    return () => {
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
    };
  }, [mode, isPlaying]);
}

/**
 * Picture-in-Picture hook.
 * Manages PiP lifecycle across browsers.
 */
function usePictureInPicture(playerRef: React.RefObject<HTMLDivElement | null>) {
  const [pipActive, setPipActive] = useState(false);

  const enterPiP = useCallback(async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setPipActive(false);
        return;
      }
      // Find a <video> element inside the player
      const videoEl = playerRef.current?.querySelector('video');
      if (videoEl && 'requestPictureInPicture' in videoEl) {
        await (videoEl as HTMLVideoElement).requestPictureInPicture();
        setPipActive(true);
      }
    } catch {
      // PiP not supported or denied
      setPipActive(false);
    }
  }, [playerRef]);

  useEffect(() => {
    const handlePiPChange = () => {
      setPipActive(!!document.pictureInPictureElement);
    };
    document.addEventListener('enterpictureinpicture', handlePiPChange);
    document.addEventListener('leavepictureinpicture', handlePiPChange);
    return () => {
      document.removeEventListener('enterpictureinpicture', handlePiPChange);
      document.removeEventListener('leavepictureinpicture', handlePiPChange);
    };
  }, []);

  return { pipActive, enterPiP };
}

/* ─── Visualization ──────────────────────────────────────────── */

function VideoDisplay({
  stream,
  mode,
}: {
  stream: StreamExtended;
  mode: PlaybackMode;
}) {
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

  const showVideo = mode === 'video';

  return (
    <div
      className={`absolute inset-0 flex items-center justify-center bg-gradient-to-br ${gradients[stream.category] ?? 'from-gray-800 to-gray-900'}`}
    >
      {/* Actual video element for HLS/Livepeer playback */}
      {showVideo && stream.hlsUrl && (
        <video
          className="absolute inset-0 h-full w-full object-contain"
          src={stream.hlsUrl}
          autoPlay
          playsInline
          muted
          loop={!stream.isLive}
          poster={stream.thumbnailUrl}
        />
      )}

      {/* Fallback visual when no video source */}
      {(!showVideo || !stream.hlsUrl) && (
        <>
          {/* Noise texture */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            }}
          />
          {/* Center content */}
          <div className="relative z-10 flex flex-col items-center gap-4">
            {mode === 'audio-only' ? (
              /* Audio-only indicator: large waveform icon */
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-black/30 backdrop-blur-sm">
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="1.5"
                  opacity="0.6"
                  aria-hidden="true"
                >
                  <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                  <path d="M19 10v2a7 7 0 01-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              </div>
            ) : (
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
            )}
            <div className="text-center">
              <p className="text-sm font-medium text-white/60">{stream.title}</p>
              <p className="mt-1 text-xs text-white/40">
                {stream.viewerCount.toLocaleString()} watching
                {mode === 'audio-only' && '  •  Audio Only'}
              </p>
            </div>
          </div>
        </>
      )}

      {/* Audio-only badge overlay */}
      {mode === 'audio-only' && (
        <div className="absolute bottom-4 left-4 z-20 rounded-full bg-degen-500/80 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-black">
          Audio Only
        </div>
      )}
    </div>
  );
}

/* ─── Control Icons ──────────────────────────────────────────── */

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

function IconHeadphones({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 18v-6a9 9 0 0118 0v6" />
      <path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3z" />
      <path d="M3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z" />
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

function IconDownload({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function IconWifi({ quality }: { quality: number }) {
  const bars = quality > 5 ? 4 : quality > 3 ? 3 : quality > 1 ? 2 : 1;
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
      {[...Array(4)].map((_, i) => (
        <path
          key={i}
          d={
            [
              'M2 10.5a12 12 0 0120 0',
              'M6 14a8 8 0 0112 0',
              'M10 17.5a4 4 0 014 0',
              'M12 21a1 1 0 100-2 1 1 0 000 2',
            ][i]!
          }
          opacity={i < bars ? 1 : 0.25}
        />
      ))}
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

/* ─── StreamQualitySelector ──────────────────────────────────── */

function StreamQualitySelector({
  quality,
  onSelect,
  estimatedMbps,
}: {
  quality: StreamQuality;
  onSelect: (q: StreamQuality) => void;
  estimatedMbps: number | null;
}) {
  const [open, setOpen] = useState(false);

  // Adaptive bitrate suggestion based on bandwidth
  const adaptiveQuality = useCallback((): StreamQuality => {
    if (!estimatedMbps) return 'auto';
    if (estimatedMbps > 12) return '1080p';
    if (estimatedMbps > 5) return '720p';
    if (estimatedMbps > 2) return '480p';
    return '360p';
  }, [estimatedMbps]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 items-center gap-1 rounded-lg px-2 text-[11px] font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        aria-label="Video quality"
      >
        <IconSettings /> {quality}
      </button>
      {open && (
        <div className="absolute bottom-full right-0 mb-2 w-44 overflow-hidden rounded-xl border border-white/10 bg-gray-900/95 backdrop-blur-xl shadow-2xl">
          {QUALITY_OPTIONS.map((opt) => {
            // Mark adaptive suggestion
            const isAdaptive = opt.id === adaptiveQuality() && estimatedMbps !== null;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  onSelect(opt.id);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between px-3 py-2 text-xs transition-colors hover:bg-white/5 ${
                  quality === opt.id ? 'text-degen-400 bg-degen-500/10' : 'text-white/70'
                }`}
              >
                <span className="flex items-center gap-2">
                  {opt.label}
                  {isAdaptive && (
                    <span className="rounded bg-degen-500/20 px-1 text-[8px] text-degen-400">
                      BEST
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-1 text-[9px] text-white/40">
                  {opt.bitrate}
                </span>
              </button>
            );
          })}

          {/* Bandwidth indicator */}
          {estimatedMbps && (
            <div className="flex items-center gap-2 border-t border-white/10 px-3 py-2">
              <IconWifi quality={estimatedMbps} />
              <span className="text-[9px] text-white/40">
                {estimatedMbps.toFixed(1)} Mbps
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── StreamPlayer ───────────────────────────────────────────── */

interface StreamPlayerProps {
  stream: StreamExtended;
  onClose?: () => void;
  onTheaterToggle?: () => void;
  isTheater?: boolean;
  defaultSettings?: Partial<PlaybackSettings>;
  /** Called when the user wants to download a VOD (premium feature) */
  onDownload?: (stream: StreamExtended) => void;
  /** Whether the user has premium access for downloads */
  isPremium?: boolean;
}

export function StreamPlayer({
  stream,
  onClose,
  onTheaterToggle,
  isTheater = false,
  defaultSettings,
  onDownload,
  isPremium = false,
}: StreamPlayerProps) {
  // ─── Playback state ─────────────────────────────────────────────
  const [settings, setSettings] = useState<PlaybackSettings>({
    mode: defaultSettings?.mode ?? 'video',
    quality: defaultSettings?.quality ?? 'auto',
    volume: defaultSettings?.volume ?? 1,
    muted: defaultSettings?.muted ?? false,
    speed: defaultSettings?.speed ?? 1,
    lowLatency: defaultSettings?.lowLatency ?? stream.lowLatency ?? true,
    bandwidthSaver: defaultSettings?.bandwidthSaver ?? true,
  });

  const [isPlaying, setIsPlaying] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const playerRef = useRef<HTMLDivElement>(null);
  const controlsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  // ─── Hooks ──────────────────────────────────────────────────────
  const { estimatedMbps } = useBandwidthDetect(settings);
  const { pipActive, enterPiP } = usePictureInPicture(playerRef);
  useBackgroundAudio(isPlaying, settings.mode);

  // ─── Bandwidth-adaptive quality ─────────────────────────────────
  useEffect(() => {
    if (!settings.bandwidthSaver || !estimatedMbps || settings.quality !== 'auto') return;
    // Auto-select quality based on bandwidth
    if (estimatedMbps > 12) setSettings((s) => ({ ...s, quality: '1080p' }));
    else if (estimatedMbps > 5) setSettings((s) => ({ ...s, quality: '720p' }));
    else if (estimatedMbps > 2) setSettings((s) => ({ ...s, quality: '480p' }));
    else setSettings((s) => ({ ...s, quality: '360p' }));
  }, [estimatedMbps, settings.bandwidthSaver, settings.quality]);

  // ─── Controls ──────────────────────────────────────────────────
  const togglePlay = useCallback(() => setIsPlaying((v) => !v), []);

  const toggleMute = useCallback(() => {
    setSettings((s) => ({ ...s, muted: !s.muted }));
  }, []);

  const toggleAudioOnly = useCallback(() => {
    setSettings((s) => ({
      ...s,
      mode: s.mode === 'video' ? 'audio-only' : 'video',
    }));
  }, []);

  const toggleLowLatency = useCallback(() => {
    setSettings((s) => ({ ...s, lowLatency: !s.lowLatency }));
  }, []);

  const toggleBandwidthSaver = useCallback(() => {
    setSettings((s) => ({ ...s, bandwidthSaver: !s.bandwidthSaver }));
  }, []);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setSettings((s) => ({ ...s, volume: v, muted: v === 0 }));
  }, []);

  const handleQualitySelect = useCallback((q: StreamQuality) => {
    setSettings((s) => ({ ...s, quality: q }));
  }, []);

  // Speed change
  const cycleSpeed = useCallback(() => {
    setSettings((s) => {
      const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
      const idx = speeds.indexOf(s.speed);
      return { ...s, speed: speeds[(idx + 1) % speeds.length]! };
    });
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

  const handleDownload = useCallback(() => {
    if (!stream.isVOD && !stream.downloadUrl) return;
    if (onDownload) {
      onDownload(stream);
    } else if (stream.downloadUrl) {
      window.open(stream.downloadUrl, '_blank');
    }
  }, [stream, onDownload]);

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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'm':
          toggleMute();
          break;
        case 'f':
          handleFullscreen();
          break;
        case 'a':
          toggleAudioOnly();
          break;
        case '>':
        case '.':
          if (e.shiftKey) cycleSpeed();
          break;
        case 'p':
          enterPiP();
          break;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [togglePlay, toggleMute, handleFullscreen, toggleAudioOnly, cycleSpeed, enterPiP]);

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
      className="group relative w-full overflow-hidden bg-black focus:outline-none"
      style={{ aspectRatio: isTheater ? '21/9' : '16/9' }}
      onMouseMove={showControlsTemporarily}
      onMouseLeave={() => setShowControls(false)}
      onDoubleClick={handleFullscreen}
    >
      {/* Video / Audio display */}
      <VideoDisplay stream={stream} mode={settings.mode} />

      {/* Top gradients */}
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/60 to-transparent transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Top bar */}
      <div
        className={`absolute inset-x-0 top-0 z-20 flex items-center justify-between p-3 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-md bg-red-600 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-lg">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
            </span>
            {stream.isLive ? 'LIVE' : 'VOD'}
          </span>

          {/* Low latency badge */}
          {settings.lowLatency && stream.lowLatency && (
            <span className="rounded-md bg-degen-500/30 px-2 py-1 text-[9px] font-medium text-degen-300 backdrop-blur-sm">
              LL-HLS
            </span>
          )}

          <span className="truncate rounded-md bg-black/50 px-2 py-1 text-xs font-medium text-white/90 backdrop-blur-sm">
            {stream.title}
          </span>
          <span className="rounded-md bg-black/50 px-2 py-1 text-[10px] text-white/60 backdrop-blur-sm">
            {stream.viewerCount.toLocaleString()} watching
          </span>

          {/* Bandwidth indicator */}
          {estimatedMbps && settings.bandwidthSaver && (
            <span className="rounded-md bg-black/40 px-2 py-1 text-[9px] text-white/40 backdrop-blur-sm"
              title={`Estimated bandwidth: ${estimatedMbps.toFixed(1)} Mbps`}
            >
              <IconWifi quality={estimatedMbps} />
            </span>
          )}
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

      {/* Keyboard shortcuts hint (shown briefly on first interaction) */}
      {showControls && (
        <div className="absolute left-3 top-14 z-20 flex gap-2 transition-opacity duration-300">
          <span className="rounded bg-black/40 px-2 py-0.5 text-[9px] text-white/40 backdrop-blur-sm">
            Space: Play/Pause
          </span>
          <span className="rounded bg-black/40 px-2 py-0.5 text-[9px] text-white/40 backdrop-blur-sm">
            F: Fullscreen
          </span>
          <span className="rounded bg-black/40 px-2 py-0.5 text-[9px] text-white/40 backdrop-blur-sm">
            A: Audio-only
          </span>
        </div>
      )}

      {/* Progress bar (clickable) */}
      <div
        ref={progressRef}
        className={`absolute inset-x-0 bottom-14 z-20 h-1 cursor-pointer transition-all hover:h-1.5 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
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
        className={`absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-8 pb-2 px-3 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
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
              aria-label={settings.muted ? 'Unmute' : 'Mute'}
            >
              <IconVolume muted={settings.muted} />
            </button>
            <div className="w-0 overflow-hidden transition-all duration-200 group-hover:w-20">
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.muted ? 0 : settings.volume}
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

          {/* Speed indicator */}
          {settings.speed !== 1 && (
            <button
              type="button"
              onClick={cycleSpeed}
              className="flex h-6 items-center rounded-lg px-2 text-[10px] font-medium text-degen-400 transition-colors hover:bg-white/10"
              aria-label="Playback speed"
            >
              {settings.speed}x
            </button>
          )}

          <div className="flex-1" />

          {/* Audio-only toggle */}
          {stream.audioOnly && (
            <button
              type="button"
              onClick={toggleAudioOnly}
              className={`flex h-8 items-center gap-1 rounded-lg px-2 text-[11px] font-medium transition-colors hover:bg-white/10 ${
                settings.mode === 'audio-only'
                  ? 'text-degen-400 bg-degen-500/10'
                  : 'text-white/80'
              }`}
              aria-label={settings.mode === 'audio-only' ? 'Switch to video' : 'Audio-only mode'}
              title="Audio-only mode (A)"
            >
              <IconHeadphones size={14} />
              {settings.mode === 'audio-only' && <span>ON</span>}
            </button>
          )}

          {/* Low-latency toggle */}
          {stream.hlsUrl && stream.lowLatency && (
            <button
              type="button"
              onClick={toggleLowLatency}
              className={`flex h-8 items-center gap-1 rounded-lg px-2 text-[11px] font-medium transition-colors hover:bg-white/10 ${
                settings.lowLatency ? 'text-degen-400 bg-degen-500/10' : 'text-white/80'
              }`}
              aria-label="Toggle low latency"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              LL
            </button>
          )}

          {/* Quality selector with bandwidth display */}
          <StreamQualitySelector
            quality={settings.quality}
            onSelect={handleQualitySelect}
            estimatedMbps={estimatedMbps}
          />

          {/* Bandwidth saver toggle */}
          <button
            type="button"
            onClick={toggleBandwidthSaver}
            className={`flex h-8 items-center gap-1 rounded-lg px-2 text-[11px] font-medium transition-colors hover:bg-white/10 ${
              settings.bandwidthSaver ? 'text-degen-400 bg-degen-500/10' : 'text-white/80'
            }`}
            aria-label="Toggle bandwidth saver"
          >
            <IconWifi quality={settings.bandwidthSaver && estimatedMbps ? estimatedMbps : 5} />
          </button>

          {/* Speed / Settings */}
          <button
            type="button"
            onClick={() => setShowSettings((v) => !v)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="More settings"
          >
            <IconSettings />
          </button>

          {/* Theater mode */}
          <button
            type="button"
            onClick={onTheaterToggle}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            aria-label={isTheater ? 'Exit theater mode' : 'Theater mode'}
            title={isTheater ? 'Exit theater mode' : 'Theater mode'}
          >
            {isTheater ? <IconMinimize /> : <IconMaximize />}
          </button>

          {/* Picture-in-Picture */}
          <button
            type="button"
            onClick={enterPiP}
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-white/10 ${
              pipActive ? 'text-degen-400 bg-degen-500/10' : 'text-white/80'
            }`}
            aria-label={pipActive ? 'Exit picture-in-picture' : 'Picture-in-picture'}
          >
            <IconPiP />
          </button>

          {/* Download (VOD, premium) */}
          {(stream.downloadUrl || stream.isVOD) && (
            <button
              type="button"
              onClick={handleDownload}
              disabled={!isPremium}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-white/10 ${
                isPremium ? 'text-white/80' : 'text-white/30 cursor-not-allowed'
              }`}
              aria-label={
                isPremium
                  ? 'Download for offline viewing'
                  : 'Upgrade to premium for downloads'
              }
              title={
                isPremium
                  ? 'Download for offline viewing'
                  : 'Upgrade to premium for downloads'
              }
            >
              <IconDownload size={14} />
              {!isPremium && (
                <span className="ml-0.5 text-[8px] uppercase tracking-wider">PRO</span>
              )}
            </button>
          )}

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

      {/* Settings popover */}
      {showSettings && (
        <div
          className="absolute bottom-16 right-3 z-30 w-52 rounded-xl border border-white/10 bg-gray-900/95 p-3 backdrop-blur-xl shadow-2xl"
          onMouseEnter={() => {
            if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
          }}
          onMouseLeave={showControlsTemporarily}
        >
          <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-white/40">
            Playback Settings
          </h3>

          {/* Speed */}
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs text-white/70">Speed</span>
            <button
              type="button"
              onClick={cycleSpeed}
              className="rounded bg-white/10 px-2 py-0.5 text-xs text-white/90 hover:bg-white/20"
            >
              {settings.speed}x
            </button>
          </div>

          {/* Bandwidth saver */}
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs text-white/70">Bandwidth Saver</span>
            <button
              type="button"
              onClick={toggleBandwidthSaver}
              className={`rounded px-2 py-0.5 text-[10px] ${
                settings.bandwidthSaver
                  ? 'bg-degen-500/20 text-degen-400'
                  : 'bg-white/10 text-white/60'
              }`}
            >
              {settings.bandwidthSaver ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* Low latency (if available) */}
          {stream.lowLatency && (
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs text-white/70">Low Latency</span>
              <button
                type="button"
                onClick={toggleLowLatency}
                className={`rounded px-2 py-0.5 text-[10px] ${
                  settings.lowLatency
                    ? 'bg-degen-500/20 text-degen-400'
                    : 'bg-white/10 text-white/60'
                }`}
              >
                {settings.lowLatency ? 'LL-HLS' : 'Standard'}
              </button>
            </div>
          )}

          {/* Connection info */}
          {estimatedMbps && (
            <div className="mt-2 border-t border-white/10 pt-2 text-[9px] text-white/40">
              Connection: {estimatedMbps.toFixed(1)} Mbps
              {settings.bandwidthSaver && (
                <span className="ml-2">
                  → {estimatedMbps > 12 ? '1080p' : estimatedMbps > 5 ? '720p' : estimatedMbps > 2 ? '480p' : '360p'}
                </span>
              )}
            </div>
          )}

          {/* Keyboard shortcuts */}
          <div className="mt-2 border-t border-white/10 pt-2 text-[9px] text-white/30">
            <p>Space/K: Play/Pause · M: Mute · F: Fullscreen</p>
            <p>A: Audio-only · P: PiP · Shift+&gt;: Speed</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Helpers ────────────────────────────────────────────────── */

function formatDuration(_pct: number): string {
  const totalSec = Math.floor(_pct * 60);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
