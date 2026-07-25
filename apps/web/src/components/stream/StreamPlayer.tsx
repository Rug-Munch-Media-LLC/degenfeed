'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlaybackSettings, StreamQuality, StreamExtended } from './types';
import { useBandwidthDetect, useBackgroundAudio, usePictureInPicture } from './hooks';
import { VideoDisplay } from './VideoDisplay';
import { StreamControls } from './StreamControls';
import { StreamOverlay } from './StreamOverlay';

interface StreamPlayerProps {
  stream: StreamExtended;
  onClose?: () => void;
  onTheaterToggle?: () => void;
  isTheater?: boolean;
  defaultSettings?: Partial<PlaybackSettings>;
  onDownload?: (stream: StreamExtended) => void;
  isPremium?: boolean;
}

export function StreamPlayer({
  stream, onClose, onTheaterToggle, isTheater = false,
  defaultSettings, onDownload, isPremium = false,
}: StreamPlayerProps) {
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
  const [progress, setProgress] = useState(0);

  const playerRef = useRef<HTMLDivElement>(null);
  const controlsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const { estimatedMbps } = useBandwidthDetect(settings);
  const { pipActive, enterPiP } = usePictureInPicture(playerRef);
  useBackgroundAudio(isPlaying, settings.mode);

  // Adaptive quality
  useEffect(() => {
    if (!settings.bandwidthSaver || !estimatedMbps || settings.quality !== 'auto') return;
    if (estimatedMbps > 12) setSettings((s) => ({ ...s, quality: '1080p' }));
    else if (estimatedMbps > 5) setSettings((s) => ({ ...s, quality: '720p' }));
    else if (estimatedMbps > 2) setSettings((s) => ({ ...s, quality: '480p' }));
    else setSettings((s) => ({ ...s, quality: '360p' }));
  }, [estimatedMbps, settings.bandwidthSaver, settings.quality]);

  // Progress simulation
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => setProgress((p) => (p >= 100 ? 0 : p + 0.1)), 100);
    return () => clearInterval(interval);
  }, [isPlaying]);

  const togglePlay = useCallback(() => setIsPlaying((v) => !v), []);
  const toggleMute = useCallback(() => setSettings((s) => ({ ...s, muted: !s.muted })), []);
  const toggleAudioOnly = useCallback(() => setSettings((s) => ({ ...s, mode: s.mode === 'video' ? 'audio-only' : 'video' })), []);
  const toggleLowLatency = useCallback(() => setSettings((s) => ({ ...s, lowLatency: !s.lowLatency })), []);
  const toggleBandwidthSaver = useCallback(() => setSettings((s) => ({ ...s, bandwidthSaver: !s.bandwidthSaver })), []);
  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setSettings((s) => ({ ...s, volume: v, muted: v === 0 }));
  }, []);
  const handleQualitySelect = useCallback((q: StreamQuality) => setSettings((s) => ({ ...s, quality: q })), []);

  const cycleSpeed = useCallback(() => setSettings((s) => {
    const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
    const idx = speeds.indexOf(s.speed);
    return { ...s, speed: speeds[(idx + 1) % speeds.length]! };
  }), []);

  const handleFullscreen = useCallback(() => {
    if (!playerRef.current) return;
    if (document.fullscreenElement) { document.exitFullscreen(); setIsFullscreen(false); }
    else { playerRef.current.requestFullscreen(); setIsFullscreen(true); }
  }, []);

  const handleDownload = useCallback(() => {
    if (!stream.isVOD && !stream.downloadUrl) return;
    if (onDownload) onDownload(stream);
    else if (stream.downloadUrl) window.open(stream.downloadUrl, '_blank');
  }, [stream, onDownload]);

  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    controlsTimeout.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  useEffect(() => {
    return () => { if (controlsTimeout.current) clearTimeout(controlsTimeout.current); };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case ' ': case 'k': e.preventDefault(); togglePlay(); break;
        case 'm': toggleMute(); break;
        case 'f': handleFullscreen(); break;
        case 'a': toggleAudioOnly(); break;
        case '>': case '.': if (e.shiftKey) cycleSpeed(); break;
        case 'p': enterPiP(); break;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [togglePlay, toggleMute, handleFullscreen, toggleAudioOnly, cycleSpeed, enterPiP]);

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    setProgress(Math.max(0, Math.min(100, (x / rect.width) * 100)));
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
      <VideoDisplay stream={stream} mode={settings.mode} />

      <StreamOverlay
        stream={stream}
        settings={settings}
        estimatedMbps={estimatedMbps}
        showControls={showControls}
        isPlaying={isPlaying}
        showSettings={showSettings}
        onTogglePlay={togglePlay}
        onClose={onClose}
        onCycleSpeed={cycleSpeed}
        onToggleBandwidthSaver={toggleBandwidthSaver}
        onToggleLowLatency={toggleLowLatency}
        onShowControlsTemporarily={showControlsTemporarily}
      />

      <StreamControls
        isPlaying={isPlaying}
        settings={settings}
        estimatedMbps={estimatedMbps}
        pipActive={pipActive}
        isFullscreen={isFullscreen}
        isTheater={isTheater}
        stream={stream}
        isPremium={isPremium}
        progress={progress}
        onTogglePlay={togglePlay}
        onToggleMute={toggleMute}
        onToggleAudioOnly={toggleAudioOnly}
        onToggleLowLatency={toggleLowLatency}
        onToggleBandwidthSaver={toggleBandwidthSaver}
        onVolumeChange={handleVolumeChange}
        onQualitySelect={handleQualitySelect}
        onCycleSpeed={cycleSpeed}
        onFullscreen={handleFullscreen}
        onTheaterToggle={onTheaterToggle}
        onEnterPiP={enterPiP}
        onDownload={handleDownload}
        onShowSettings={() => setShowSettings((v) => !v)}
        onProgressClick={handleProgressClick}
        progressRef={progressRef}
        showControls={showControls}
      />
    </div>
  );
}
