'use client';

/**
 * @degenfeed/ui — VideoPlayer V2
 *
 * Premium HTML5 video player with playback controls, PiP, mini player,
 * quality selector, keyboard shortcuts, mobile gestures, and more.
 *
 * SPLIT ARCHITECTURE:
 *   types.ts     — VideoPlatform, AspectRatio, QualityLevel, VideoPlayerProps
 *   constants.ts — CONTROLS_HIDE_DELAY, SEEK_STEP, SPEED_OPTIONS, etc.
 *   helpers.ts   — formatTime, formatCount, getThumbnailUrl, showToast
 *   hooks.ts     — useVideoPlayer custom hook (all state + handlers)
 *   Controls.tsx — Progress bar, play/pause, speed, volume, quality, PiP, fullscreen
 *   MiniPlayer.tsx — Floating draggable mini player
 *   index.tsx    — Main VideoPlayer component (this file)
 */

import { memo, useRef } from 'react';
import { Controls } from './Controls';
import { AUTOPLAY_COUNTDOWN_SECONDS } from './constants';
import { formatCount, getThumbnailUrl } from './helpers';
import { useVideoPlayer } from './hooks';
import { MiniPlayer } from './MiniPlayer';
import type { VideoPlayerProps } from './types';

export { formatCount, formatTime } from './helpers';
export type { AspectRatio, QualityLevel, VideoPlatform, VideoPlayerProps } from './types';

export const VideoPlayer = memo(function VideoPlayer({
  src,
  poster,
  title,
  platform = 'direct',
  aspectRatio = '16:9',
  className = '',
  qualities,
  youtubeId,
  onSwipeUp,
  onSwipeDown,
  onPlay: onPlayCb,
  onPause: onPauseCb,
  onEnded: onEndedCb,
  onError: onErrorCb,
  showMetadata = true,
  channelName,
  views,
  onAutoPlayNext,
  hasNext,
  miniPlayer,
  onMiniPlayerClose,
}: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, actions] = useVideoPlayer(containerRef, videoRef, {
    src,
    platform,
    aspectRatio,
    qualities,
    miniPlayer,
    onPlayCb,
    onPauseCb,
    onEndedCb,
    onErrorCb,
    onAutoPlayNext,
    hasNext,
    onSwipeUp,
    onSwipeDown,
    onMiniPlayerClose,
  });

  const shouldLoad = state.inView || state.userInitiated;
  const isYouTube = platform === 'youtube' || !!youtubeId;
  const thumbnailUrl = getThumbnailUrl(youtubeId, poster);
  const aspectRatioClass = aspectRatio === '9:16' ? 'aspect-[9/16]' : 'aspect-video';
  const currentQualityLabel =
    state.currentQuality === 0 ? 'Auto' : (qualities?.[state.currentQuality]?.label ?? 'Auto');

  // YouTube embed path
  if (isYouTube && shouldLoad && state.userInitiated) {
    const youTubeUrl = `https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0&modestbranding=1`;
    return (
      <div
        ref={containerRef}
        className={`relative overflow-hidden rounded-xl bg-black ${aspectRatioClass} ${className}`}
      >
        <iframe
          src={youTubeUrl}
          className="h-full w-full"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          title={title ?? 'YouTube video'}
          loading="lazy"
        />
        {showMetadata && (channelName || title) && (
          <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/70 to-transparent px-3 pb-3 pt-8 pointer-events-none">
            {title && (
              <p className="text-sm font-semibold text-white drop-shadow-lg line-clamp-1">
                {title}
              </p>
            )}
            {channelName && <p className="mt-0.5 text-[11px] text-white/70">{channelName}</p>}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <div
        ref={containerRef}
        role="application"
        aria-label={title ? `Video player: ${title}` : 'Video player'}
        className={`relative overflow-hidden rounded-xl bg-black select-none group ${aspectRatioClass} ${state.isVertical ? 'max-h-[80vh]' : ''} ${className}`}
        onMouseMove={actions.resetControlsTimer}
        onMouseEnter={() => actions.setControlsVisible(true)}
        onMouseLeave={() => {
          if (state.playing) actions.setControlsVisible(false);
        }}
        onKeyDown={actions.handleContainerKeyDown}
        onTouchStart={actions.handleTouchStartForSwipe}
        onTouchMove={actions.handleTouchMove}
        onTouchEnd={actions.handleTouchEnd}
      >
        {/* Pre-play: thumbnail + play button */}
        {!state.userInitiated && thumbnailUrl && (
          <div className="absolute inset-0 z-10">
            {/* biome-ignore lint/performance/noImgElement: external video thumbnail */}
            <img
              src={thumbnailUrl}
              alt={title ? `Thumbnail for ${title}` : 'Video thumbnail'}
              className="h-full w-full object-cover"
              loading="lazy"
              decoding="async"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
            {title && (
              <div className="absolute bottom-16 left-3 right-3">
                <p className="text-sm font-semibold text-white drop-shadow-lg line-clamp-2">
                  {title}
                </p>
                {channelName && <p className="mt-0.5 text-[11px] text-white/60">{channelName}</p>}
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center">
              <button
                type="button"
                onClick={actions.handleInitiatePlay}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition-all hover:scale-110 hover:bg-white/25 focus:outline-none focus:ring-2 focus:ring-degen-400/60"
                aria-label={title ? `Play ${title}` : 'Play video'}
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M8 5V19L19 12L8 5Z" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Quality badge */}
        {!state.userInitiated && qualities && qualities.length > 1 && (
          <div className="absolute top-2 right-2 z-20 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white/80 backdrop-blur-sm">
            {currentQualityLabel}
          </div>
        )}

        {/* Native <video> */}
        {!isYouTube && shouldLoad && (
          <>
            {/* biome-ignore lint/a11y/useMediaCaption: feed videos don't have caption tracks */}
            <video
              ref={videoRef}
              src={
                state.currentQuality === 0 ? src : (qualities?.[state.currentQuality]?.src ?? src)
              }
              poster={state.userInitiated ? undefined : thumbnailUrl}
              className={`h-full w-full object-contain ${state.loading ? 'opacity-0' : 'opacity-100'}`}
              playsInline
              preload={state.userInitiated ? 'auto' : 'metadata'}
              onPlay={actions.handleVideoPlay}
              onPause={actions.handleVideoPause}
              onEnded={actions.handleVideoEnded}
              onTimeUpdate={actions.handleTimeUpdate}
              onLoadedMetadata={actions.handleLoadedMetadata}
              onProgress={actions.handleProgress}
              onError={actions.handleVideoError}
              onClick={actions.handlePlayPauseToggle}
              aria-label={title ?? 'Video'}
            />

            {state.loading && !state.error && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <div
                  className="h-8 w-8 rounded-full border-2 border-white/20 border-t-degen-400 animate-spin"
                  role="status"
                  aria-label="Loading video"
                />
              </div>
            )}

            {!state.playing && !state.loading && !state.error && !state.showPlayOverlay && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M8 5V19L19 12L8 5Z" />
                  </svg>
                </div>
              </div>
            )}

            {state.error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 gap-3 px-4">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                  className="text-red-400"
                >
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
                  <line
                    x1="12"
                    y1="8"
                    x2="12"
                    y2="13"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <circle cx="12" cy="16" r="1" fill="currentColor" />
                </svg>
                <p className="text-xs text-center text-white/70">Video unavailable</p>
                <button
                  type="button"
                  onClick={actions.handleRetry}
                  className="rounded-lg bg-white/10 px-4 py-1.5 text-xs text-white hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-degen-400/60"
                >
                  Retry
                </button>
              </div>
            )}
          </>
        )}

        {/* Autoplay countdown */}
        {state.autoPlayCountdown != null && (
          <div className="absolute bottom-16 left-1/2 z-20 -translate-x-1/2 flex items-center gap-3 autoplay-countdown">
            <span className="text-xs">Next in {state.autoPlayCountdown}s</span>
            <div className="countdown-bar w-16">
              <div
                className="fill"
                style={{
                  width: `${(state.autoPlayCountdown / AUTOPLAY_COUNTDOWN_SECONDS) * 100}%`,
                }}
              />
            </div>
            <button
              type="button"
              className="cancel-btn text-xs"
              onClick={actions.clearAutoPlayTimer}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                actions.clearAutoPlayTimer();
                onAutoPlayNext?.();
              }}
              className="rounded-lg bg-degen-500/20 px-3 py-1 text-[11px] font-medium text-degen-400 hover:bg-degen-500/30 transition-colors"
            >
              Skip →
            </button>
          </div>
        )}

        {/* Controls overlay */}
        {state.userInitiated && !isYouTube && !state.error && (
          <Controls
            playing={state.playing}
            muted={state.muted}
            volume={state.volume}
            currentTime={state.currentTime}
            duration={state.duration}
            buffered={state.buffered}
            onPlayPause={actions.handlePlayPauseToggle}
            onMuteToggle={actions.handleMuteToggle}
            onVolumeChange={actions.handleVolumeChange}
            onSeek={actions.handleSeek}
            onFullscreen={actions.handleFullscreen}
            fullscreenSupported={document.fullscreenEnabled}
            isFullscreen={state.isFullscreen}
            visible={state.controlsVisible}
            pipSupported={state.inPip}
            inPip={state.inPip}
            onPictureInPicture={actions.handlePictureInPicture}
            playbackRate={state.playbackRate}
            onSpeedChange={actions.handleSpeedChange}
            showSpeedMenu={state.showSpeedMenu}
            setShowSpeedMenu={actions.setShowSpeedMenu}
            qualities={qualities}
            currentQuality={state.currentQuality}
            onQualityChange={actions.handleQualityChange}
            showQualityMenu={state.showQualityMenu}
            setShowQualityMenu={actions.setShowQualityMenu}
          />
        )}

        {/* Short-form vertical swipe hint */}
        {state.isVertical && !state.playing && !state.userInitiated && (
          <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2">
            <div className="flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 text-[10px] text-white/60 backdrop-blur-sm">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 5v14M5 12l7-7 7 7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Swipe
            </div>
          </div>
        )}

        {/* Metadata footer */}
        {showMetadata && !state.userInitiated && !isYouTube && (channelName || title) && (
          <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/70 to-transparent px-3 pb-3 pt-8 pointer-events-none">
            {title && (
              <p className="text-sm font-semibold text-white drop-shadow-lg line-clamp-1">
                {title}
              </p>
            )}
            <div className="mt-0.5 flex items-center gap-2">
              {channelName && <span className="text-[11px] text-white/70">{channelName}</span>}
              {views != null && (
                <span className="text-[11px] text-white/50">{formatCount(views)} views</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Mini Player */}
      {miniPlayer && state.showMiniPlayer && state.playing && !state.inPip && (
        <MiniPlayer
          title={title}
          channelName={channelName}
          onClose={() => {
            actions.setShowMiniPlayer(false);
            onMiniPlayerClose?.();
            videoRef.current?.pause();
          }}
          onClick={() => {
            actions.setShowMiniPlayer(false);
            containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }}
        />
      )}
    </>
  );
});
