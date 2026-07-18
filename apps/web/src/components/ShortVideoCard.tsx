'use client';

/**
 * @components/ShortVideoCard — Full-screen TikTok-style video overlay card.
 *
 * Renders the video player, right-side action rail (like, comment, share, tip, bookmark),
 * bottom info overlay (creator, caption, music), mute toggle, progress bar,
 * and long-press-to-pause.
 *
 * Accessibility: All action buttons have aria-labels, keyboard-operable,
 * visible focus indicators. Progress bar uses aria-valuenow.
 *
 * Design: Neon dark cyberpunk with degen-green accents. Glass-morphism overlays.
 * Transitions on overlay show/hide.
 */

import type { UnifiedPost } from '@degenfeed/types';
import { getProtocolColor, VideoPlayer } from '@degenfeed/ui';
import { formatTimeAgo, parseVideoUrl, type VideoInfo } from '@degenfeed/utils';
import Image from 'next/image';
import {
  memo,
  type PointerEvent as ReactPointerEvent,
  type TouchEvent as ReactTouchEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

// ─── Helpers ──────────────────────────────────────────────────────────────

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

// ─── Props ────────────────────────────────────────────────────────────────

interface ShortVideoCardProps {
  post: UnifiedPost;
  isActive: boolean;
  onPlayStateChange: (paused: boolean) => void;
}

// ─── Action Button ────────────────────────────────────────────────────────

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

// ─── Main Component ──────────────────────────────────────────────────────

export const ShortVideoCard = memo(function ShortVideoCard({
  post,
  isActive,
  onPlayStateChange,
}: ShortVideoCardProps) {
  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [muted, setMuted] = useState(true);
  const [showOverlay, setShowOverlay] = useState(true);
  const [progress, setProgress] = useState(0);
  const [tipCount, setTipCount] = useState(0);
  const [showCaption, setShowCaption] = useState(false);
  const overlayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressStartRef = useRef<number>(0);

  // Detect video info
  const videoInfo = useMemo<VideoInfo | null>(() => {
    for (const embed of post.embeds) {
      const info = parseVideoUrl(embed.url);
      if (info) return info;
    }
    return null;
  }, [post.embeds]);

  // YouTube ID fallback from text
  const textYoutubeId = useMemo(() => {
    if (videoInfo) return null;
    const match = post.text.match(/(?:v=|\/|youtu\.be\/)([\w-]{11})/);
    return match?.[1] ?? null;
  }, [post.text, videoInfo]);

  const youtubeId = videoInfo?.platform === 'youtube' ? videoInfo.id : (textYoutubeId ?? undefined);
  const isYoutube = !!youtubeId;
  const isDirect = videoInfo?.platform === 'direct';
  const isPeertube = videoInfo?.platform === 'peertube';

  const hashtags = useMemo(() => extractHashtags(post.text), [post.text]);
  const authorHandle = post.author.handles[post.protocol] ?? post.author.id.slice(0, 16);
  const protocolColor = getProtocolColor(post.protocol);

  // ── Mute toggle via keyboard event ──
  useEffect(() => {
    if (!isActive) return;
    const handler = () => setMuted((prev) => !prev);
    window.addEventListener('shorts-toggle-mute', handler);
    return () => window.removeEventListener('shorts-toggle-mute', handler);
  }, [isActive]);

  // ── Auto-hide overlay after 3s of inactivity ──
  const resetOverlayTimer = useCallback(() => {
    setShowOverlay(true);
    if (overlayTimer.current) clearTimeout(overlayTimer.current);
    overlayTimer.current = setTimeout(() => setShowOverlay(false), 3000);
  }, []);

  useEffect(() => {
    if (isActive) {
      resetOverlayTimer();
    } else {
      setShowOverlay(false);
      if (overlayTimer.current) clearTimeout(overlayTimer.current);
    }
    return () => {
      if (overlayTimer.current) clearTimeout(overlayTimer.current);
    };
  }, [isActive, resetOverlayTimer]);

  // ── Tap to toggle overlay ──
  const handleTap = useCallback(() => {
    if (showOverlay) {
      setShowOverlay(false);
    } else {
      resetOverlayTimer();
    }
  }, [showOverlay, resetOverlayTimer]);

  // ── Long press to pause ──
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handlePointerDown = useCallback(
    (_e: ReactPointerEvent | ReactTouchEvent) => {
      longPressTimer.current = setTimeout(() => {
        onPlayStateChange(true);
      }, 300);
    },
    [onPlayStateChange],
  );

  const handlePointerUp = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    onPlayStateChange(false);
  }, [onPlayStateChange]);

  // ── Timer-based progress bar (TikTok-style, estimated duration ~30s) ──
  useEffect(() => {
    if (!isActive) {
      if (progressTimer.current) {
        clearInterval(progressTimer.current);
        progressTimer.current = null;
      }
      setProgress(0);
      return;
    }

    // Reset progress when video becomes active
    setProgress(0);
    progressStartRef.current = Date.now();
    const ESTIMATED_DURATION_MS = 30_000; // Assume ~30s for shorts

    progressTimer.current = setInterval(() => {
      const elapsed = Date.now() - progressStartRef.current;
      const p = Math.min(elapsed / ESTIMATED_DURATION_MS, 1);
      setProgress(p);
      if (p >= 1 && progressTimer.current) {
        clearInterval(progressTimer.current);
        progressTimer.current = null;
      }
    }, 100); // Update 10fps for smooth bar

    return () => {
      if (progressTimer.current) {
        clearInterval(progressTimer.current);
        progressTimer.current = null;
      }
    };
  }, [isActive]);

  // ── Fetch PeerTube tip data ──
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

  // ── Like action ──
  const handleLike = useCallback(() => {
    setLiked((prev) => !prev);
    window.dispatchEvent(new CustomEvent('shorts-like-current'));
  }, []);

  // ── Bookmark action ──
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
      // Silently fail — IndexedDB may be unavailable
    }
    window.dispatchEvent(new CustomEvent('shorts-bookmark-current'));
  }, [bookmarked, post.id, post.dfUri, post.protocol, post.text, post.author.displayName]);

  // ── Share action ──
  const handleShare = useCallback(async () => {
    const url = `${window.location.origin}/post/${encodeURIComponent(post.id)}`;
    try {
      const { Share } = await import('@capacitor/share');
      await Share.share({ url, title: post.text.slice(0, 80) });
    } catch {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(url).catch(() => {});
      window.dispatchEvent(
        new CustomEvent('df-toast', {
          detail: { kind: 'success', message: 'Link copied!' },
        }),
      );
    }
  }, [post.id, post.text]);

  // ── Comment action ──
  const handleComment = useCallback(() => {
    window.location.href = `/post/${encodeURIComponent(post.id)}`;
  }, [post.id]);

  // ── Tip action ──
  const handleTip = useCallback(() => {
    window.dispatchEvent(new CustomEvent('shorts-tip-current'));
    // Navigate to post page for tipping
    window.location.href = `/post/${encodeURIComponent(post.id)}`;
  }, [post.id]);

  // ── Mute toggle ──
  const handleMute = useCallback(() => {
    setMuted((prev) => !prev);
  }, []);

  // ── Keyboard: Only handle when this card is the active one ──
  // (global keys handled by parent page)

  return (
    <section
      className="relative h-full w-full overflow-hidden bg-black"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onTouchStart={handlePointerDown}
      onTouchEnd={handlePointerUp}
      aria-label={`Video by ${post.author.displayName}`}
    >
      {/* ── Progress Bar ── */}
      {isYoutube ? (
        <div className="absolute left-0 right-0 top-0 z-30 h-0.5">
          <div className="h-full w-full bg-white/10">
            <div
              className="h-full bg-degen-400 transition-all duration-200 ease-linear"
              style={{ width: `${progress * 100}%` }}
              role="progressbar"
              aria-valuenow={Math.round(progress * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Video progress"
            />
          </div>
        </div>
      ) : (
        /* HTML5 video: progress tracked inside VideoPlayer — show a thin overlay bar */
        <div className="absolute left-0 right-0 top-0 z-30 h-0.5">
          <div className="h-full w-full bg-white/10">
            <div
              className="h-full bg-degen-400 transition-all duration-200 ease-linear"
              style={{ width: `${progress * 100}%` }}
              role="progressbar"
              aria-valuenow={Math.round(progress * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Video progress"
            />
          </div>
        </div>
      )}

      {/* ── Video Player ── */}
      <div
        className="absolute inset-0"
        onClick={handleTap}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleTap();
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
            onPlay={() => onPlayStateChange(false)}
            onPause={() => onPlayStateChange(true)}
            className="h-full w-full"
          />
        ) : isDirect && videoInfo?.platform === 'direct' ? (
          <VideoPlayer
            src={videoInfo.url}
            platform="direct"
            aspectRatio="9:16"
            title={post.text}
            showMetadata={false}
            onPlay={() => onPlayStateChange(false)}
            onPause={() => onPlayStateChange(true)}
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
            onPlay={() => onPlayStateChange(false)}
            onPause={() => onPlayStateChange(true)}
            className="h-full w-full"
          />
        ) : (
          /* Fallback: show thumbnail with play link */
          <div className="flex h-full w-full items-center justify-center bg-gray-950">
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
              <p className="text-xs text-gray-500">Video unavailable</p>
              <a
                href={post.embeds[0]?.url ?? '#'}
                target="_blank" rel="noopener noreferrer"
                rel="noopener noreferrer"
                className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
              >
                Open original
              </a>
            </div>
          </div>
        )}

        {/* ── Left-side gradient (for readability) ── */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
      </div>

      {/* ── Mute/Unmute button (top-right) ── */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleMute();
        }}
        className={`absolute right-4 top-16 z-30 flex h-9 w-9 items-center justify-center rounded-full backdrop-blur-md transition-all ${
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

      {/* ── Right-side action rail ── */}
      <div
        className={`absolute bottom-28 right-3 z-30 flex flex-col items-center gap-3 transition-opacity duration-300 sm:bottom-32 ${
          showOverlay ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Avatar / Creator (top of rail on mobile) */}
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
          {/* Follow indicator line */}
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
          count={post.metrics.likes + (liked ? 1 : 0)}
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
          count={post.metrics.reposts > 0 ? post.metrics.reposts : undefined}
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

      {/* ── Bottom info overlay ── */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-30 px-4 pb-8 pt-20 transition-opacity duration-300 ${
          showOverlay ? 'opacity-100' : 'opacity-0'
        }`}
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

        {/* Music / Sound */}
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
      </div>

      {/* ── No video available overlay — PeerTube tip button ── */}
      {isPeertube && (
        <a
          href={videoInfo?.platform === 'peertube' ? videoInfo.url : '#'}
          target="_blank" rel="noopener noreferrer"
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
          Watch on PeerTube
        </a>
      )}
    </section>
  );
});
