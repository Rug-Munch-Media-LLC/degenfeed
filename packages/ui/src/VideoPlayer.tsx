// ── God code split: moved to VideoPlayer/ directory ─────────────────────
// This file is now a thin re-export barrel for backward compatibility.
// Each concern lives in its own module under VideoPlayer/:
//   types.ts     — VideoPlatform, AspectRatio, QualityLevel, VideoPlayerProps
//   constants.ts — CONTROLS_HIDE_DELAY, SEEK_STEP, SPEED_OPTIONS, etc.
//   helpers.ts   — formatTime, formatCount, getThumbnailUrl, showToast
//   hooks.ts     — useVideoPlayer custom hook (all state + handlers)
//   Controls.tsx — Progress bar, play/pause, speed, volume, quality, PiP, fullscreen
//   MiniPlayer.tsx — Floating draggable mini player
//   index.tsx    — Main VideoPlayer component

export { formatCount, formatTime } from './VideoPlayer/helpers';
export { VideoPlayer } from './VideoPlayer/index';
export type {
  AspectRatio,
  QualityLevel,
  VideoPlatform,
  VideoPlayerProps,
} from './VideoPlayer/types';
