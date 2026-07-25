'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlaybackSettings, StreamQuality } from './types';

/**
 * Bandwidth detection hook.
 * Estimates available bandwidth using a lightweight probe.
 */
export function useBandwidthDetect(settings: PlaybackSettings) {
  const [estimatedMbps, setEstimatedMbps] = useState<number | null>(null);
  const [detecting, setDetecting] = useState(false);

  const runDetection = useCallback(async () => {
    if (!settings.bandwidthSaver) return;
    setDetecting(true);
    const start = performance.now();
    try {
      const probeUrl = `https://cdn.degenfeed.xyz/probe/1MB.bin?t=${Date.now()}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const resp = await fetch(probeUrl, { signal: controller.signal, cache: 'no-store' });
      clearTimeout(timeout);
      if (!resp.ok) throw new Error('probe failed');
      const blob = await resp.blob();
      const durationMs = performance.now() - start;
      const mbits = (blob.size * 8) / durationMs / 1000;
      setEstimatedMbps(mbits);
    } catch {
      setEstimatedMbps(5);
    }
    setDetecting(false);
  }, [settings.bandwidthSaver]);

  useEffect(() => {
    if (settings.bandwidthSaver) {
      runDetection();
      const interval = setInterval(runDetection, 60000);
      return () => clearInterval(interval);
    }
  }, [settings.bandwidthSaver, runDetection]);

  return { estimatedMbps, detecting };
}

/**
 * Audio-only / background play hook.
 */
export function useBackgroundAudio(isPlaying: boolean, mode: string) {
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (mode === 'audio-only' && isPlaying) {
      try {
        const ctx = new AudioContext();
        audioCtxRef.current = ctx;
        if (ctx.state === 'suspended') ctx.resume();
      } catch {
        /* AudioContext not available */
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
 */
export function usePictureInPicture(playerRef: React.RefObject<HTMLDivElement | null>) {
  const [pipActive, setPipActive] = useState(false);

  const enterPiP = useCallback(async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setPipActive(false);
        return;
      }
      const videoEl = playerRef.current?.querySelector('video');
      if (videoEl && 'requestPictureInPicture' in videoEl) {
        await (videoEl as HTMLVideoElement).requestPictureInPicture();
        setPipActive(true);
      }
    } catch {
      setPipActive(false);
    }
  }, [playerRef]);

  useEffect(() => {
    const handleChange = () => setPipActive(!!document.pictureInPictureElement);
    document.addEventListener('enterpictureinpicture', handleChange);
    document.addEventListener('leavepictureinpicture', handleChange);
    return () => {
      document.removeEventListener('enterpictureinpicture', handleChange);
      document.removeEventListener('leavepictureinpicture', handleChange);
    };
  }, []);

  return { pipActive, enterPiP };
}

/**
 * Adaptive quality selector based on bandwidth.
 */
export function useAdaptiveQuality(
  estimatedMbps: number | null,
  quality: StreamQuality,
  bandwidthSaver: boolean,
) {
  useEffect(() => {
    if (!bandwidthSaver || !estimatedMbps || quality !== 'auto') return;
    // handled by callback in player
  }, [estimatedMbps, bandwidthSaver, quality]);
}

export function getAdaptiveQuality(estimatedMbps: number | null): StreamQuality {
  if (!estimatedMbps) return 'auto';
  if (estimatedMbps > 12) return '1080p';
  if (estimatedMbps > 5) return '720p';
  if (estimatedMbps > 2) return '480p';
  return '360p';
}
