'use client';

import { IconClose, IconWifi } from './StreamIcons';
import type { PlaybackSettings, StreamExtended } from './types';

interface StreamOverlayProps {
  stream: StreamExtended;
  settings: PlaybackSettings;
  estimatedMbps: number | null;
  showControls: boolean;
  isPlaying: boolean;
  showSettings: boolean;
  onTogglePlay: () => void;
  onClose?: () => void;
  onCycleSpeed: () => void;
  onToggleBandwidthSaver: () => void;
  onToggleLowLatency: () => void;
  onShowControlsTemporarily: () => void;
}

export function StreamOverlay({
  stream,
  settings,
  estimatedMbps,
  showControls,
  isPlaying,
  showSettings,
  onTogglePlay,
  onClose,
  onCycleSpeed,
  onToggleBandwidthSaver,
  onToggleLowLatency,
  onShowControlsTemporarily,
}: StreamOverlayProps) {
  return (
    <>
      {/* Top gradient */}
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
          {estimatedMbps && settings.bandwidthSaver && (
            <span
              className="rounded-md bg-black/40 px-2 py-1 text-[9px] text-white/40 backdrop-blur-sm"
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
            <IconClose />
          </button>
        )}
      </div>

      {/* Center play overlay */}
      {!isPlaying && (
        <button
          type="button"
          onClick={onTogglePlay}
          className="absolute inset-0 z-15 flex items-center justify-center bg-black/40 transition-opacity hover:bg-black/50"
          aria-label="Play"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-degen-500/90 text-black shadow-2xl transition-transform hover:scale-110">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <polygon points="6 3 20 12 6 21 6 3" />
            </svg>
          </div>
        </button>
      )}

      {/* Keyboard shortcuts */}
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

      {/* Settings popover */}
      {showSettings && (
        <div
          className="absolute bottom-16 right-3 z-30 w-52 rounded-xl border border-white/10 bg-gray-900/95 p-3 backdrop-blur-xl shadow-2xl"
          onMouseEnter={() => {
            /* keep alive */
          }}
          onMouseLeave={onShowControlsTemporarily}
        >
          <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-white/40">
            Playback Settings
          </h3>

          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs text-white/70">Speed</span>
            <button
              type="button"
              onClick={onCycleSpeed}
              className="rounded bg-white/10 px-2 py-0.5 text-xs text-white/90 hover:bg-white/20"
            >
              {settings.speed}x
            </button>
          </div>

          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs text-white/70">Bandwidth Saver</span>
            <button
              type="button"
              onClick={onToggleBandwidthSaver}
              className={`rounded px-2 py-0.5 text-[10px] ${
                settings.bandwidthSaver
                  ? 'bg-degen-500/20 text-degen-400'
                  : 'bg-white/10 text-white/60'
              }`}
            >
              {settings.bandwidthSaver ? 'ON' : 'OFF'}
            </button>
          </div>

          {stream.lowLatency && (
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs text-white/70">Low Latency</span>
              <button
                type="button"
                onClick={onToggleLowLatency}
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

          {estimatedMbps && (
            <div className="mt-2 border-t border-white/10 pt-2 text-[9px] text-white/40">
              Connection: {estimatedMbps.toFixed(1)} Mbps
              {settings.bandwidthSaver && (
                <span className="ml-2">
                  →{' '}
                  {estimatedMbps > 12
                    ? '1080p'
                    : estimatedMbps > 5
                      ? '720p'
                      : estimatedMbps > 2
                        ? '480p'
                        : '360p'}
                </span>
              )}
            </div>
          )}

          <div className="mt-2 border-t border-white/10 pt-2 text-[9px] text-white/30">
            <p>Space/K: Play/Pause · M: Mute · F: Fullscreen</p>
            <p>A: Audio-only · P: PiP · Shift+&gt;: Speed</p>
          </div>
        </div>
      )}
    </>
  );
}
