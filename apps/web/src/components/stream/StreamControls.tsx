'use client';

import {
  IconDownload,
  IconHeadphones,
  IconMaximize,
  IconMinimize,
  IconPause,
  IconPiP,
  IconPlay,
  IconSettings,
  IconVolume,
  IconWifi,
} from './StreamIcons';
import { StreamQualitySelector } from './StreamQualitySelector';
import type { PlaybackSettings, StreamExtended, StreamQuality } from './types';

interface StreamControlsProps {
  isPlaying: boolean;
  settings: PlaybackSettings;
  estimatedMbps: number | null;
  pipActive: boolean;
  isFullscreen: boolean;
  isTheater: boolean;
  stream: StreamExtended;
  isPremium: boolean;
  progress: number;
  onTogglePlay: () => void;
  onToggleMute: () => void;
  onToggleAudioOnly: () => void;
  onToggleLowLatency: () => void;
  onToggleBandwidthSaver: () => void;
  onVolumeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onQualitySelect: (q: StreamQuality) => void;
  onCycleSpeed: () => void;
  onFullscreen: () => void;
  onTheaterToggle?: () => void;
  onEnterPiP: () => void;
  onDownload: () => void;
  onShowSettings: () => void;
  onProgressClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  progressRef: React.RefObject<HTMLDivElement | null>;
  showControls: boolean;
}

export function StreamControls({
  isPlaying,
  settings,
  estimatedMbps,
  pipActive,
  isFullscreen,
  isTheater,
  stream,
  isPremium,
  progress,
  onTogglePlay,
  onToggleMute,
  onToggleAudioOnly,
  onToggleLowLatency,
  onToggleBandwidthSaver,
  onShowSettings,
  onVolumeChange,
  onQualitySelect,
  onCycleSpeed,
  onFullscreen,
  onTheaterToggle,
  onEnterPiP,
  onDownload,
  showControls,
  onProgressClick,
  progressRef,
}: StreamControlsProps) {
  function formatDuration(pct: number): string {
    const totalSec = Math.floor(pct * 60);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  return (
    <>
      {/* Progress bar */}
      <div
        ref={progressRef}
        className={`absolute inset-x-0 bottom-14 z-20 h-1 cursor-pointer transition-all hover:h-1.5 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onProgressClick}
      >
        <div className="h-full w-full bg-white/20">
          <div
            className="h-full bg-gradient-to-r from-degen-500 to-emerald-400 transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Bottom bar */}
      <div
        className={`absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-8 pb-2 px-3 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onTogglePlay}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <IconPause size={18} /> : <IconPlay size={18} />}
          </button>

          <div className="group flex items-center gap-1">
            <button
              type="button"
              onClick={onToggleMute}
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
                onChange={onVolumeChange}
                className="h-1 w-20 cursor-pointer appearance-none rounded-full bg-white/20 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                aria-label="Volume"
              />
            </div>
          </div>

          <span className="ml-2 text-[11px] text-white/60 tabular-nums">
            {formatDuration(progress)}
          </span>

          {settings.speed !== 1 && (
            <button
              type="button"
              onClick={onCycleSpeed}
              className="flex h-6 items-center rounded-lg px-2 text-[10px] font-medium text-degen-400 transition-colors hover:bg-white/10"
              aria-label="Playback speed"
            >
              {settings.speed}x
            </button>
          )}

          <div className="flex-1" />

          {stream.audioOnly && (
            <button
              type="button"
              onClick={onToggleAudioOnly}
              className={`flex h-8 items-center gap-1 rounded-lg px-2 text-[11px] font-medium transition-colors hover:bg-white/10 ${
                settings.mode === 'audio-only' ? 'text-degen-400 bg-degen-500/10' : 'text-white/80'
              }`}
              aria-label={settings.mode === 'audio-only' ? 'Switch to video' : 'Audio-only mode'}
            >
              <IconHeadphones size={14} />
              {settings.mode === 'audio-only' && <span>ON</span>}
            </button>
          )}

          {stream.hlsUrl && stream.lowLatency && (
            <button
              type="button"
              onClick={onToggleLowLatency}
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

          <StreamQualitySelector
            quality={settings.quality}
            onSelect={onQualitySelect}
            estimatedMbps={estimatedMbps}
          />

          <button
            type="button"
            onClick={onToggleBandwidthSaver}
            className={`flex h-8 items-center gap-1 rounded-lg px-2 text-[11px] font-medium transition-colors hover:bg-white/10 ${
              settings.bandwidthSaver ? 'text-degen-400 bg-degen-500/10' : 'text-white/80'
            }`}
            aria-label="Toggle bandwidth saver"
          >
            <IconWifi quality={settings.bandwidthSaver && estimatedMbps ? estimatedMbps : 5} />
          </button>

          <button
            type="button"
            onClick={onShowSettings}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="More settings"
          >
            <IconSettings />
          </button>

          {onTheaterToggle && (
            <button
              type="button"
              onClick={onTheaterToggle}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white"
              aria-label={isTheater ? 'Exit theater mode' : 'Theater mode'}
            >
              {isTheater ? <IconMinimize /> : <IconMaximize />}
            </button>
          )}

          <button
            type="button"
            onClick={onEnterPiP}
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-white/10 ${
              pipActive ? 'text-degen-400 bg-degen-500/10' : 'text-white/80'
            }`}
            aria-label={pipActive ? 'Exit picture-in-picture' : 'Picture-in-picture'}
          >
            <IconPiP />
          </button>

          {(stream.downloadUrl || stream.isVOD) && (
            <button
              type="button"
              onClick={onDownload}
              disabled={!isPremium}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-white/10 ${
                isPremium ? 'text-white/80' : 'text-white/30 cursor-not-allowed'
              }`}
              aria-label={
                isPremium ? 'Download for offline viewing' : 'Upgrade to premium for downloads'
              }
            >
              <IconDownload size={14} />
              {!isPremium && (
                <span className="ml-0.5 text-[8px] uppercase tracking-wider">PRO</span>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onFullscreen}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <IconMinimize /> : <IconMaximize />}
          </button>
        </div>
      </div>
    </>
  );
}
