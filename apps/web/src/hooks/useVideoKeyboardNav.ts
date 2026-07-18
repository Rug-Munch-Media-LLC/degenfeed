'use client';

import { useCallback, useEffect } from 'react';

export interface VideoKeyboardActions {
  togglePlay: () => void;
  seekForward: (seconds?: number) => void;
  seekBackward: (seconds?: number) => void;
  toggleFullscreen: () => void;
  toggleMute: () => void;
  volumeUp: (delta?: number) => void;
  volumeDown: (delta?: number) => void;
}

/**
 * `useVideoKeyboardNav` — Keyboard controls for the VideoPlayer.
 *
 * Shortcuts (only when video is focused):
 *   Space       — Toggle play/pause
 *   Left Arrow  — Seek backward 10s
 *   Right Arrow — Seek forward 10s
 *   Up Arrow    — Volume up 0.1
 *   Down Arrow  — Volume down 0.1
 *   f / F       — Toggle fullscreen
 *   m / M       — Toggle mute
 *   Escape      — Exit fullscreen
 *
 * @param actions     Control callbacks
 * @param enabled     Disable when other elements are focused
 * @param videoRef    Ref to the video element
 */
export function useVideoKeyboardNav(
  actions: VideoKeyboardActions,
  enabled: boolean,
  videoRef: React.RefObject<HTMLVideoElement | null>,
) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;
      // Only handle when video or its container is focused
      const target = e.target as HTMLElement;
      const isVideoFocused =
        target === videoRef.current || target.closest('[data-video-container]') !== null;

      if (!isVideoFocused) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          actions.togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          actions.seekBackward(10);
          break;
        case 'ArrowRight':
          e.preventDefault();
          actions.seekForward(10);
          break;
        case 'ArrowUp':
          e.preventDefault();
          actions.volumeUp(0.1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          actions.volumeDown(0.1);
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          actions.toggleFullscreen();
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          actions.toggleMute();
          break;
        case 'Escape':
          // Let native Escape handle fullscreen exit
          break;
      }
    },
    [enabled, actions, videoRef],
  );

  useEffect(() => {
    if (!enabled) return;
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, handleKeyDown]);
}
