'use client';

import { useCallback, useState } from 'react';
import type { LiveStream } from './useLiveStreams';

/* === Types ==================================================== */

interface StreamPlayerProps {
  stream: LiveStream;
  onClose?: () => void;
  onFullscreen?: () => void;
}

/* === Play Icon ================================================ */

function PlayIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <polygon points="6 3 20 12 6 21 6 3" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  );
}

function VolumeIcon({ muted }: { muted: boolean }) {
  return (
    <svg
      width="20"
      height="20"
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

function FullscreenIcon() {
  return (
    <svg
      width="20"
      height="20"
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

function CloseIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

/* === Embbed Player (PeerTube / Huddle01) ===================== */

function VideoEmbed({ stream }: { stream: LiveStream }) {
  // Use a placeholder / gradient when no real embed is configured
  const gradients: Record<string, string> = {
    solo: 'from-indigo-600/30 to-purple-600/30',
    spaces: 'from-teal-600/30 to-emerald-600/30',
    collab: 'from-amber-600/30 to-orange-600/30',
    launch: 'from-pink-600/30 to-rose-600/30',
  };

  return (
    <div
      className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${gradients[stream.streamType] ?? gradients.solo}`}
    >
      <div className="flex flex-col items-center gap-3 opacity-50">
        <span className="text-5xl" aria-hidden="true">
          {stream.streamType === 'spaces'
            ? '🎙️'
            : stream.streamType === 'collab'
              ? '👥'
              : stream.streamType === 'launch'
                ? '🪙'
                : '🎥'}
        </span>
        <p className="text-sm font-medium text-white/70">
          {stream.streamType === 'spaces' ? 'Audio Space Active' : `${stream.title}`}
        </p>
        <p className="text-xs text-white/40">Stream URL not configured — embed placeholder</p>
      </div>
    </div>
  );
}

/* === Component ================================================ */

export function StreamPlayer({ stream, onClose, onFullscreen }: StreamPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);

  const togglePlay = useCallback(() => setIsPlaying((v) => !v), []);
  const toggleMute = useCallback(() => setIsMuted((v) => !v), []);

  return (
    <div className="group relative aspect-video w-full overflow-hidden rounded-xl bg-black">
      {/* Video embed area */}
      <VideoEmbed stream={stream} />

      {/* Top overlay gradient */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/50 to-transparent" />

      {/* Bottom overlay gradient */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/50 to-transparent" />

      {/* Center play/pause overlay */}
      {!isPlaying && (
        <button
          type="button"
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity hover:bg-black/40"
          aria-label="Play"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-degen-500/90 text-black shadow-xl transition-transform hover:scale-110">
            <PlayIcon />
          </div>
        </button>
      )}

      {/* Controls bar (bottom) */}
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 px-3 py-2 opacity-0 transition-opacity group-hover:opacity-100">
        {/* Play/Pause */}
        <button
          type="button"
          onClick={togglePlay}
          className="flex h-8 w-8 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>

        {/* Mute */}
        <button
          type="button"
          onClick={toggleMute}
          className="flex h-8 w-8 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          aria-label={isMuted ? 'Unmute' : 'Mute'}
        >
          <VolumeIcon muted={isMuted} />
        </button>

        {/* Viewer count */}
        <div className="ml-2 flex items-center gap-1 text-xs font-medium text-white/70">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          {stream.viewerCount}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Fullscreen */}
        <button
          type="button"
          onClick={onFullscreen}
          className="flex h-8 w-8 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Fullscreen"
        >
          <FullscreenIcon />
        </button>

        {/* Close */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close player"
          >
            <CloseIcon />
          </button>
        )}
      </div>

      {/* Stream info overlay (top-left) */}
      <div className="absolute left-3 top-3 z-10">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 rounded-md bg-red-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-lg">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
            </span>
            LIVE
          </span>
          <span className="truncate rounded-md bg-black/50 px-2 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
            {stream.title}
          </span>
        </div>
      </div>
    </div>
  );
}
