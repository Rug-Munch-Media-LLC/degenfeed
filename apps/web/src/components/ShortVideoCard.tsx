'use client';

/**
 * @components/ShortVideoCard — Full-screen TikTok-style video overlay card.
 *
 * Right rail: Like ❤️, Comment 💬, Tip ⚡, Share ↗️, Bookmark 🔖
 * Bottom info: creator avatar + name, caption, hashtags, sound
 * Top progress bar. Mute toggle. Double-tap heart burst.
 * Seek by tapping edges. Long-press to pause.
 *
 * Design: Neon dark cyberpunk with degen-green glass accents.
 */

import type { UnifiedPost } from '@degenfeed/types';
import { getProtocolColor, VideoPlayer } from '@degenfeed/ui';
import { formatTimeAgo, parseVideoUrl, type VideoInfo } from '@degenfeed/utils';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { QuickTipButton } from './QuickTipButton';

// Lazy-load TipModal (it includes Web3 hooks)
const TipModal = dynamic(() => import('./TipModal').then((m) => ({ default: m.TipModal })), {
  ssr: false,
});

// === Helpers ==============================================================

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function extractHashtags(text: string): string[] {
  const matches = text.match(/#[\w-]+/g);
  return matches ?? [];
}

function truncateText(text: string, maxLen = 100): string {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}…`;
}

// === Props ================================================================

interface ShortVideoCardProps {
  post: UnifiedPost;
  isActive: boolean;
  onDoubleTap?: () => void;
  onPlayStateChange?: (paused: boolean) => void;
}

// === Action Button ========================================================

interface ActionBtnProps {
  icon: React.ReactNode;
  label: string;
  count?: number;
  active?: boolean;
  onClick?: () => void;
  color?: string;
}

const ActionButton = memo(function ActionButton({
  icon,
  label,
  count,
  active = false,
  onClick,
  color,
}: ActionBtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-center gap-0.5 transition-transform active:scale-90"
      aria-label={`${label}${count != null ? ` — ${formatCount(count)}` : ''}`}
    >
      <span
        className={`flex h-11 w-11 items-center justify-center rounded-full backdrop-blur-md transition-all
        ${
          active
            ? 'bg-degen-500/20 text-degen-400 shadow-[0_0_12px_rgba(0,255,65,0.2)]'
            : 'bg-white/10 text-white/80 hover:bg-white/20 hover:text-white'
        }`}
        style={active && color ? { backgroundColor: `${color}22`, color } : undefined}
      >
        {icon}
      </span>
      {count != null && count > 0 && (
        <span className="text-[10px] font-medium text-white/70">{formatCount(count)}</span>
      )}
    </button>
  );
});

// === Heart Burst ==========================================================

function HeartBurst({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center">
      {/* Central heart */}
      <svg
        width="80"
        height="80"
        viewBox="0 0 24 24"
        fill="#ff2d55"
        className="drop-shadow-[0_0_30px_rgba(255,45,85,0.6)]"
        style={{ animation: 'shorts-heart-pop 0.8s ease-out forwards' }}
        aria-hidden="true"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
      {/* Orbiting hearts */}
      {[0, 1, 2, 3].map((i) => {
        const angle = (i / 4) * 360;
        return (
          <svg
            key={i}
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="#ff2d55"
            className="absolute drop-shadow-[0_0_12px_rgba(255,45,85,0.4)]"
            style={
              {
                animation: `shorts-heart-orbit 0.8s ease-out forwards`,
                animationDelay: `${i * 0.05}s`,
                transformOrigin: 'center',
                '--angle': `${angle}deg`,
              } as React.CSSProperties
            }
            aria-hidden="true"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        );
      })}
    </div>
  );
}

// === Video Info Panel =====================================================

function VideoInfoPanel({ post, visible }: { post: UnifiedPost; visible: boolean }) {
  const hashtags = useMemo(() => extractHashtags(post.text), [post.text]);
  const protocolColor = getProtocolColor(post.protocol);

  if (!visible) return null;

  return (
    <section
      className="absolute inset-x-0 bottom-0 z-40 max-h-[60vh] overflow-y-auto rounded-t-3xl border-t border-white/[0.06] bg-[#0a0a0a]/98 px-5 pb-8 pt-5 backdrop-blur-2xl"
      style={{ animation: 'shorts-panel-slide-up 0.35s cubic-bezier(0.32, 0.72, 0, 1)' }}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Escape') e.stopPropagation();
      }}
      aria-label="Video information"
    >
      {/* Handle */}
      <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />

      {/* Full description */}
      <h3 className="mb-1 text-sm font-bold text-white">Description</h3>
      <p className="mb-4 text-sm leading-relaxed text-white/70 whitespace-pre-wrap">{post.text}</p>

      {/* All hashtags */}
      {hashtags.length > 0 && (
        <div className="mb-4">
          <h4 className="mb-1.5 text-xs font-medium text-white/50">Topics</h4>
          <div className="flex flex-wrap gap-1.5">
            {hashtags.map((tag) => (
              <a
                key={tag}
                href={`/topics/${encodeURIComponent(tag.slice(1))}`}
                className="rounded-full bg-degen-500/10 px-2.5 py-1 text-xs font-medium text-degen-400 transition-colors hover:bg-degen-500/20"
              >
                {tag}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Creator info */}
      <div className="mb-4">
        <h4 className="mb-1.5 text-xs font-medium text-white/50">Creator</h4>
        <a
          href={`/profile?protocol=${post.protocol}&id=${encodeURIComponent(post.author.id)}`}
          className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-3 transition-colors hover:bg-white/[0.06]"
        >
          {post.author.avatarUrl ? (
            <Image
              src={post.author.avatarUrl}
              alt={post.author.displayName}
              width={36}
              height={36}
              className="h-9 w-9 rounded-full border border-white/10 object-cover"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-degen-500/20 text-xs font-bold text-degen-400">
              {post.author.displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{post.author.displayName}</p>
            <p className="text-xs text-white/50 truncate">
              @{post.author.handles[post.protocol] ?? post.author.id.slice(0, 16)}
            </p>
          </div>
          <span
            className="rounded-full px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider shrink-0"
            style={{ backgroundColor: `${protocolColor}18`, color: protocolColor }}
          >
            {post.protocol}
          </span>
        </a>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-3 rounded-xl bg-white/[0.03] p-3">
        <div className="text-center">
          <p className="text-sm font-bold text-white">{formatCount(post.metrics.likes)}</p>
          <p className="text-[10px] text-white/40">Likes</p>
        </div>
        <div className="text-center">
          <p className="text-sm font-bold text-white">{formatCount(post.metrics.replies)}</p>
          <p className="text-[10px] text-white/40">Comments</p>
        </div>
        <div className="text-center">
          <p className="text-sm font-bold text-white">{formatCount(post.metrics.reposts)}</p>
          <p className="text-[10px] text-white/40">Shares</p>
        </div>
      </div>
    </section>
  );
}

// === Main Component ======================================================

export const ShortVideoCard = memo(function ShortVideoCard({
  post,
  isActive,
  onDoubleTap,
  onPlayStateChange,
}: ShortVideoCardProps) {
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
  const [isDismissing, setIsDismissing] = useState(false);
  const overlayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressStartRef = useRef<number>(0);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapTime = useRef(0);
  const pullStartY = useRef(0);
  const emoteIdCounter = useRef(0);

  // == Video detection ===================================================
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
  const _isYoutube = !!youtubeId;
  const isDirect = videoInfo?.platform === 'direct';
  const isPeertube = videoInfo?.platform === 'peertube';

  const hashtags = useMemo(() => extractHashtags(post.text), [post.text]);
  const authorHandle = post.author.handles[post.protocol] ?? post.author.id.slice(0, 16);
  const protocolColor = getProtocolColor(post.protocol);

  // == Heart burst animation =============================================
  const showHeart = useCallback(() => {
    setHeartVisible(true);
    setTimeout(() => setHeartVisible(false), 900);
  }, []);

  // == Overlay auto-hide after 3s ========================================
  const resetOverlayTimer = useCallback(() => {
    setShowOverlay(true);
    if (overlayTimer.current) clearTimeout(overlayTimer.current);
    overlayTimer.current = setTimeout(() => {
      if (!showInfoPanel) setShowOverlay(false);
    }, 3000);
  }, [showInfoPanel]);

  // == Custom event listeners ============================================
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
    // Seek indicators are handled at the page level (toast).
    // VideoPlayer handles the actual seek internally.
    const onSeekBack = () => {
      void 0;
    };
    const onSeekForward = () => {
      void 0;
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
    window.addEventListener('shorts-seek-back', onSeekBack);
    window.addEventListener('shorts-seek-forward', onSeekForward);
    window.addEventListener('shorts-double-tap-like', onDoubleTapLike);
    window.addEventListener('shorts-toggle-pause', onPauseToggle);

    return () => {
      window.removeEventListener('shorts-toggle-mute', onMute);
      window.removeEventListener('shorts-like-current', onLike);
      window.removeEventListener('shorts-bookmark-current', onBookmark);
      window.removeEventListener('shorts-toggle-overlay', onOverlay);
      window.removeEventListener('shorts-seek-back', onSeekBack);
      window.removeEventListener('shorts-seek-forward', onSeekForward);
      window.removeEventListener('shorts-double-tap-like', onDoubleTapLike);
      window.removeEventListener('shorts-toggle-pause', onPauseToggle);
    };
    // NOTE: showOverlay is intentionally excluded from deps — re-registering
    // listeners on every overlay toggle would be wasteful. The closure reads
    // showOverlay and resetOverlayTimer which are stable across renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // == Tap area management ===============================================
  const handleContainerClick = useCallback(
    (e: React.MouseEvent) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const width = rect.width;

      // If info panel is open, don't process taps on the video area
      if (showInfoPanel) return;

      // Left 30% → seek back
      if (x < width * 0.25) {
        window.dispatchEvent(new CustomEvent('shorts-seek-back'));
        return;
      }
      // Right 30% → seek forward
      if (x > width * 0.75) {
        window.dispatchEvent(new CustomEvent('shorts-seek-forward'));
        return;
      }
      // Center → toggle overlay
      if (showOverlay) {
        setShowOverlay(false);
        if (overlayTimer.current) clearTimeout(overlayTimer.current);
      } else {
        resetOverlayTimer();
      }
    },
    [showOverlay, resetOverlayTimer, showInfoPanel],
  );

  // == Double-tap to like =================================================
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

  // == Long press to pause ===============================================
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

  // == Progress bar ======================================================
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

  // == Fetch PeerTube tip data ==
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

  // == Pull-down to dismiss ================================================
  const handlePullStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if ('touches' in e) {
      pullStartY.current = e.touches[0].clientY;
    } else {
      pullStartY.current = e.clientY;
    }
  }, []);

  const handlePullMove = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const currentY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const delta = currentY - pullStartY.current;
    if (delta > 0) {
      const progress = Math.min(delta / 200, 1);
      setPullDismissProgress(progress);
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

  // == Emote reactions (floating emojis over video like Twitch bits) =========
  const addEmote = useCallback((emoji: string) => {
    const id = ++emoteIdCounter.current;
    const x = 15 + Math.random() * 70; // random horizontal position (%)
    setEmotes((prev) => [...prev.slice(-9), { id, emoji, x }]); // keep max 10
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

  // == Like ==
  const handleLike = useCallback(() => {
    setLiked((prev) => {
      const next = !prev;
      setLikeCount((c) => (next ? c + 1 : Math.max(0, c - 1)));
      return next;
    });
    window.dispatchEvent(new CustomEvent('shorts-like-current'));
  }, []);

  // == Bookmark ==
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

  // == Share ==
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

  // == Comment ==
  const handleComment = useCallback(() => {
    window.location.href = `/post/${encodeURIComponent(post.id)}`;
  }, [post.id]);

  // == Tip ==
  const handleTip = useCallback(() => {
    window.dispatchEvent(new CustomEvent('shorts-tip-current'));
    setTipModalOpen(true);
  }, []);

  // == Mute ==
  const handleMute = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setMuted((prev) => !prev);
  }, []);

  // == Info panel toggle — swipe up gesture on bottom area ==
  const handleInfoDrag = useCallback(
    (_e: React.TouchEvent | React.MouseEvent, deltaY: number) => {
      if (deltaY < -40 && !showInfoPanel) setShowInfoPanel(true);
      if (deltaY > 40 && showInfoPanel) setShowInfoPanel(false);
    },
    [showInfoPanel],
  );

  // Track Y start for panel drag
  const panelDragStartRef = useRef(0);
  const handleInfoTouchStart = useCallback((e: React.TouchEvent) => {
    panelDragStartRef.current = e.touches[0].clientY;
  }, []);
  const handleInfoTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const deltaY = e.changedTouches[0].clientY - panelDragStartRef.current;
      handleInfoDrag(e, deltaY);
    },
    [handleInfoDrag],
  );

  // == Render =============================================================

  return (
    <section
      className="relative h-full w-full overflow-hidden bg-black select-none"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      aria-label={`Video by ${post.author.displayName}`}
    >
      {/* == Progress Bar (thin, at very top) == */}
      <div className="pointer-events-none absolute left-0 right-0 top-0 z-30 h-0.5">
        <div className="h-full w-full bg-white/10">
          <div
            className="h-full bg-gradient-to-r from-degen-500 to-degen-400 transition-all duration-150 ease-linear"
            style={{ width: `${progress * 100}%` }}
            role="progressbar"
            aria-valuenow={Math.round(progress * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Video progress"
          />
        </div>
      </div>

      {/* == Video Player == */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: interactive video overlay container with role="presentation" */}
      <div
        className="absolute inset-0 cursor-pointer"
        onClick={handleContainerClick}
        onDoubleClick={handleTap}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleContainerClick(e as unknown as React.MouseEvent<HTMLDivElement>);
          }
        }}
        role="presentation"
      >
        {youtubeId ? (
          <VideoPlayer
            youtubeId={youtubeId}
            platform="youtube"
            aspectRatio="9:16"
            title={post.text}
            showMetadata={false}
            onPlay={() => onPlayStateChange?.(false)}
            onPause={() => onPlayStateChange?.(true)}
            className="h-full w-full"
          />
        ) : isDirect && videoInfo?.platform === 'direct' ? (
          <VideoPlayer
            src={videoInfo.url}
            platform="direct"
            aspectRatio="9:16"
            title={post.text}
            showMetadata={false}
            onPlay={() => onPlayStateChange?.(false)}
            onPause={() => onPlayStateChange?.(true)}
            className="h-full w-full"
          />
        ) : isPeertube && videoInfo?.platform === 'peertube' ? (
          <VideoPlayer
            peertubeInstance={videoInfo.instance}
            peertubeUuid={videoInfo.uuid}
            platform="peertube"
            aspectRatio="9:16"
            title={post.text}
            showMetadata={false}
            onPlay={() => onPlayStateChange?.(false)}
            onPause={() => onPlayStateChange?.(true)}
            className="h-full w-full"
          />
        ) : (
          /* Fallback */
          <div className="flex h-full w-full items-center justify-center bg-[var(--color-bg)]">
            {post.author.avatarUrl && (
              <Image
                src={post.author.avatarUrl}
                alt={post.author.displayName}
                width={120}
                height={120}
                className="h-30 w-30 rounded-full object-cover opacity-20"
              />
            )}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 backdrop-blur-md">
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="text-white/70"
                  aria-hidden="true"
                >
                  <path d="M8 5V19L19 12L8 5Z" />
                </svg>
              </div>
              <p className="text-xs text-[var(--color-muted)]">Video unavailable</p>
              <a
                href={post.embeds[0]?.url ?? '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-[var(--color-muted)] transition-colors hover:bg-white/10 hover:text-white"
              >
                Open original
              </a>
            </div>
          </div>
        )}

        {/* == Gradient overlays == */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[45%] bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[15%] bg-gradient-to-b from-black/40 to-transparent" />
      </div>

      {/* == Pull-to-dismiss overlay == */}
      {pullDismissProgress > 0 && (
        <div
          className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center"
          style={{
            opacity: Math.min(pullDismissProgress * 2, 1),
            transform: `scale(${1 - pullDismissProgress * 0.1})`,
            backgroundColor: `rgba(0,0,0,${pullDismissProgress * 0.5})`,
          }}
        >
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-white/70 drop-shadow-lg"
            style={{
              transform: `rotate(${pullDismissProgress * 180}deg)`,
              transition: 'transform 0.1s',
            }}
            aria-hidden="true"
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </div>
      )}

      {/* == Floating Emote Reactions (Twitch-style) == */}
      {emotes.map((emote) => (
        <div
          key={emote.id}
          className="pointer-events-none absolute z-40 text-2xl drop-shadow-lg"
          style={{
            left: `${emote.x}%`,
            bottom: '30%',
            animation: 'emote-float 2.5s ease-out forwards',
          }}
          aria-hidden="true"
        >
          {emote.emoji}
        </div>
      ))}

      {/* == Heart burst animation == */}
      <HeartBurst visible={heartVisible} />

      {/* == Seek hint overlays (shown briefly on tap) == */}
      {/* Left seek zone */}
      <div className="pointer-events-none absolute left-0 top-0 z-20 flex h-full w-[25%] items-center justify-start pl-3">
        <span className="text-2xl text-white/30 drop-shadow-lg opacity-0 transition-opacity duration-200">
          ⏪
        </span>
      </div>
      {/* Right seek zone */}
      <div className="pointer-events-none absolute right-0 top-0 z-20 flex h-full w-[25%] items-center justify-end pr-3">
        <span className="text-2xl text-white/30 drop-shadow-lg opacity-0 transition-opacity duration-200">
          ⏩
        </span>
      </div>

      {/* == Mute/Unmute button == */}
      <button
        type="button"
        onClick={handleMute}
        className={`absolute right-4 top-16 z-30 flex h-9 w-9 items-center justify-center rounded-full backdrop-blur-md transition-all duration-300 ${
          muted
            ? 'bg-white/10 text-white/70 hover:bg-white/20'
            : 'bg-degen-500/20 text-degen-400 hover:bg-degen-500/30'
        } ${showOverlay ? 'opacity-100' : 'opacity-0'}`}
        aria-label={muted ? 'Unmute' : 'Mute'}
      >
        {muted ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M11 5L6 9H2v6h4l5 4V5z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M23 9l-6 6M17 9l6 6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>

      {/* == Right-side action rail == */}
      <div
        className={`absolute bottom-24 right-3 z-30 flex flex-col items-center gap-3 transition-all duration-300 sm:bottom-28 ${
          showOverlay && !showInfoPanel
            ? 'opacity-100 translate-x-0'
            : 'opacity-0 translate-x-4 pointer-events-none'
        }`}
      >
        {/* Avatar */}
        <div className="mb-1 flex flex-col items-center">
          <a
            href={`/profile?protocol=${post.protocol}&id=${encodeURIComponent(post.author.id)}`}
            className="block"
            aria-label={`${post.author.displayName}'s profile`}
          >
            {post.author.avatarUrl ? (
              <Image
                src={post.author.avatarUrl}
                alt={post.author.displayName}
                width={40}
                height={40}
                className="h-10 w-10 rounded-full border-2 border-white/20 object-cover ring-1 ring-degen-500/30"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white/20 bg-degen-500/20 text-sm font-bold text-degen-400">
                {post.author.displayName.charAt(0).toUpperCase()}
              </div>
            )}
          </a>
          <span
            className="mt-0.5 h-0.5 w-4 rounded-full"
            style={{ backgroundColor: protocolColor }}
          />
        </div>

        {/* Like */}
        <ActionButton
          icon={
            liked ? (
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )
          }
          label="Like"
          count={likeCount}
          active={liked}
          color="#ff2d55"
          onClick={handleLike}
        />

        {/* Comment */}
        <ActionButton
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          }
          label="Comment"
          count={post.metrics.replies > 0 ? post.metrics.replies : undefined}
          onClick={handleComment}
        />

        {/* Share */}
        <ActionButton
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          }
          label="Share"
          onClick={handleShare}
        />

        {/* Tip */}
        <ActionButton
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          }
          label="Tip"
          count={(post.tipCount ?? tipCount) > 0 ? (post.tipCount ?? tipCount) : undefined}
          color="#ffaa00"
          onClick={handleTip}
        />

        {/* Bookmark */}
        <ActionButton
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d={
                  bookmarked
                    ? 'M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z'
                    : 'M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z'
                }
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill={bookmarked ? 'currentColor' : 'none'}
              />
            </svg>
          }
          label={bookmarked ? 'Saved' : 'Bookmark'}
          active={bookmarked}
          color="#00bfff"
          onClick={handleBookmark}
        />
      </div>

      {/* == Bottom info overlay == */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-30 px-4 pb-6 pt-20 transition-all duration-300 ${
          showOverlay && !showInfoPanel
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
        onTouchStart={handleInfoTouchStart}
        onTouchEnd={handleInfoTouchEnd}
      >
        {/* Creator row */}
        <div className="mb-2 flex items-center gap-2">
          <a
            href={`/profile?protocol=${post.protocol}&id=${encodeURIComponent(post.author.id)}`}
            className="flex items-center gap-2 group"
          >
            {post.author.avatarUrl ? (
              <Image
                src={post.author.avatarUrl}
                alt={post.author.displayName}
                width={28}
                height={28}
                className="h-7 w-7 rounded-full border border-white/10 object-cover"
              />
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-degen-500/20 text-[10px] font-bold text-degen-400">
                {post.author.displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="text-sm font-semibold text-white drop-shadow-lg">
              {post.author.displayName}
            </span>
            <span className="text-xs text-white/60 drop-shadow-lg">@{authorHandle}</span>
            <span
              className="ml-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider"
              style={{ backgroundColor: `${protocolColor}22`, color: protocolColor }}
            >
              {post.protocol}
            </span>
          </a>
        </div>

        {/* Caption */}
        <div className="mb-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowCaption((prev) => !prev);
            }}
            className="block text-left"
            aria-expanded={showCaption}
            aria-label={showCaption ? 'Collapse caption' : 'Expand caption'}
          >
            <p className="text-sm leading-snug text-white/90 drop-shadow-lg">
              {showCaption ? post.text : truncateText(post.text, 80)}
            </p>
          </button>
        </div>

        {/* Hashtags */}
        {hashtags.length > 0 && (
          <div className="mb-1 flex flex-wrap gap-1.5">
            {hashtags.map((tag) => (
              <a
                key={tag}
                href={`/topics/${encodeURIComponent(tag.slice(1))}`}
                className="text-xs font-medium text-degen-400/90 transition-colors hover:text-degen-300 drop-shadow-lg"
              >
                {tag}
              </a>
            ))}
          </div>
        )}

        {/* Sound / Music */}
        <div className="mt-1 flex items-center gap-1.5">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className="text-white/50"
          >
            <path
              d="M9 18V5l12-2v13"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="18" cy="16" r="3" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          <span className="text-xs text-white/60 drop-shadow-lg">
            {post.protocol === 'rss'
              ? 'Podcast · RSS'
              : post.niches.length > 0
                ? `${post.niches[0]} · ${formatTimeAgo(post.createdAt)}`
                : formatTimeAgo(post.createdAt)}
          </span>
        </div>

        {/* Quick inline tip */}
        <div className="mt-1.5">
          <QuickTipButton
            recipientProtocol={post.protocol}
            recipientAuthorId={post.author.id}
            recipientDisplayName={post.author.displayName}
            publicationId={post.id}
            subtle
          />
        </div>

        {/* Swipe up hint */}
        {!showInfoPanel && (
          <div className="mt-3 flex items-center gap-1.5 opacity-40">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
              className="text-white/50"
            >
              <path
                d="M12 5v14M5 12l7 7 7-7"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="text-[9px] text-white/40">Swipe up for details</span>
          </div>
        )}
      </div>

      {/* == Video Info Panel == */}
      <VideoInfoPanel post={post} visible={showInfoPanel} />

      {/* == Close info panel button == */}
      {showInfoPanel && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowInfoPanel(false);
          }}
          className="absolute right-4 top-16 z-50 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 backdrop-blur-md transition-colors hover:bg-white/10"
          aria-label="Close info panel"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            className="text-white/70"
            aria-hidden="true"
          >
            <path
              d="M18 6L6 18M6 6l12 12"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}

      {/* == PeerTube external link == */}
      {isPeertube && !showInfoPanel && (
        <a
          href={videoInfo?.platform === 'peertube' ? videoInfo.url : '#'}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-36 right-16 z-30 inline-flex items-center gap-1.5 rounded-full border border-degen-500/30 bg-degen-500/10 px-3 py-1.5 text-xs font-medium text-degen-400 backdrop-blur-sm transition-all hover:bg-degen-500/20 hover:shadow-[0_0_12px_rgba(0,255,65,0.2)]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect
              x="4"
              y="4"
              width="16"
              height="16"
              rx="3"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path d="M10 9L16 12L10 15V9Z" fill="currentColor" />
          </svg>
          PeerTube
        </a>
      )}

      {/* == TipModal == */}
      <TipModal
        open={tipModalOpen}
        onClose={() => setTipModalOpen(false)}
        recipientProtocol={post.protocol}
        recipientAuthorId={post.author.id}
        recipientDisplayName={post.author.displayName}
        publicationId={post.id}
        postContext={{
          protocol: post.protocol,
          authorId: post.author.id,
          author: {
            evmAddress: post.author.keys.evmAddress,
            solanaAddress: post.author.keys.solanaAddress,
          },
        }}
      />

      {/* == Animations == */}
      <style>{`
        @keyframes shorts-heart-pop {
          0% { transform: scale(0.3); opacity: 0; }
          25% { transform: scale(1.5); opacity: 1; }
          50% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1) translateY(-30px); opacity: 0; }
        }
        @keyframes shorts-heart-orbit {
          0% { transform: rotate(var(--angle)) translateX(0) scale(0); opacity: 0; }
          30% { transform: rotate(var(--angle)) translateX(40px) scale(1); opacity: 1; }
          100% { transform: rotate(var(--angle)) translateX(60px) scale(0.5); opacity: 0; }
        }
        @keyframes shorts-panel-slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes emote-float {
          0% { transform: translateY(0) scale(0.5); opacity: 0; }
          15% { transform: translateY(-10px) scale(1.2); opacity: 1; }
          30% { transform: translateY(-20px) scale(1); opacity: 0.9; }
          100% { transform: translateY(-120px) scale(0.6); opacity: 0; }
        }
        @keyframes like-bump {
          0% { transform: scale(1); }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0.01ms !important; }
        }
      `}</style>
    </section>
  );
});
