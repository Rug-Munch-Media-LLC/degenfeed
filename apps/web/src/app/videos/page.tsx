'use client';

import type { UnifiedPost } from '@degenfeed/types';
import { ErrorBoundary, getProtocolColor } from '@degenfeed/ui';
import { VideoPlayer } from '@degenfeed/ui';
import { formatTimeAgo, parseVideoUrl, type VideoInfo } from '@degenfeed/utils';
import Image from 'next/image';
import Link from 'next/link';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

// ─── Helpers ────────────────────────────────────────────────────────────

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ─── Video Card ──────────────────────────────────────────────────────────

interface VideoCardProps {
  post: UnifiedPost;
  isActive?: boolean;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
}

const VideoCard = memo(function VideoCard({
  post,
  isActive,
  onSwipeUp,
  onSwipeDown,
}: VideoCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isVertical, setIsVertical] = useState(false);

  // Detect video info from embeds
  const videoInfo = useMemo<VideoInfo | null>(() => {
    const videoEmbed = post.embeds.find((e) => e.kind === 'video');
    if (videoEmbed) {
      const info = parseVideoUrl(videoEmbed.url);
      if (info) return info;
    }
    const linkEmbed = post.embeds.find((e) => e.kind === 'link');
    if (linkEmbed) {
      const info = parseVideoUrl(linkEmbed.url);
      if (info) return info;
    }
    return null;
  }, [post.embeds]);

  // Detect YouTube ID from text as fallback
  const textYoutubeId = useMemo(() => {
    if (videoInfo) return null;
    const match =
      post.text.match(/(?:v=|\/|youtu\.be\/)([\w-]{11})/);
    return match?.[1] ?? null;
  }, [post.text, videoInfo]);

  const isYouTube = videoInfo?.platform === 'youtube' || !!textYoutubeId;
  const youtubeId = videoInfo?.platform === 'youtube' ? videoInfo.id : (textYoutubeId ?? undefined);
  const isShort =
    videoInfo?.platform === 'youtube' && /shorts\//.test(videoInfo.url);

  useEffect(() => {
    if (isShort || videoInfo?.platform === 'youtube' && /shorts\//.test(videoInfo.url)) {
      setIsVertical(true);
    }
  }, [videoInfo, isShort]);

  // Thumbnail for YouTube
  const youtubeThumb = youtubeId
    ? `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`
    : null;

  const authorHandle =
    post.author.handles[post.protocol] ?? post.author.id.slice(0, 16);

  // Only use grid/video layout distinction
  const isShortForm = isVertical || isShort;

  return (
    <div
      ref={cardRef}
      className={`rounded-2xl border border-[var(--color-glass-border)] bg-white/[0.02] overflow-hidden transition-all ${
        isActive ? 'ring-2 ring-degen-500/30' : 'hover:border-degen-500/20'
      } ${isShortForm ? 'max-w-sm mx-auto' : ''}`}
    >
      {/* ── Video Player ── */}
      {videoInfo?.platform === 'youtube' || youtubeId ? (
        <VideoPlayer
          youtubeId={youtubeId}
          platform="youtube"
          aspectRatio={isShortForm ? '9:16' : '16:9'}
          title={post.text}
          showMetadata={false}
        />
      ) : videoInfo?.platform === 'direct' ? (
        <VideoPlayer
          src={videoInfo.url}
          platform="direct"
          aspectRatio={isShortForm ? '9:16' : '16:9'}
          title={post.text}
          showMetadata={false}
        />
      ) : videoInfo?.platform === 'peertube' ? (
        /* PeerTube handled by PeerTubeEmbed in the feed, here we show a link */
        <a
          href={videoInfo.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block aspect-video bg-[var(--color-muted)] flex items-center justify-center"
        >
          <div className="text-center">
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              className="mx-auto mb-2 text-gray-600"
              aria-hidden="true"
            >
              <rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.5" />
              <path d="M10 9L16 12L10 15V9Z" fill="currentColor" />
            </svg>
            <p className="text-xs text-gray-500">PeerTube video</p>
          </div>
        </a>
      ) : (
        /* Fallback: maybe an image link that's not a video embed */
        youtubeThumb && (
          <div className="relative aspect-video w-full overflow-hidden bg-[var(--color-muted)]">
            <Image
              src={youtubeThumb}
              alt={post.text}
              width={480}
              height={360}
              className="aspect-video w-full object-cover"
            />
            {/* Play icon overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M8 5V19L19 12L8 5Z" />
                </svg>
              </div>
            </div>
            <a
              href={`https://youtube.com/watch?v=${youtubeId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute inset-0"
              aria-label="Watch on YouTube"
            />
          </div>
        )
      )}

      {/* ── Card Footer ── */}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <span
            className="text-[10px] font-medium text-gray-500 uppercase tracking-wider"
            style={{ color: getProtocolColor(post.protocol) }}
          >
            {post.protocol}
          </span>
          <span className="text-[10px] text-gray-600">{formatTimeAgo(post.createdAt)} ago</span>
        </div>
        <p className="text-sm text-[var(--color-fg)] line-clamp-2 font-medium leading-snug">
          {post.text}
        </p>
        <div className="mt-1 flex items-center gap-2">
          {post.author.avatarUrl && (
            <Image
              src={post.author.avatarUrl}
              alt={post.author.displayName}
              width={16}
              height={16}
              className="h-4 w-4 rounded-full object-cover"
            />
          )}
          <p className="text-xs text-gray-500 truncate">
            {post.author.displayName}
            <span className="ml-1 text-gray-600">@{authorHandle}</span>
          </p>
        </div>
        <div className="mt-2 flex items-center gap-3 text-[11px] text-gray-600">
          <span>{formatCount(post.metrics.likes)} likes</span>
          <span>{formatCount(post.metrics.reposts)} reposts</span>
          {post.metrics.quotes > 0 && <span>{formatCount(post.metrics.quotes)} zaps</span>}
        </div>
      </div>
    </div>
  );
});

// ─── Page ────────────────────────────────────────────────────────────────

export default function VideosPage() {
  const [posts, setPosts] = useState<UnifiedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/feed/home?type=video&sort=new&limit=50', {
        credentials: 'include',
      });
      if (!res.ok) return;
      const data = (await res.json()) as { data?: UnifiedPost[] };
      if (data.data) setPosts(data.data);
    } catch {
      // silently fail
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Keyboard navigation for short-form vertical videos
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        setActiveIndex((prev) => Math.max(0, prev - 1));
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        setActiveIndex((prev) => Math.min(posts.length - 1, prev + 1));
      }
    },
    [posts.length],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleSwipeUp = useCallback(() => {
    setActiveIndex((prev) => Math.min(posts.length - 1, prev + 1));
  }, [posts.length]);

  const handleSwipeDown = useCallback(() => {
    setActiveIndex((prev) => Math.max(0, prev - 1));
  }, []);

  // Scroll active video into view
  useEffect(() => {
    const el = document.getElementById(`video-card-${activeIndex}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeIndex]);

  return (
    <ErrorBoundary>
      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* ── Header ── */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="font-mono text-xs tracking-widest text-degen-400 uppercase">
              Video Feed
            </p>
            <h1 className="text-2xl font-bold text-[var(--color-fg)]">Video</h1>
            <p className="mt-1 text-sm text-gray-500">
              93 YouTube channels, PeerTube, and video content from all protocols
            </p>
          </div>
          <Link
            href="/home/all"
            className="text-sm text-gray-500 hover:text-[var(--color-fg)] transition-colors"
          >
            &larr; Feed
          </Link>
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border border-[var(--color-glass-border)] bg-white/[0.02] overflow-hidden animate-pulse"
              >
                <div className="aspect-video bg-[var(--color-muted)]" />
                <div className="p-4 space-y-2">
                  <div className="h-4 w-3/4 rounded bg-[var(--color-muted)]" />
                  <div className="h-3 w-1/2 rounded bg-[var(--color-muted)]" />
                  <div className="h-3 w-1/3 rounded bg-[var(--color-muted)]" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Empty state ── */}
        {!loading && posts.length === 0 && (
          <div className="card py-16 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white/5">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
                className="text-gray-600"
              >
                <rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.5" />
                <path d="M10 9L16 12L10 15V9Z" fill="currentColor" />
              </svg>
            </div>
            <p className="text-gray-500">No videos found.</p>
            <p className="mt-1 text-sm text-gray-600">
              Video content appears here as it&apos;s discovered from RSS, YouTube, and PeerTube feeds.
            </p>
            <button type="button" onClick={load} className="btn-secondary mt-4 text-sm">
              Refresh
            </button>
          </div>
        )}

        {/* ── Video grid ── */}
        {!loading && posts.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((p, idx) => (
              <div key={p.id} id={`video-card-${idx}`}>
                <VideoCard
                  post={p}
                  isActive={idx === activeIndex}
                  onSwipeUp={handleSwipeUp}
                  onSwipeDown={handleSwipeDown}
                />
              </div>
            ))}
          </div>
        )}

        {/* ── Quick help ── */}
        {posts.length > 0 && (
          <p className="mt-6 text-center text-[11px] text-gray-600">
            Use arrow keys to navigate between videos
          </p>
        )}
      </div>
    </ErrorBoundary>
  );
}
