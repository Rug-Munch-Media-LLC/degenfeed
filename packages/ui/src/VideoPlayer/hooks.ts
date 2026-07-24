import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AUTOPLAY_COUNTDOWN_SECONDS,
  CONTROLS_HIDE_DELAY,
  DOUBLE_TAP_DELAY,
  DOUBLE_TAP_SEEK,
  SEEK_STEP,
  SWIPE_THRESHOLD,
  VOLUME_STEP,
} from './constants';

export interface PlayerState {
  inView: boolean;
  userInitiated: boolean;
  playing: boolean;
  loading: boolean;
  error: string | null;
  currentTime: number;
  duration: number;
  buffered: number;
  volume: number;
  muted: boolean;
  controlsVisible: boolean;
  isFullscreen: boolean;
  showMiniPlayer: boolean;
  autoPlayCountdown: number | null;
  showPlayOverlay: boolean;
  playbackRate: number;
  inPip: boolean;
  isVertical: boolean;
  showSpeedMenu: boolean;
  showQualityMenu: boolean;
  currentQuality: number;
}

export interface PlayerActions {
  handlePlayPauseToggle: () => void;
  handleSeek: (t: number) => void;
  handleVolumeChange: (v: number) => void;
  handleMuteToggle: () => void;
  handleFullscreen: () => void;
  handlePictureInPicture: () => Promise<void>;
  handleSpeedChange: (speed: number) => void;
  handleQualityChange: (index: number) => void;
  handleRetry: () => void;
  handleInitiatePlay: () => void;
  handleTouchEnd: (e: React.TouchEvent) => void;
  handleTouchStartForSwipe: (e: React.TouchEvent) => void;
  handleTouchMove: (e: React.TouchEvent) => void;
  handleVideoPlay: () => void;
  handleVideoPause: () => void;
  handleVideoEnded: () => void;
  handleTimeUpdate: () => void;
  handleLoadedMetadata: () => void;
  handleProgress: () => void;
  handleVideoError: () => void;
  handleContainerKeyDown: (e: React.KeyboardEvent) => void;
  resetControlsTimer: () => void;
  clearAutoPlayTimer: () => void;
  startAutoPlayCountdown: () => void;
  setControlsVisible: React.Dispatch<React.SetStateAction<boolean>>;
  setShowMiniPlayer: React.Dispatch<React.SetStateAction<boolean>>;
  setShowSpeedMenu: React.Dispatch<React.SetStateAction<boolean>>;
  setShowQualityMenu: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useVideoPlayer(
  containerRef: React.RefObject<HTMLDivElement | null>,
  videoRef: React.RefObject<HTMLVideoElement | null>,
  {
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
  }: {
    src?: string;
    platform?: string;
    aspectRatio?: string;
    qualities?: Array<{ label: string; height: number; src: string }>;
    miniPlayer?: boolean;
    onPlayCb?: () => void;
    onPauseCb?: () => void;
    onEndedCb?: () => void;
    onErrorCb?: (message: string) => void;
    onAutoPlayNext?: () => void;
    hasNext?: boolean;
    onSwipeUp?: () => void;
    onSwipeDown?: () => void;
    onMiniPlayerClose?: () => void;
  },
): [PlayerState, PlayerActions] {
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartRef = useRef<{ y: number; x: number } | null>(null);
  const lastTapRef = useRef<{ x: number; time: number } | null>(null);
  const autoPlayTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevVolumeRef = useRef(1);
  const reducedMotionRef = useRef(false);
  const pipSupportedRef = useRef(false);
  const touchControlsDismissedRef = useRef(false);

  // ── State ──
  const [inView, setInView] = useState(false);
  const [userInitiated, setUserInitiated] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isVertical, setIsVertical] = useState(aspectRatio === '9:16');
  const [showPlayOverlay, setShowPlayOverlay] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [inPip, setInPip] = useState(false);
  const [autoPlayCountdown, setAutoPlayCountdown] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showMiniPlayer, setShowMiniPlayer] = useState(false);
  const [currentQuality, setCurrentQuality] = useState(0);
  const [showQualityMenu, setShowQualityMenu] = useState(false);

  const isYouTube = platform === 'youtube' || !!src?.includes('youtube');

  // ── Detect reduced motion ──
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotionRef.current = mq.matches;
    const handler = (e: MediaQueryListEvent) => {
      reducedMotionRef.current = e.matches;
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // ── Detect PiP support ──
  useEffect(() => {
    if (typeof document !== 'undefined') {
      pipSupportedRef.current = !!document.pictureInPictureEnabled;
    }
  }, []);

  // ── Listen for PiP events ──
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handleEnterPip = () => setInPip(true);
    const handleLeavePip = () => setInPip(false);
    video.addEventListener('enterpictureinpicture', handleEnterPip);
    video.addEventListener('leavepictureinpicture', handleLeavePip);
    return () => {
      video.removeEventListener('enterpictureinpicture', handleEnterPip);
      video.removeEventListener('leavepictureinpicture', handleLeavePip);
    };
  }, [videoRef]);

  // ── Fullscreen change ──
  useEffect(() => {
    const handler = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // ── Autoplay countdown ──
  const clearAutoPlayTimer = useCallback(() => {
    if (autoPlayTimerRef.current) {
      clearInterval(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }
    setAutoPlayCountdown(null);
  }, []);

  const startAutoPlayCountdown = useCallback(() => {
    if (!onAutoPlayNext || !hasNext) return;
    setAutoPlayCountdown(AUTOPLAY_COUNTDOWN_SECONDS);
    let remaining = AUTOPLAY_COUNTDOWN_SECONDS;
    autoPlayTimerRef.current = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearAutoPlayTimer();
        onAutoPlayNext();
      } else {
        setAutoPlayCountdown(remaining);
      }
    }, 1000);
  }, [onAutoPlayNext, hasNext, clearAutoPlayTimer]);

  // ── IntersectionObserver ──
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const isInView = !!entry?.isIntersecting;
        setInView(isInView);
        if (!isInView && playing) videoRef.current?.pause();
        if (miniPlayer && !isInView && playing) setShowMiniPlayer(true);
        if (isInView) setShowMiniPlayer(false);
      },
      { threshold: [0.3, 0.7] },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [playing, miniPlayer, containerRef, videoRef]);

  // ── Controls auto-hide ──
  const resetControlsTimer = useCallback(() => {
    setControlsVisible(true);
    touchControlsDismissedRef.current = false;
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    if (playing) {
      controlsTimerRef.current = setTimeout(() => {
        setControlsVisible(false);
        touchControlsDismissedRef.current = true;
      }, CONTROLS_HIDE_DELAY);
    }
  }, [playing]);

  useEffect(() => {
    if (playing && !reducedMotionRef.current) resetControlsTimer();
    return () => {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    };
  }, [playing, resetControlsTimer]);

  // ── Video event handlers ──
  const handlePlayPauseToggle = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play();
    else video.pause();
  }, [videoRef]);

  const handleVideoPlay = useCallback(() => {
    setPlaying(true);
    setLoading(false);
    setShowPlayOverlay(false);
    onPlayCb?.();
  }, [onPlayCb]);

  const handleVideoPause = useCallback(() => {
    setPlaying(false);
    setControlsVisible(true);
    onPauseCb?.();
  }, [onPauseCb]);

  const handleVideoEnded = useCallback(() => {
    setPlaying(false);
    setShowPlayOverlay(true);
    setControlsVisible(true);
    onEndedCb?.();
    if (onAutoPlayNext && hasNext) startAutoPlayCountdown();
  }, [onEndedCb, startAutoPlayCountdown, onAutoPlayNext, hasNext]);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setCurrentTime(video.currentTime);
  }, [videoRef]);

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setDuration(video.duration);
    setLoading(false);
    if (video.videoHeight > video.videoWidth && aspectRatio === 'auto') setIsVertical(true);
  }, [aspectRatio, videoRef]);

  const handleProgress = useCallback(() => {
    const video = videoRef.current;
    if (!video?.buffered.length) return;
    setBuffered(video.buffered.end(video.buffered.length - 1));
  }, [videoRef]);

  const handleVideoError = useCallback(() => {
    const video = videoRef.current;
    const message = video?.error?.message ?? 'Video failed to load';
    setError(message);
    setLoading(false);
    onErrorCb?.(message);
  }, [onErrorCb, videoRef]);

  const handleSeek = useCallback(
    (t: number) => {
      const video = videoRef.current;
      if (!video) return;
      video.currentTime = t;
      setCurrentTime(t);
    },
    [videoRef],
  );

  const handleVolumeChange = useCallback(
    (v: number) => {
      const video = videoRef.current;
      if (!video) return;
      video.volume = v;
      video.muted = v === 0;
      setVolume(v);
      setMuted(v === 0);
    },
    [videoRef],
  );

  const handleMuteToggle = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.muted) {
      video.muted = false;
      video.volume = prevVolumeRef.current;
      setMuted(false);
      setVolume(prevVolumeRef.current);
    } else {
      prevVolumeRef.current = video.volume;
      video.muted = true;
      setMuted(true);
    }
  }, [videoRef]);

  const handleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen();
  }, [containerRef]);

  const handleInitiatePlay = useCallback(() => {
    setUserInitiated(true);
    setTimeout(() => {
      videoRef.current?.play().catch(() => setError('Playback was blocked'));
    }, 50);
  }, [videoRef]);

  const handlePictureInPicture = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await video.requestPictureInPicture();
    } catch {
      /* PiP not available */
    }
  }, [videoRef]);

  const handleSpeedChange = useCallback(
    (speed: number) => {
      const video = videoRef.current;
      if (!video) return;
      video.playbackRate = speed;
      setPlaybackRate(speed);
      setShowSpeedMenu(false);
    },
    [videoRef],
  );

  const handleQualityChange = useCallback(
    (index: number) => {
      setCurrentQuality(index);
      setShowQualityMenu(false);
      if (index === 0) {
        if (videoRef.current && src) {
          videoRef.current.src = src;
          videoRef.current.load();
        }
      } else if (qualities?.[index]?.src) {
        if (videoRef.current) {
          const wasPlaying = playing;
          videoRef.current.src = qualities[index].src;
          videoRef.current.load();
          if (wasPlaying) videoRef.current.play().catch(() => {});
        }
      }
    },
    [src, qualities, playing, videoRef],
  );

  // ── Keyboard shortcuts (global) ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (document.activeElement && !containerRef.current?.contains(document.activeElement)) return;
      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          if (!isYouTube) handlePlayPauseToggle();
          break;
        case 'f':
          e.preventDefault();
          handleFullscreen();
          break;
        case 'm':
          e.preventDefault();
          handleMuteToggle();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (!isYouTube) handleSeek(Math.max(0, currentTime - SEEK_STEP));
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (!isYouTube) handleSeek(Math.min(duration, currentTime + SEEK_STEP));
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (!isYouTube) handleVolumeChange(Math.min(1, volume + VOLUME_STEP));
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (!isYouTube) handleVolumeChange(Math.max(0, volume - VOLUME_STEP));
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    isYouTube,
    handlePlayPauseToggle,
    handleFullscreen,
    handleMuteToggle,
    handleSeek,
    currentTime,
    duration,
    handleVolumeChange,
    volume,
    containerRef,
  ]);

  const handleContainerKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          if (!isYouTube) handlePlayPauseToggle();
          break;
        case 'f':
          e.preventDefault();
          handleFullscreen();
          break;
        case 'm':
          e.preventDefault();
          handleMuteToggle();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (!isYouTube) handleSeek(Math.max(0, currentTime - SEEK_STEP));
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (!isYouTube) handleSeek(Math.min(duration, currentTime + SEEK_STEP));
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (!isYouTube) handleVolumeChange(Math.min(1, volume + VOLUME_STEP));
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (!isYouTube) handleVolumeChange(Math.max(0, volume - VOLUME_STEP));
          break;
      }
    },
    [
      isYouTube,
      handlePlayPauseToggle,
      handleFullscreen,
      handleMuteToggle,
      handleSeek,
      currentTime,
      duration,
      handleVolumeChange,
      volume,
    ],
  );

  // ── Touch handlers ──
  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.changedTouches[0];
      if (!touch) return;
      const now = Date.now();
      const x = touch.clientX;
      const last = lastTapRef.current;
      if (last && now - last.time < DOUBLE_TAP_DELAY) {
        const containerWidth = containerRef.current?.offsetWidth ?? 1;
        if (x < containerWidth / 2) handleSeek(Math.max(0, currentTime - DOUBLE_TAP_SEEK));
        else handleSeek(Math.min(duration, currentTime + DOUBLE_TAP_SEEK));
        lastTapRef.current = null;
        return;
      }
      if (!playing && controlsVisible) {
        /* no-op */
      } else if (!touchControlsDismissedRef.current) {
        setControlsVisible((v) => !v);
        if (controlsVisible) touchControlsDismissedRef.current = true;
        else resetControlsTimer();
      } else resetControlsTimer();
      lastTapRef.current = { x, time: now };
      if (!touchStartRef.current) return;
      const dy = touch.clientY - touchStartRef.current.y;
      const dx = touch.clientX - touchStartRef.current.x;
      touchStartRef.current = null;
      if (!isVertical || Math.abs(dy) < SWIPE_THRESHOLD || Math.abs(dy) < Math.abs(dx) * 1.5)
        return;
      if (dy < 0) onSwipeUp?.();
      else onSwipeDown?.();
    },
    [
      isVertical,
      onSwipeUp,
      onSwipeDown,
      playing,
      controlsVisible,
      resetControlsTimer,
      handleSeek,
      currentTime,
      duration,
      containerRef,
    ],
  );

  const handleTouchStartForSwipe = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      if (!touch) return;
      touchStartRef.current = { y: touch.clientY, x: touch.clientX };
    }
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStartRef.current) return;
      const touch = e.touches[0];
      if (!touch) return;
      const dy = touch.clientY - touchStartRef.current.y;
      if (isVertical) return;
      if (Math.abs(dy) < 20) return;
      const containerWidth = containerRef.current?.offsetWidth ?? 1;
      if (touch.clientX >= containerWidth / 2) {
        const newVol = Math.max(0, Math.min(1, volume + -dy * 0.005));
        handleVolumeChange(newVol);
        touchStartRef.current = { y: touch.clientY, x: touch.clientX };
        setControlsVisible(true);
      }
    },
    [isVertical, volume, handleVolumeChange, containerRef],
  );

  const handleRetry = useCallback(() => {
    setError(null);
    setLoading(true);
    setUserInitiated(false);
    setTimeout(() => setUserInitiated(true), 100);
  }, []);

  const state: PlayerState = {
    inView,
    userInitiated,
    playing,
    loading,
    error,
    currentTime,
    duration,
    buffered,
    volume,
    muted,
    controlsVisible,
    isFullscreen,
    showMiniPlayer,
    autoPlayCountdown,
    showPlayOverlay,
    playbackRate,
    inPip,
    isVertical,
    showSpeedMenu,
    showQualityMenu,
    currentQuality,
  };

  const actions: PlayerActions = {
    handlePlayPauseToggle,
    handleSeek,
    handleVolumeChange,
    handleMuteToggle,
    handleFullscreen,
    handlePictureInPicture,
    handleSpeedChange,
    handleQualityChange,
    handleRetry,
    handleInitiatePlay,
    handleTouchEnd,
    handleTouchStartForSwipe,
    handleTouchMove,
    handleVideoPlay,
    handleVideoPause,
    handleVideoEnded,
    handleTimeUpdate,
    handleLoadedMetadata,
    handleProgress,
    handleVideoError,
    handleContainerKeyDown,
    resetControlsTimer,
    clearAutoPlayTimer,
    startAutoPlayCountdown,
    setControlsVisible,
    setShowMiniPlayer,
    setShowSpeedMenu,
    setShowQualityMenu,
  };

  return [state, actions];
}
