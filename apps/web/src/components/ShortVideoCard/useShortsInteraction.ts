'use client';

import type { UnifiedPost } from '@degenfeed/types';
import { parseVideoUrl, type VideoInfo } from '@degenfeed/utils';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';


interface ShortsCallbacks {
  liked: boolean;
  likeCount: number;
  bookmarked: boolean;
  muted: boolean;
  showOverlay: boolean;
  progress: number;
  showCaption: boolean;
  showInfoPanel: boolean;
  heartVisible: boolean;
  emotes: Array<{ id: number; emoji: string; x: number }>;
  pullDismissProgress: number;
  tipModalOpenState: boolean;
  videoInfo: VideoInfo | null;
  hashtags: string[];
  authorHandle: string;
  isDirect: boolean;
  isPeertube: boolean;
  youtubeId: string | undefined;
  pullDismissStyle: React.CSSProperties;
  tipCount: number;

  setShowCaption: React.Dispatch<React.SetStateAction<boolean>>;
  setShowInfoPanel: React.Dispatch<React.SetStateAction<boolean>>;
  setTipModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setMuted: React.Dispatch<React.SetStateAction<boolean>>;
  setShowOverlay: React.Dispatch<React.SetStateAction<boolean>>;
  setPullDismissProgress: React.Dispatch<React.SetStateAction<number>>;
  setEmotes: React.Dispatch<React.SetStateAction<Array<{ id: number; emoji: string; x: number }>>>;

  handleContainerClick: (e: React.MouseEvent) => void;
  handleTap: () => void;
  handlePointerDown: () => void;
  handlePointerUp: () => void;
  handleLike: () => void;
  handleBookmark: () => void;
  handleShare: () => void;
  handleComment: () => void;
  handleTip: () => void;
  handleMute: (e?: React.MouseEvent) => void;
  handleInfoDrag: (e: React.TouchEvent | React.MouseEvent, deltaY: number) => void;
  handleInfoTouchStart: (e: React.TouchEvent) => void;
  handleInfoTouchEnd: (e: React.TouchEvent) => void;
  handlePullStart: (e: React.TouchEvent | React.MouseEvent) => void;
  handlePullMove: (e: React.TouchEvent | React.MouseEvent) => void;
  handlePullEnd: () => void;
  addEmote: (emoji: string) => void;
}

export function useShortsInteraction(
  post: UnifiedPost,
  isActive: boolean,
  onDoubleTap?: () => void,
  onPlayStateChange?: (paused: boolean) => void,
): ShortsCallbacks {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.metrics.likes);
  const [bookmarked, setBookmarked] = useState(false);
  const [muted, setMuted] = useState(true);
  const [showOverlay, setShowOverlay] = useState(true);
  const [progress, setProgress] = useState(0);
  const [tipCount, setTipCount] = useState(0);
  const [showCaption, setShowCaption] = useState(false);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [heartVisible, setHeartVisible] = useState(false);
  const [tipModalOpen, setTipModalOpen] = useState(false);
  const [emotes, setEmotes] = useState<Array<{ id: number; emoji: string; x: number }>>([]);
  const [pullDismissProgress, setPullDismissProgress] = useState(0);
  const [_isDismissing, setIsDismissing] = useState(false);

  const overlayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressStartRef = useRef<number>(0);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapTime = useRef(0);
  const pullStartY = useRef(0);
  const emoteIdCounter = useRef(0);
  const panelDragStartRef = useRef(0);

  // Video detection
  const videoInfo = useMemo<VideoInfo | null>(() => {
    for (const embed of post.embeds) {
      const info = parseVideoUrl(embed.url);
      if (info) return info;
    }
    return null;
  }, [post.embeds]);

  const textYoutubeId = useMemo(() => {
    if (videoInfo) return null;
    const match = post.text.match(/(?:v=|\/|youtu\.be\/)([\w-]{11})/);
    return match?.[1] ?? null;
  }, [post.text, videoInfo]);

  const youtubeId = videoInfo?.platform === 'youtube' ? videoInfo.id : (textYoutubeId ?? undefined);
  const isDirect = videoInfo?.platform === 'direct';
  const isPeertube = videoInfo?.platform === 'peertube';

  const hashtags = useMemo(() => {
    const matches = post.text.match(/#[\w-]+/g);
    return matches ?? [];
  }, [post.text]);

  const authorHandle = post.author.handles[post.protocol] ?? post.author.id.slice(0, 16);

  // Heart burst
  const showHeart = useCallback(() => {
    setHeartVisible(true);
    setTimeout(() => setHeartVisible(false), 900);
  }, []);

  // Overlay auto-hide
  const resetOverlayTimer = useCallback(() => {
    setShowOverlay(true);
    if (overlayTimer.current) clearTimeout(overlayTimer.current);
    overlayTimer.current = setTimeout(() => {
      if (!showInfoPanel) setShowOverlay(false);
    }, 3000);
  }, [showInfoPanel]);

  // Event listeners
  useEffect(() => {
    if (!isActive) return;

    const onMute = () => setMuted((prev) => !prev);
    const onLike = () => {
      setLiked((prev) => !prev);
      showHeart();
    };
    const onBookmark = () => setBookmarked((prev) => !prev);
    const onOverlay = () => {
      setShowOverlay((prev) => !prev);
      if (showOverlay) {
        if (overlayTimer.current) clearTimeout(overlayTimer.current);
      } else {
        resetOverlayTimer();
      }
    };
    const onDoubleTapLike = () => {
      setLiked(true);
      showHeart();
    };
    const onPauseToggle = () => {
      onPlayStateChange?.(true);
      setTimeout(() => onPlayStateChange?.(false), 100);
    };

    window.addEventListener('shorts-toggle-mute', onMute);
    window.addEventListener('shorts-like-current', onLike);
    window.addEventListener('shorts-bookmark-current', onBookmark);
    window.addEventListener('shorts-toggle-overlay', onOverlay);
    window.addEventListener('shorts-seek-back', () => {});
    window.addEventListener('shorts-seek-forward', () => {});
    window.addEventListener('shorts-double-tap-like', onDoubleTapLike);
    window.addEventListener('shorts-toggle-pause', onPauseToggle);

    return () => {
      window.removeEventListener('shorts-toggle-mute', onMute);
      window.removeEventListener('shorts-like-current', onLike);
      window.removeEventListener('shorts-bookmark-current', onBookmark);
      window.removeEventListener('shorts-toggle-overlay', onOverlay);
      window.removeEventListener('shorts-seek-back', () => {});
      window.removeEventListener('shorts-seek-forward', () => {});
      window.removeEventListener('shorts-double-tap-like', onDoubleTapLike);
      window.removeEventListener('shorts-toggle-pause', onPauseToggle);
    };
  }, [isActive, showOverlay, showHeart, resetOverlayTimer, onPlayStateChange]);

  useEffect(() => {
    if (isActive) {
      resetOverlayTimer();
    } else {
      setShowOverlay(false);
      setShowInfoPanel(false);
      if (overlayTimer.current) clearTimeout(overlayTimer.current);
    }
    return () => {
      if (overlayTimer.current) clearTimeout(overlayTimer.current);
    };
  }, [isActive, resetOverlayTimer]);

  // Tap areas
  const handleContainerClick = useCallback(
    (e: React.MouseEvent) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const width = rect.width;
      if (showInfoPanel) return;
      if (x < width * 0.25) {
        window.dispatchEvent(new CustomEvent('shorts-seek-back'));
        return;
      }
      if (x > width * 0.75) {
        window.dispatchEvent(new CustomEvent('shorts-seek-forward'));
        return;
      }
      if (showOverlay) {
        setShowOverlay(false);
        if (overlayTimer.current) clearTimeout(overlayTimer.current);
      } else {
        resetOverlayTimer();
      }
    },
    [showOverlay, resetOverlayTimer, showInfoPanel],
  );

  const handleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapTime.current < 350) {
      setLiked(true);
      showHeart();
      onDoubleTap?.();
      lastTapTime.current = 0;
    } else {
      lastTapTime.current = now;
    }
  }, [onDoubleTap, showHeart]);

  const handlePointerDown = useCallback(() => {
    longPressTimer.current = setTimeout(() => {
      onPlayStateChange?.(true);
    }, 300);
  }, [onPlayStateChange]);

  const handlePointerUp = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    onPlayStateChange?.(false);
  }, [onPlayStateChange]);

  // Progress bar
  useEffect(() => {
    if (!isActive) {
      if (progressTimer.current) {
        clearInterval(progressTimer.current);
        progressTimer.current = null;
      }
      setProgress(0);
      return;
    }
    setProgress(0);
    progressStartRef.current = Date.now();
    const ESTIMATED_DURATION_MS = 30_000;
    progressTimer.current = setInterval(() => {
      const elapsed = Date.now() - progressStartRef.current;
      setProgress(Math.min(elapsed / ESTIMATED_DURATION_MS, 1));
      if (elapsed >= ESTIMATED_DURATION_MS && progressTimer.current) {
        clearInterval(progressTimer.current);
        progressTimer.current = null;
      }
    }, 100);
    return () => {
      if (progressTimer.current) {
        clearInterval(progressTimer.current);
        progressTimer.current = null;
      }
    };
  }, [isActive]);

  // Fetch PeerTube tip data
  useEffect(() => {
    if (!isPeertube || !videoInfo || videoInfo.platform !== 'peertube') return;
    let cancelled = false;
    fetch(`/api/peertube/tip/stats?videoId=${encodeURIComponent(videoInfo.uuid)}`)
      .then((r) => (r.ok ? (r.json() as Promise<{ count: number }>) : null))
      .then((data) => {
        if (!cancelled && data) setTipCount(data.count);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isPeertube, videoInfo]);

  // Pull-down to dismiss
  const handlePullStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if ('touches' in e) {
      pullStartY.current = e.touches[0]?.clientY ?? 0;
    } else {
      pullStartY.current = e.clientY;
    }
  }, []);

  const handlePullMove = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const currentY = 'touches' in e ? (e.touches[0]?.clientY ?? 0) : e.clientY;
    const delta = currentY - pullStartY.current;
    if (delta > 0) {
      const p = Math.min(delta / 200, 1);
      setPullDismissProgress(p);
    }
  }, []);

  const handlePullEnd = useCallback(() => {
    if (pullDismissProgress > 0.5) {
      setIsDismissing(true);
      setPullDismissProgress(1);
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('shorts-dismiss-current'));
        setIsDismissing(false);
        setPullDismissProgress(0);
      }, 300);
    } else {
      setPullDismissProgress(0);
    }
  }, [pullDismissProgress]);

  // Emote reactions
  const addEmote = useCallback((emoji: string) => {
    const id = ++emoteIdCounter.current;
    const x = 15 + Math.random() * 70;
    setEmotes((prev) => [...prev.slice(-9), { id, emoji, x }]);
    setTimeout(() => {
      setEmotes((prev) => prev.filter((e) => e.id !== id));
    }, 3000);
  }, []);

  useEffect(() => {
    if (!isActive) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { emoji?: string } | undefined;
      addEmote(detail?.emoji ?? '🔥');
    };
    window.addEventListener('shorts-emote', handler);
    return () => window.removeEventListener('shorts-emote', handler);
  }, [isActive, addEmote]);

  // Like
  const handleLike = useCallback(() => {
    setLiked((prev) => {
      const next = !prev;
      setLikeCount((c) => (next ? c + 1 : Math.max(0, c - 1)));
      return next;
    });
    window.dispatchEvent(new CustomEvent('shorts-like-current'));
  }, []);

  // Bookmark
  const handleBookmark = useCallback(async () => {
    setBookmarked((prev) => !prev);
    try {
      const { addBookmark, removeBookmark } = await import('@degenfeed/storage');
      if (!bookmarked) {
        await addBookmark(
          post.id,
          post.dfUri ?? '',
          post.protocol,
          post.text.slice(0, 60),
          post.author.displayName || '',
        );
      } else {
        await removeBookmark(post.id);
      }
    } catch {
      /* IndexedDB may be unavailable */
    }
    window.dispatchEvent(new CustomEvent('shorts-bookmark-current'));
  }, [bookmarked, post.id, post.dfUri, post.protocol, post.text, post.author.displayName]);

  // Share
  const handleShare = useCallback(async () => {
    const url = `${window.location.origin}/post/${encodeURIComponent(post.id)}`;
    try {
      const { Share } = await import('@capacitor/share');
      await Share.share({ url, title: post.text.slice(0, 80) });
    } catch {
      await navigator.clipboard.writeText(url).catch(() => {});
      window.dispatchEvent(
        new CustomEvent('df-toast', {
          detail: { kind: 'success', message: 'Link copied!' },
        }),
      );
    }
  }, [post.id, post.text]);

  const handleComment = useCallback(() => {
    window.location.href = `/post/${encodeURIComponent(post.id)}`;
  }, [post.id]);

  const handleTip = useCallback(() => {
    window.dispatchEvent(new CustomEvent('shorts-tip-current'));
    setTipModalOpen(true);
  }, []);

  const handleMute = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setMuted((prev) => !prev);
  }, []);

  const handleInfoDrag = useCallback(
    (_e: React.TouchEvent | React.MouseEvent, deltaY: number) => {
      if (deltaY < -40 && !showInfoPanel) setShowInfoPanel(true);
      if (deltaY > 40 && showInfoPanel) setShowInfoPanel(false);
    },
    [showInfoPanel],
  );

  const handleInfoTouchStart = useCallback((e: React.TouchEvent) => {
    panelDragStartRef.current = e.touches[0]?.clientY ?? 0;
  }, []);

  const handleInfoTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const deltaY = (e.changedTouches[0]?.clientY ?? 0) - panelDragStartRef.current;
      handleInfoDrag(e, deltaY);
    },
    [handleInfoDrag],
  );

  const pullDismissStyle: React.CSSProperties =
    pullDismissProgress > 0
      ? {
          opacity: Math.min(pullDismissProgress * 2, 1),
          transform: `scale(${1 - pullDismissProgress * 0.1})`,
          backgroundColor: `rgba(0,0,0,${pullDismissProgress * 0.5})`,
        }
      : {};

  return {
    liked,
    likeCount,
    bookmarked,
    muted,
    showOverlay,
    progress,
    showCaption,
    showInfoPanel,
    heartVisible,
    emotes,
    pullDismissProgress,
    videoInfo,
    hashtags,
    authorHandle,
    isDirect,
    isPeertube,
    youtubeId,
    tipCount,
    pullDismissStyle,
    tipModalOpenState: tipModalOpen,
    setShowCaption,
    setShowInfoPanel,
    setTipModalOpen,
    setMuted,
    setShowOverlay,
    setPullDismissProgress,
    setEmotes,
    handleContainerClick,
    handleTap,
    handlePointerDown,
    handlePointerUp,
    handleLike,
    handleBookmark,
    handleShare,
    handleComment,
    handleTip,
    handleMute,
    handleInfoDrag,
    handleInfoTouchStart,
    handleInfoTouchEnd,
    handlePullStart,
    handlePullMove,
    handlePullEnd,
    addEmote,
  };
}
