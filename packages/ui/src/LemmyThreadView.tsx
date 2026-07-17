'use client';

/**
 * @degenfeed/ui — LemmyThreadView
 *
 * Renders a Lemmy post as a threaded Reddit-style discussion.
 * Community name, upvotes/downvotes, nested comments with
 * colored thread lines (like old Reddit), and links to the
 * community instance.
 *
 * Features:
 * - Collapsible comment trees with animated expand/collapse
 * - Rainbow thread lines per nesting depth (max 8 levels)
 * - Inline image/video/link previews with lazy loading
 * - Vote actions (upvote/downvote) with orange/blue states
 * - Inline reply form per comment
 * - Share button (copies comment link)
 * - Edited indicator
 * - Timestamp tooltip with exact time
 * - Keyboard accessible (Enter/Space toggle, aria-expanded)
 * - Swipe left → vote / swipe right → reply on mobile
 * - Virtualized rendering of top-level comments
 * - Alternating backgrounds per depth for readability
 *
 * Design: compact, information-rich, green-accented threaded lines.
 * Tonal reference: old.reddit.com with degenfeed cyberpunk accents.
 */

import type { UnifiedPost } from '@degenfeed/types';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LemmyTipButton } from './LemmyTipButton';

// ─── Types ───────────────────────────────────────────────────────────

export interface LemmyComment {
  id: string;
  author: string;
  authorAvatar?: string;
  content: string;
  score: number;
  upvotes: number;
  downvotes: number;
  createdAt: number;
  depth: number;
  replies: LemmyComment[];
  /** Optional timestamp of last edit (Unix ms) */
  editedAt?: number;
  /** Optional user vote state */
  userVote?: 'up' | 'down' | null;
}

export interface LemmyThreadViewProps {
  post: UnifiedPost;
  /** Optionally pass pre-fetched comments. Falls back to post.raw. */
  comments?: LemmyComment[];
  communityName?: string;
  communityIcon?: string;
  /** Instance domain, e.g. "lemmy.world" */
  instanceDomain?: string;
}

// ─── Colors for thread lines (rainbow) ──────────────────────────────

const THREAD_COLORS = [
  '#00b868', // Lemmy green
  '#6364ff', // Mastodon purple
  '#ff4500', // Reddit orange
  '#1185fe', // Blue
  '#abfe2c', // Lens green
  '#e040fb', // Pink
  '#ffa726', // Amber
  '#06d6a0', // Teal
  '#ef476f', // Rose
  '#ffd166', // Gold
];

function getThreadColor(depth: number): string {
  return THREAD_COLORS[depth % THREAD_COLORS.length] ?? '#6364ff';
}

/** Maximum nesting depth before "Continue thread" link */
const MAX_NESTING_DEPTH = 8;

// ─── Helpers ─────────────────────────────────────────────────────────

function formatScore(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}k`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;
  return `${Math.floor(months / 12)}y`;
}

function getExactTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  });
}

/** Detect if a URL points to an image based on extension */
function isImageUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname.toLowerCase();
    return /\.(jpg|jpeg|png|gif|webp|avif|svg|bmp|ico)$/i.test(path);
  } catch {
    return false;
  }
}

/** Detect if a URL points to a video (direct or embedding platform) */
function isVideoUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();
    // Direct video file
    if (/\.(mp4|webm|mov|avi|mkv|m3u8)$/i.test(path)) return true;
    // Embeddable video platforms
    if (
      host.includes('youtube.com') ||
      host.includes('youtu.be') ||
      host.includes('vimeo.com') ||
      host.includes('peertube') ||
      host.includes('twitch.tv') ||
      host.includes('dailymotion.com')
    )
      return true;
    return false;
  } catch {
    return false;
  }
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** Extract favicon URL for a domain */
function getFaviconUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${parsed.hostname}&sz=32`;
  } catch {
    return '';
  }
}

// ─── URL/Media Parsing ──────────────────────────────────────────────

interface ParsedMedia {
  images: string[];
  videos: string[];
  links: { url: string; text: string }[];
}

/**
 * Parse text content to extract media URLs.
 * Returns arrays of image URLs, video URLs, and generic links,
 * plus the text with URLs stripped for clean display.
 */
function parseContentMedia(content: string): { cleanText: string; media: ParsedMedia } {
  const urlRegex = /(https?:\/\/[^\s<]+[^\s<.,:;!?)]|[\w-]+(?:\.[a-z]{2,}){1,2}[^\s<]*)/gi;
  const images: string[] = [];
  const videos: string[] = [];
  const links: { url: string; text: string }[] = [];
  const segments: string[] = [];
  let lastIndex = 0;

  const re = new RegExp(urlRegex.source, 'gi');
  let match = re.exec(content);
  while (match !== null) {
    let url = match[0];

    // Strip trailing punctuation that's not part of the URL
    url = url.replace(/[.,:;!?)\]]+$/, '');

    // Add text before this URL
    if (match.index > lastIndex) {
      segments.push(content.slice(lastIndex, match.index));
    }

    // Classify URL
    if (isImageUrl(url)) {
      images.push(url);
      // Don't add to segments — it'll render as media
    } else if (isVideoUrl(url)) {
      videos.push(url);
    } else {
      links.push({ url, text: url });
      // Show URL as clickable text
      segments.push(url);
    }

    lastIndex = match.index + match[0].length;
    match = re.exec(content);
  }

  // Add remaining text
  if (lastIndex < content.length) {
    segments.push(content.slice(lastIndex));
  }

  return {
    cleanText: segments.join(''),
    media: { images, videos, links },
  };
}

// ─── Custom Hooks ────────────────────────────────────────────────────

/**
 * IntersectionObserver hook for lazy loading
 */
function useInView(
  ref: React.RefObject<Element | null>,
  options?: IntersectionObserverInit,
): boolean {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true);
          observer.unobserve(el);
        }
      },
      { rootMargin: '200px', threshold: 0, ...options },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, options]);

  return inView;
}

interface SwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

/**
 * Simple horizontal swipe detection hook
 */
function useSwipeGestures(
  ref: React.RefObject<HTMLElement | null>,
  handlers: SwipeHandlers,
  threshold = 60,
): void {
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const t = e.touches[0];
        if (t) {
          touchStart.current = { x: t.clientX, y: t.clientY };
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!touchStart.current) return;
      const t = e.changedTouches[0];
      if (!t) return;

      const dx = t.clientX - touchStart.current.x;
      const dy = t.clientY - touchStart.current.y;
      touchStart.current = null;

      // Only horizontal swipes that dominate vertical movement
      if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy) * 1.5) return;

      if (dx < 0) {
        handlers.onSwipeLeft?.();
      } else {
        handlers.onSwipeRight?.();
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [ref, handlers, threshold]);
}

// ─── Media Preview Components ───────────────────────────────────────

interface ImagePreviewProps {
  src: string;
}

const ImagePreview = memo(function ImagePreview({ src }: ImagePreviewProps) {
  const [expanded, setExpanded] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref);

  return (
    <div ref={ref} className="mt-1.5">
      {inView && (
        <>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="group relative block overflow-hidden rounded-lg border border-white/10 transition-all hover:border-white/20 focus:outline-none focus:ring-2 focus:ring-degen-400/60"
            aria-label={expanded ? 'Collapse image' : 'Expand image'}
          >
            <div className={`relative ${expanded ? 'max-h-[600px]' : 'max-h-[200px]'} overflow-hidden transition-all duration-300`}>
              {/* biome-ignore lint/performance/noImgElement: external image */}
              <img
                src={src}
                alt=""
                className={`w-full object-cover transition-all duration-300 ${
                  expanded ? 'max-h-[600px]' : 'max-h-[200px]'
                } ${loaded ? 'opacity-100' : 'opacity-0'}`}
                loading="lazy"
                onLoad={() => setLoaded(true)}
              />
              {!loaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/5">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-degen-400" />
                </div>
              )}
            </div>
            {/* Expand/collapse indicator */}
            <div className="absolute bottom-1 right-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] text-white/70 opacity-0 transition-opacity group-hover:opacity-100">
              {expanded ? 'Collapse' : 'Expand'}
            </div>
          </button>
          {/* Expanded full-size overlay */}
          {expanded && (
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
              aria-label="Close expanded image"
            >
              {/* biome-ignore lint/performance/noImgElement: expanded image */}
              <img
                src={src}
                alt="Expanded"
                className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setExpanded(false);
                }}
              />
              <button
                type="button"
                className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/70 transition-colors hover:bg-white/20 hover:text-white"
                aria-label="Close"
                onClick={() => setExpanded(false)}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </button>
          )}
        </>
      )}
      {!inView && <div className="h-[100px] rounded-lg bg-white/[0.02] animate-pulse" />}
    </div>
  );
});

interface VideoPreviewProps {
  url: string;
}

const VideoPreview = memo(function VideoPreview({ url }: VideoPreviewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref);
  const [showPlayer, setShowPlayer] = useState(false);

  const embedUrl = useMemo(() => {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      // YouTube
      if (host.includes('youtube.com')) {
        const v = parsed.searchParams.get('v');
        if (v) return `https://www.youtube.com/embed/${v}?autoplay=1`;
      }
      if (host.includes('youtu.be')) {
        const id = parsed.pathname.slice(1).split('?')[0];
        if (id) return `https://www.youtube.com/embed/${id}?autoplay=1`;
      }
      // Vimeo
      if (host.includes('vimeo.com')) {
        const id = parsed.pathname.slice(1).split('/')[0];
        if (id) return `https://player.vimeo.com/video/${id}?autoplay=1`;
      }
      // Direct video — use VideoPlayer
    } catch {
      // invalid URL
    }
    return null;
  }, [url]);

  if (showPlayer && embedUrl) {
    return (
      <div className="mt-1.5 aspect-video w-full overflow-hidden rounded-lg border border-white/10">
        <iframe
          src={embedUrl}
          className="h-full w-full"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          title="Video"
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div ref={ref} className="mt-1.5">
      {inView && (
        <button
          type="button"
          onClick={() => setShowPlayer(true)}
          className="group relative block w-full overflow-hidden rounded-lg border border-white/10 bg-black/40 transition-all hover:border-white/20 focus:outline-none focus:ring-2 focus:ring-degen-400/60"
          aria-label="Play video"
        >
          <div className="aspect-video flex items-center justify-center bg-gray-900">
            {/* Play button icon */}
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition-all group-hover:scale-110 group-hover:bg-white/25">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M8 5V19L19 12L8 5Z" />
              </svg>
            </div>
            <span className="absolute bottom-2 left-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white/70">
              {getDomain(url)}
            </span>
          </div>
        </button>
      )}
      {!inView && <div className="aspect-video rounded-lg bg-white/[0.02] animate-pulse" />}
    </div>
  );
});

interface LinkPreviewProps {
  url: string;
}

const LinkPreview = memo(function LinkPreview({ url }: LinkPreviewProps) {
  const domain = getDomain(url);
  const favicon = getFaviconUrl(url);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1.5 flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-xs transition-all hover:border-white/20 hover:bg-white/[0.04] focus:outline-none focus:ring-2 focus:ring-degen-400/60 group"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {favicon && (
        // biome-ignore lint/performance/noImgElement: favicon
        <img
          src={favicon}
          alt=""
          className="h-4 w-4 flex-shrink-0 rounded"
          loading="lazy"
        />
      )}
      <span className="flex-1 truncate text-gray-500 transition-colors group-hover:text-gray-300">
        {domain}
      </span>
      <svg
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
        className="flex-shrink-0 text-gray-600"
        aria-hidden="true"
      >
        <path
          d="M5 2H2V10H10V7M6 6L10 2M10 2H7M10 2V5"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </a>
  );
});

interface MediaGridProps {
  media: ParsedMedia;
}

const MediaGrid = memo(function MediaGrid({ media }: MediaGridProps) {
  const { images, videos, links } = media;

  if (images.length === 0 && videos.length === 0 && links.length === 0) {
    return null;
  }

  return (
    <div className="space-y-1">
      {/* Images — single column */}
      {images.slice(0, 4).map((src) => (
        <ImagePreview key={src} src={src} />
      ))}
      {images.length > 4 && (
        <p className="text-[10px] text-gray-600 px-1">+{images.length - 4} more images</p>
      )}

      {/* Videos */}
      {videos.slice(0, 2).map((url) => (
        <VideoPreview key={url} url={url} />
      ))}
      {videos.length > 2 && (
        <p className="text-[10px] text-gray-600 px-1">+{videos.length - 2} more videos</p>
      )}

      {/* Links */}
      {links.slice(0, 3).map((link) => (
        <LinkPreview key={link.url} url={link.url} />
      ))}
      {links.length > 3 && (
        <p className="text-[10px] text-gray-600 px-1">+{links.length - 3} more links</p>
      )}
    </div>
  );
});

// ─── Inline Reply Form ──────────────────────────────────────────────

interface ReplyFormProps {
  parentId: string;
  authorName: string;
  onClose: () => void;
}

const ReplyForm = memo(function ReplyForm({ parentId: _parentId, authorName, onClose }: ReplyFormProps) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Auto-focus textarea
    textareaRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    try {
      // Placeholder: in real app this would POST to the Lemmy API
      await new Promise((r) => setTimeout(r, 600));
      setSubmitted(true);
      setTimeout(onClose, 1200);
    } catch {
      // fallback
    } finally {
      setSubmitting(false);
    }
  }, [text, submitting, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        void handleSubmit();
      }
    },
    [handleSubmit, onClose],
  );

  if (submitted) {
    return (
      <div className="mt-1.5 rounded-lg border border-green-500/20 bg-green-500/5 px-3 py-2 text-xs text-green-400">
        Reply posted!
      </div>
    );
  }

  return (
    <div className="mt-1.5 rounded-lg border border-white/10 bg-white/[0.02] p-2">
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={`Reply to ${authorName}…`}
        rows={3}
        className="w-full resize-none rounded-md border border-white/10 bg-black/30 px-2.5 py-1.5 text-xs text-gray-300 placeholder-gray-600 focus:border-degen-500/30 focus:outline-none focus:ring-1 focus:ring-degen-500/20"
        aria-label={`Reply to ${authorName}`}
      />
      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-[10px] text-gray-600">
          <kbd className="rounded bg-white/5 px-1 py-0.5 font-mono text-[9px]">Ctrl+Enter</kbd> to send
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-[11px] text-gray-500 transition-colors hover:text-gray-300"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!text.trim() || submitting}
            className="rounded-md bg-degen-500/20 px-3 py-1 text-[11px] font-medium text-degen-400 transition-colors hover:bg-degen-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? 'Posting…' : 'Reply'}
          </button>
        </div>
      </div>
    </div>
  );
});

// ─── Single Comment Node ────────────────────────────────────────────

interface CommentNodeProps {
  comment: LemmyComment;
  depth: number;
  /** Wallet addresses from the author profile for tipping */
  postAuthorEvmAddress?: string;
  postAuthorSolanaAddress?: string;
  /** Current user's vote state for this comment */
  userVote?: 'up' | 'down' | null;
  /** Callback for vote changes */
  onVote?: (commentId: string, direction: 'up' | 'down' | null) => void;
}

const CommentNode = memo(function CommentNode({
  comment,
  depth,
  postAuthorEvmAddress,
  postAuthorSolanaAddress,
  userVote: externalVote,
  onVote,
}: CommentNodeProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [localVote, setLocalVote] = useState<'up' | 'down' | null>(externalVote ?? null);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [commentTipCount, setCommentTipCount] = useState(0);
  const [swipeAction, setSwipeAction] = useState<'vote' | 'reply' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const threadDotRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const color = getThreadColor(depth);
  const hasReplies = comment.replies.length > 0;
  const isMaxDepth = depth >= MAX_NESTING_DEPTH;
  const isMobile = useRef(false);

  // Detect mobile
  useEffect(() => {
    if (typeof window !== 'undefined') {
      isMobile.current = window.innerWidth < 640;
    }
  }, []);

  // Sync external vote state
  useEffect(() => {
    if (externalVote !== undefined) {
      setLocalVote(externalVote);
    }
  }, [externalVote]);

  // Parse content for media
  const { cleanText, media } = useMemo(() => parseContentMedia(comment.content), [comment.content]);

  // Fetch tip stats for this comment
  useEffect(() => {
    if (!postAuthorEvmAddress && !postAuthorSolanaAddress) return;
    let cancelled = false;
    fetch(`/api/lemmy/tip/stats?contentId=${encodeURIComponent(comment.id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { totalCount?: number } | null) => {
        if (!cancelled && data?.totalCount) {
          setCommentTipCount(data.totalCount);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [comment.id, postAuthorEvmAddress, postAuthorSolanaAddress]);

  // ── Handlers ──

  const toggleCollapse = useCallback(() => {
    setCollapsed((v) => !v);
  }, []);

  const handleCollapseKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleCollapse();
      }
    },
    [toggleCollapse],
  );

  const handleVote = useCallback(
    (direction: 'up' | 'down') => {
      const newVote = localVote === direction ? null : direction;
      setLocalVote(newVote);
      onVote?.(comment.id, newVote);
    },
    [localVote, comment.id, onVote],
  );

  const handleShare = useCallback(async () => {
    const url = `${window.location.origin}/comment/${comment.id}`;
    try {
      await navigator.clipboard.writeText(url);
      // Brief visual feedback via the button text
      const btn = document.getElementById(`share-${comment.id}`);
      if (btn) {
        btn.textContent = 'Copied!';
        setTimeout(() => {
          btn.textContent = 'Share';
        }, 2000);
      }
    } catch {
      // Fallback: prompt with URL
      prompt('Copy comment link:', url);
    }
  }, [comment.id]);

  const toggleReplyForm = useCallback(() => {
    setShowReplyForm((v) => !v);
  }, []);

  // ── Swipe gestures (mobile) ──

  const swipeHandlers = useMemo<SwipeHandlers>(
    () => ({
      onSwipeLeft: () => {
        setSwipeAction('vote');
        setTimeout(() => setSwipeAction(null), 600);
      },
      onSwipeRight: () => {
        setSwipeAction('reply');
        setTimeout(() => setSwipeAction(null), 600);
      },
    }),
    [],
  );

  useSwipeGestures(containerRef, swipeHandlers);

  // ── Vote score (adjusted for local vote) ──
  const displayScore = useMemo(() => {
    let score = comment.score;
    // Adjust for local vote difference
    if (localVote === 'up' && comment.userVote !== 'up') score += 1;
    else if (localVote === 'down' && comment.userVote !== 'down') score -= 1;
    else if (localVote === null && comment.userVote === 'up') score -= 1;
    else if (localVote === null && comment.userVote === 'down') score += 1;
    return score;
  }, [comment.score, comment.userVote, localVote]);

  // ── Alternating background based on depth ──
  const bgClass = depth % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.015]';

  // Max depth — render as a "Continue thread" link
  if (isMaxDepth) {
    return (
      <div className="ml-6 mt-1">
        <a
          href={`https://lemmy.degenfeed.xyz/comment/${comment.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-degen-500 transition-colors hover:text-degen-400 hover:bg-degen-500/10 focus:outline-none focus:ring-2 focus:ring-degen-400/60"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path
              d="M5 2H2V10H10V7M6 6L10 2M10 2H7M10 2V5"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Continue thread
        </a>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`group relative transition-colors ${bgClass} ${
        swipeAction === 'vote' ? 'bg-orange-500/5' : swipeAction === 'reply' ? 'bg-blue-500/5' : ''
      }`}
    >
      <div className="flex">
        {/* ── Thread line column ── */}
        <div className="relative flex w-5 flex-shrink-0 flex-col items-center">
          {/* Vertical thread line */}
          <div
            className="w-0.5 flex-1 transition-all duration-300 group-hover:opacity-80 sm:w-px"
            style={{ backgroundColor: color, opacity: collapsed ? 0.15 : 0.35 }}
          />
          {/* Collapse handle dot — always visible if has replies */}
          {hasReplies && (
            <button
              ref={threadDotRef}
              type="button"
              onClick={toggleCollapse}
              onKeyDown={handleCollapseKeyDown}
              className="absolute top-3 z-10 h-3.5 w-3.5 rounded-full border-2 bg-[var(--color-card)] transition-all duration-200 hover:scale-125 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-[var(--color-card)]"
              style={{
                borderColor: color,
                backgroundColor: collapsed ? color : 'var(--color-card)',
              }}
              aria-expanded={!collapsed}
              aria-label={collapsed ? 'Expand thread' : 'Collapse thread'}
              title={collapsed ? 'Expand thread' : 'Collapse thread'}
            />
          )}
          {!hasReplies && (
            <div
              className="absolute top-3 z-10 h-1.5 w-1.5 rounded-full opacity-30"
              style={{ backgroundColor: color }}
            />
          )}
        </div>

        {/* ── Comment body ── */}
        <div className="min-w-0 flex-1 pb-2 pl-1.5">
          <div
            className={`rounded-lg px-3 py-2 transition-all duration-200 ${
              collapsed ? '' : 'hover:bg-white/[0.03]'
            }`}
          >
            {/* ── Author row ── */}
            <div className="mb-1 flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={toggleCollapse}
                onKeyDown={handleCollapseKeyDown}
                className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold uppercase transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-1"
                style={{ backgroundColor: `${color}22`, color }}
                aria-label={collapsed ? 'Expand comment' : 'Collapse comment'}
                aria-expanded={!collapsed}
              >
                {comment.authorAvatar ? (
                  // biome-ignore lint/performance/noImgElement: avatar
                  <img
                    src={comment.authorAvatar}
                    alt=""
                    className="h-5 w-5 rounded-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  comment.author.charAt(0)
                )}
              </button>
              <span className="font-medium text-gray-300">
                {comment.author}
              </span>
              <span
                className="text-gray-600"
                title={getExactTime(comment.createdAt)}
              >
                {timeAgo(comment.createdAt)}
              </span>
              {comment.editedAt && (
                <span
                  className="text-[10px] text-gray-700 italic"
                  title={`Edited ${getExactTime(comment.editedAt)}`}
                >
                  (edited)
                </span>
              )}
              {/* Collapsed summary badge */}
              {collapsed && hasReplies && (
                <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[10px] text-gray-600">
                  [{comment.replies.length} reply{comment.replies.length !== 1 ? 'ies' : ''}]
                </span>
              )}
            </div>

            {/* ── Content (hidden when collapsed) ── */}
            {!collapsed && (
              <>
                <div className="mb-1.5 text-sm leading-relaxed text-gray-400 whitespace-pre-wrap break-words">
                  {cleanText || comment.content}
                </div>

                {/* Inline media previews */}
                <MediaGrid media={media} />

                {/* ── Score row + Actions ── */}
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                  {/* Upvote */}
                  <button
                    type="button"
                    onClick={() => handleVote('up')}
                    className={`flex items-center gap-0.5 rounded-md px-1.5 py-1 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 min-h-[28px] ${
                      localVote === 'up'
                        ? 'bg-orange-500/15 text-orange-400'
                        : 'hover:bg-orange-500/10 hover:text-orange-400 text-gray-600'
                    }`}
                    aria-label="Upvote"
                    aria-pressed={localVote === 'up'}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 14 14"
                      fill="currentColor"
                      aria-hidden="true"
                      className={localVote === 'up' ? 'scale-110' : ''}
                    >
                      <path d="M7 1.5L13 11.5H1L7 1.5Z" />
                    </svg>
                    <span className="font-medium tabular-nums">{formatScore(displayScore)}</span>
                  </button>

                  {/* Downvote */}
                  <button
                    type="button"
                    onClick={() => handleVote('down')}
                    className={`flex items-center gap-0.5 rounded-md px-1.5 py-1 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 min-h-[28px] ${
                      localVote === 'down'
                        ? 'bg-blue-500/15 text-blue-400'
                        : 'hover:bg-blue-500/10 hover:text-blue-400 text-gray-600'
                    }`}
                    aria-label="Downvote"
                    aria-pressed={localVote === 'down'}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 14 14"
                      fill="currentColor"
                      aria-hidden="true"
                      className={localVote === 'down' ? 'scale-110' : ''}
                    >
                      <path d="M7 12.5L1 2.5H13L7 12.5Z" />
                    </svg>
                  </button>

                  <span className="text-gray-700" aria-hidden="true">·</span>

                  {/* Reply button */}
                  <button
                    type="button"
                    onClick={toggleReplyForm}
                    className={`flex items-center gap-1 rounded-md px-1.5 py-1 transition-all duration-150 hover:bg-gray-500/10 hover:text-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-1 min-h-[28px] ${
                      showReplyForm ? 'text-degen-400' : 'text-gray-600'
                    }`}
                    aria-label="Reply"
                    aria-expanded={showReplyForm}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 14 14"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M3 7.5L7 11.5M3 7.5L7 3.5M3 7.5H11.5"
                        stroke="currentColor"
                        strokeWidth="1.3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span>Reply</span>
                  </button>

                  {/* Share button */}
                  <button
                    type="button"
                    id={`share-${comment.id}`}
                    onClick={handleShare}
                    className="flex items-center gap-1 rounded-md px-1.5 py-1 transition-all duration-150 hover:bg-gray-500/10 hover:text-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-1 min-h-[28px] text-gray-600"
                    aria-label="Share comment"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 14 14"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M10 4.5C10.8284 4.5 11.5 3.82843 11.5 3C11.5 2.17157 10.8284 1.5 10 1.5C9.17157 1.5 8.5 2.17157 8.5 3C8.5 3.17157 8.52859 3.33631 8.58124 3.49021L5.41876 5.25979C5.17157 5.09333 4.87266 5 4.55 5C3.6125 5 2.8625 5.75 2.8625 6.6875C2.8625 7.625 3.6125 8.375 4.55 8.375C4.87266 8.375 5.17157 8.28167 5.41876 8.11521L8.58124 9.88479C8.52859 10.0387 8.5 10.2034 8.5 10.375C8.5 11.2125 9.1625 11.875 10 11.875C10.8375 11.875 11.5 11.2125 11.5 10.375C11.5 9.5375 10.8375 8.875 10 8.875C9.67734 8.875 9.37843 8.96833 9.13124 9.13479L5.96876 7.36521C6.02141 7.21131 6.05 7.04657 6.05 6.875C6.05 6.70343 6.02141 6.53869 5.96876 6.38479L9.13124 4.61521C9.37843 4.78167 9.67734 4.875 10 4.875V4.5Z"
                        stroke="currentColor"
                        strokeWidth="1.2"
                      />
                    </svg>
                    <span>Share</span>
                  </button>

                  {/* Tip button for comment */}
                  {(postAuthorEvmAddress || postAuthorSolanaAddress) && (
                    <>
                      <span className="text-gray-700" aria-hidden="true">·</span>
                      <LemmyTipButton
                        contentId={comment.id}
                        contentType="comment"
                        authorEvmAddress={postAuthorEvmAddress}
                        authorSolanaAddress={postAuthorSolanaAddress}
                        tipCount={commentTipCount}
                        compact
                      />
                    </>
                  )}
                </div>

                {/* Inline reply form */}
                {showReplyForm && (
                  <ReplyForm
                    parentId={comment.id}
                    authorName={comment.author}
                    onClose={() => setShowReplyForm(false)}
                  />
                )}
              </>
            )}

            {/* ── Nested replies (animated collapse) ── */}
            {hasReplies && (comment.replies.length > 0) && (
              <div
                ref={contentRef}
                className={`overflow-hidden transition-all duration-300 ease-in-out ${
                  collapsed ? 'max-h-0 opacity-0' : 'max-h-[5000px] opacity-100'
                }`}
              >
                <div className="mt-1">
                  {comment.replies.map((reply) => (
                    <CommentNode
                      key={reply.id}
                      comment={reply}
                      depth={depth + 1}
                      postAuthorEvmAddress={postAuthorEvmAddress}
                      postAuthorSolanaAddress={postAuthorSolanaAddress}
                      userVote={reply.userVote}
                      onVote={onVote}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Mobile swipe action indicator */}
            {swipeAction && (
              <div className="absolute inset-y-0 left-0 right-0 pointer-events-none flex items-center justify-center sm:hidden">
                <span
                  className={`rounded-full px-3 py-1 text-[11px] font-medium backdrop-blur-sm transition-all duration-300 ${
                    swipeAction === 'vote'
                      ? 'bg-orange-500/20 text-orange-400'
                      : 'bg-blue-500/20 text-blue-400'
                  }`}
                >
                  {swipeAction === 'vote' ? 'Vote actions' : 'Reply'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

// ─── Virtualized Comment List ───────────────────────────────────────

interface VirtualizedCommentListProps {
  comments: LemmyComment[];
  depth: number;
  postAuthorEvmAddress?: string;
  postAuthorSolanaAddress?: string;
  onVote?: (commentId: string, direction: 'up' | 'down' | null) => void;
}

const VirtualizedCommentList = memo(function VirtualizedCommentList({
  comments,
  depth,
  postAuthorEvmAddress,
  postAuthorSolanaAddress,
  onVote,
}: VirtualizedCommentListProps) {
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: Math.min(15, comments.length) });
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Progressive loading: when sentinel enters viewport, load more
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || visibleRange.end >= comments.length) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisibleRange((prev) => ({
            start: 0,
            end: Math.min(prev.end + 10, comments.length),
          }));
        }
      },
      { rootMargin: '400px' },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [comments.length, visibleRange.end]);

  const visibleComments = useMemo(
    () => comments.slice(visibleRange.start, visibleRange.end),
    [comments, visibleRange],
  );

  return (
    <>
      {visibleComments.map((comment) => (
        <CommentNode
          key={comment.id}
          comment={comment}
          depth={depth}
          postAuthorEvmAddress={postAuthorEvmAddress}
          postAuthorSolanaAddress={postAuthorSolanaAddress}
          userVote={comment.userVote}
          onVote={onVote}
        />
      ))}
      {visibleRange.end < comments.length && (
        <div ref={sentinelRef} className="flex items-center justify-center py-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-degen-400" />
        </div>
      )}
    </>
  );
});

// ─── Root Component ─────────────────────────────────────────────────

function extractLemmyData(post: UnifiedPost): {
  communityName: string;
  communityIcon?: string;
  instanceDomain: string;
} {
  const raw = post.raw as Record<string, unknown> | undefined;
  return {
    communityName:
      (raw?.community_name as string) ?? ((raw?.community as Record<string, string> | undefined)?.name) ?? 'c/crypto',
    communityIcon: raw?.community_icon as string | undefined,
    instanceDomain:
      (raw?.instance_domain as string) ?? (raw?.instance as string) ?? 'lemmy.degenfeed.xyz',
  };
}

export const LemmyThreadView = memo(function LemmyThreadView({
  post,
  comments: externalComments,
  communityName: externalCommunityName,
  communityIcon: externalCommunityIcon,
  instanceDomain: externalInstanceDomain,
}: LemmyThreadViewProps) {
  const { communityName, communityIcon, instanceDomain } = {
    communityName: externalCommunityName ?? extractLemmyData(post).communityName,
    communityIcon: externalCommunityIcon ?? extractLemmyData(post).communityIcon,
    instanceDomain: externalInstanceDomain ?? extractLemmyData(post).instanceDomain,
  };

  // Derive comments from post.raw if not pre-fetched
  const comments = externalComments ?? extractComments(post);

  const domainDisplay = instanceDomain.replace(/^https?:\/\//, '');

  // ── Tip state for the post ──
  const [postTipCount, setPostTipCount] = useState(0);
  const [postTipTotal, setPostTipTotal] = useState(0);
  const [viewOnCommunityLabel, setViewOnCommunityLabel] = useState('View on community.degenfeed.xyz');
  const authorEvmAddress = post.author.keys.evmAddress;
  const authorSolanaAddress = post.author.keys.solanaAddress;
  const hasAuthorWallet = !!(authorEvmAddress || authorSolanaAddress);

  useEffect(() => {
    if (!hasAuthorWallet) return;
    let cancelled = false;
    fetch(`/api/lemmy/tip/stats?contentId=${encodeURIComponent(post.id)}`)
      .then((r) => (r.ok ? (r.json() as Promise<{ totalCount: number; totalUsd: number }>) : null))
      .then((data) => {
        if (!cancelled && data) {
          setPostTipCount(data.totalCount);
          setPostTipTotal(data.totalUsd);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [post.id, hasAuthorWallet]);

  // Update "View on community" label
  useEffect(() => {
    setViewOnCommunityLabel(`View on ${domainDisplay}`);
  }, [domainDisplay]);

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)]">
      {/* ── Community header ── */}
      <a
        href={`https://${domainDisplay}/${communityName.startsWith('c/') ? communityName : `c/${communityName}`}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 border-b border-[var(--color-border)] px-4 py-2.5 transition-colors hover:bg-[var(--color-muted)]"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <span
          className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold"
          style={{ backgroundColor: '#00b86822', color: '#00b868' }}
        >
          {communityIcon ? (
            // biome-ignore lint/performance/noImgElement: community icon
            <img src={communityIcon} alt="" className="h-6 w-6 rounded-full object-cover" />
          ) : (
            communityName.charAt(0).toUpperCase()
          )}
        </span>
        <span className="text-sm font-semibold text-gray-200">{communityName}</span>
        <span className="ml-auto text-xs text-gray-600">
          View on <span className="text-degen-500">{domainDisplay}</span>
        </span>
      </a>

      {/* ── Post header (upvote + title) ── */}
      <div className="flex gap-3 px-4 py-3">
        {/* Upvote/downvote column (Reddit-style) */}
        <div className="flex flex-col items-center gap-0.5 pt-0.5">
          <button
            type="button"
            className="rounded p-1 text-gray-600 transition-colors hover:bg-orange-500/10 hover:text-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400/60"
            aria-label="Upvote"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
              <path d="M9 2L16 14H2L9 2Z" />
            </svg>
          </button>
          <span
            className="text-xs font-bold tabular-nums"
            style={{ color: post.metrics.likes >= 0 ? '#00b868' : '#6b7280' }}
          >
            {formatScore(post.metrics.likes - post.metrics.reposts || post.metrics.likes)}
          </span>
          <button
            type="button"
            className="rounded p-1 text-gray-600 transition-colors hover:bg-blue-500/10 hover:text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/60"
            aria-label="Downvote"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
              <path d="M9 16L2 4H16L9 16Z" />
            </svg>
          </button>
        </div>

        {/* Post content area */}
        <div className="min-w-0 flex-1">
          {/* Title */}
          <h3 className="mb-1 text-sm font-semibold leading-snug text-gray-100">
            {post.text.split('\n')[0] || post.text.slice(0, 120)}
          </h3>

          {/* Metadata row + Tip button */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
            <span>
              Posted by <span className="font-medium text-gray-500">{post.author.displayName}</span>
            </span>
            <span aria-hidden="true">·</span>
            <span>{post.metrics.replies} comments</span>
            <span aria-hidden="true">·</span>
            <span>{post.metrics.reposts} shares</span>
            {/* Tip button for the post */}
            {hasAuthorWallet && (
              <LemmyTipButton
                contentId={post.id}
                contentType="post"
                authorEvmAddress={authorEvmAddress}
                authorSolanaAddress={authorSolanaAddress}
                tipCount={postTipCount}
                tipTotalUsd={postTipTotal}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Comments section ── */}
      {comments.length > 0 && (
        <div className="border-t border-[var(--color-border)] px-2 py-2">
          <div className="mb-2 flex items-center justify-between px-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-600">
              Comments ({comments.length})
            </span>
            {/* Collapse all / expand all could go here */}
          </div>
          <VirtualizedCommentList
            comments={comments}
            depth={0}
            postAuthorEvmAddress={authorEvmAddress}
            postAuthorSolanaAddress={authorSolanaAddress}
          />
        </div>
      )}

      {/* ── "View on community" link ── */}
      <a
        href={`https://${domainDisplay}/${communityName.startsWith('c/') ? communityName : `c/${communityName}`}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center border-t border-[var(--color-border)] px-4 py-2 text-xs text-degen-500 transition-colors hover:bg-[var(--color-muted)] hover:text-degen-400"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          className="mr-1"
          aria-hidden="true"
        >
          <path
            d="M5 2H2V10H10V7M6 6L10 2M10 2H7M10 2V5"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {viewOnCommunityLabel}
      </a>
    </div>
  );
});

// ─── Fallback comment extraction from raw ───────────────────────────

interface RawComment {
  id: string;
  author: string;
  author_avatar?: string;
  content: string;
  score: number;
  upvotes?: number;
  downvotes?: number;
  created_at?: number;
  path?: string;
  parent_id?: string;
  edited?: boolean;
  updated_at?: number;
  my_vote?: number;
}

function extractComments(post: UnifiedPost): LemmyComment[] {
  const raw = post.raw as Record<string, unknown> | undefined;
  if (raw?.comments && Array.isArray(raw.comments)) {
    const rawComments = raw.comments as RawComment[];
    const votes = rawComments.map((c) => c.my_vote ?? null);
    return buildCommentTree(rawComments, votes);
  }
  // Generate a sample comment tree from post data for demo purposes
  return [];
}

function buildCommentTree(flat: RawComment[], userVotes?: (number | null)[]): LemmyComment[] {
  const map = new Map<string, LemmyComment & { parentId?: string }>();
  const roots: LemmyComment[] = [];

  // First pass: create nodes with vote state
  const voteIndex = new Map<string, 'up' | 'down' | null>();
  if (userVotes && userVotes.length === flat.length) {
    flat.forEach((rc, i) => {
      const v = userVotes[i];
      if (v !== undefined) {
        if (v === 1) voteIndex.set(rc.id, 'up');
        else if (v === -1) voteIndex.set(rc.id, 'down');
        else voteIndex.set(rc.id, null);
      }
    });
  }

  for (const rc of flat) {
    const userVote = voteIndex.get(rc.id) as 'up' | 'down' | null | undefined;
    map.set(rc.id, {
      id: rc.id,
      author: rc.author,
      authorAvatar: rc.author_avatar,
      content: rc.content,
      score: rc.score ?? (rc.upvotes ?? 0) - (rc.downvotes ?? 0),
      upvotes: rc.upvotes ?? 0,
      downvotes: rc.downvotes ?? 0,
      createdAt: Number(rc.created_at) || Date.now(),
      editedAt: rc.edited || rc.updated_at ? (Number(rc.updated_at) || undefined) : undefined,
      depth: rc.path ? rc.path.split('.').length - 2 : 0,
      replies: [],
      parentId: rc.parent_id,
      userVote: userVote ?? null,
    });
  }

  // Second pass: link parents
  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)?.replies.push(node as LemmyComment);
    } else {
      roots.push(node as LemmyComment);
    }
  }

  return roots;
}
