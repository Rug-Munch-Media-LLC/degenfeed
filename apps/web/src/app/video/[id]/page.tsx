'use client';

/**
 * @degenfeed/web — /video/[id] (Video Detail Page)
 *
 * Full video detail page with:
 * - Embedded video player from source (YouTube/PeerTube/etc.)
 * - Title, description, creator, category, tags
 * - Source badge (color-coded)
 * - Actions: Watch Later, Share, Save, Open Original
 * - Related videos from the same category
 * - Comments placeholder
 */

import { ErrorBoundary } from '@degenfeed/ui';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { UnifiedVideo } from '../../../components/video/useVideoHub';
import { VideoPlayer } from '../../../components/video/VideoPlayer';
import { VideoSourceBadge } from '../../../components/video/VideoSourceBadge';

// === Mock data for demonstration ==========================================

function getMockVideo(id: string): UnifiedVideo {
  const idx = Number(id.split('-').pop()) || 0;
  const categories = [
    'crypto',
    'gaming',
    'music',
    'tech',
    'art',
    'education',
    'entertainment',
    'sports',
    'news',
    'science',
    'comedy',
    'irl',
    'talk',
    'trading',
  ];
  const sources: Array<UnifiedVideo['source']> = ['youtube', 'peertube', 'shorts', 'livestream'];
  const sourceLabels: Record<string, string> = {
    youtube: 'YouTube',
    peertube: 'PeerTube',
    shorts: 'Shorts',
    livestream: 'Live',
  };
  const sourceColors: Record<string, string> = {
    youtube: '#FF0000',
    peertube: '#F1680D',
    shorts: '#FF0050',
    livestream: '#9146FF',
  };

  const cat = categories[idx % categories.length]!;
  const source = sources[idx % sources.length]!;
  const publishedAt = Date.now() - idx * 3600000 * 2;
  const views = Math.round(Math.random() * 50000 + 100);
  const duration = Math.round(Math.random() * 600 + 30);

  return {
    id,
    title: `Deep Dive into ${cat.charAt(0).toUpperCase() + cat.slice(1)} — Video #${idx + 1}`,
    description: [
      `A comprehensive look at ${cat} topics and developments in the ecosystem.`,
      '',
      'In this video, we explore the latest trends, breaking news, and expert analysis.',
      'Topics covered include key developments, market impact, and what to watch next.',
      '',
      '📌 Chapters:',
      '0:00 — Introduction',
      `${formatDuration(Math.round(duration * 0.15))} — Main discussion`,
      `${formatDuration(Math.round(duration * 0.6))} — Key insights`,
      `${formatDuration(Math.round(duration * 0.85))} — Wrap-up`,
      '',
      '🔔 Subscribe for more content like this.',
      '💬 Join the discussion in the comments.',
    ].join('\n'),
    thumbnailUrl: `https://picsum.photos/seed/vid${idx}/1280/720`,
    videoUrl: `https://example.com/watch/${source}/${idx}`,
    embedUrl: `https://example.com/embed/${source}/${idx}`,
    duration,
    durationLabel: formatDuration(duration),
    source,
    sourceLabel: sourceLabels[source] ?? source,
    sourceColor: sourceColors[source] ?? '#888',
    channelName: `Channel ${String.fromCharCode(65 + (idx % 26))}`,
    channelId: `ch-${source}-${idx}`,
    channelUrl: `https://example.com/channel/${source}/${idx}`,
    channelAvatar: `https://picsum.photos/seed/avatar${idx}/100/100`,
    publishedAt,
    publishedLabel: timeAgo(publishedAt),
    views,
    category: cat,
    tags: [cat, source, 'degenfeed', 'web3', 'crypto'],
    isLive: source === 'livestream',
  };
}

function getRelatedVideos(video: UnifiedVideo, count = 8): UnifiedVideo[] {
  const related: UnifiedVideo[] = [];
  for (let i = 0; i < count; i++) {
    const relatedIdx = Number(video.id.split('-').pop()) + i + 1;
    related.push(getMockVideo(`${video.source}-${relatedIdx}`));
  }
  return related;
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  if (m > 0) return `${m}:${String(s).padStart(2, '0')}`;
  return `0:${String(s).padStart(2, '0')}`;
}

function timeAgo(ms: number): string {
  const seconds = Math.floor((Date.now() - ms) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatViews(views: number): string {
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(1)}K`;
  return String(views);
}

// === Page Component ======================================================

export default function VideoDetailPage() {
  const params = useParams<{ id: string }>();
  const _router = useRouter();
  const [saved, setSaved] = useState(false);
  const [_showShare, setShowShare] = useState(false);

  const videoId = params?.id ?? '';

  const video = useMemo(() => getMockVideo(videoId), [videoId]);
  const relatedVideos = useMemo(() => (video ? getRelatedVideos(video) : []), [video]);

  // Check if video is saved
  useEffect(() => {
    try {
      const savedIds = JSON.parse(localStorage.getItem('df:saved-videos') ?? '[]') as string[];
      setSaved(savedIds.includes(videoId));
    } catch {
      // ignore
    }
  }, [videoId]);

  const _handlePlay = useCallback((v: UnifiedVideo) => {
    window.open(v.videoUrl, '_blank', 'noopener noreferrer');
  }, []);

  const handleWatchLater = useCallback(() => {
    if (!video) return;
    try {
      const existing = JSON.parse(localStorage.getItem('df:watch-later') ?? '[]') as {
        id: string;
        title: string;
        addedAt: number;
      }[];
      if (!existing.some((i) => i.id === video.id)) {
        existing.push({ id: video.id, title: video.title, addedAt: Date.now() });
        localStorage.setItem('df:watch-later', JSON.stringify(existing));
        window.dispatchEvent(
          new CustomEvent('df-toast', {
            detail: { kind: 'info', message: 'Saved to Watch Later' },
          }),
        );
      }
    } catch {
      // ignore
    }
  }, [video]);

  const handleToggleSave = useCallback(() => {
    try {
      const savedIds = JSON.parse(localStorage.getItem('df:saved-videos') ?? '[]') as string[];
      if (saved) {
        const filtered = savedIds.filter((id) => id !== videoId);
        localStorage.setItem('df:saved-videos', JSON.stringify(filtered));
        setSaved(false);
        window.dispatchEvent(
          new CustomEvent('df-toast', {
            detail: { kind: 'info', message: 'Removed from saved' },
          }),
        );
      } else {
        savedIds.push(videoId);
        localStorage.setItem('df:saved-videos', JSON.stringify(savedIds));
        setSaved(true);
        window.dispatchEvent(
          new CustomEvent('df-toast', {
            detail: { kind: 'success', message: 'Video saved!' },
          }),
        );
      }
    } catch {
      // ignore
    }
  }, [videoId, saved]);

  const handleShare = useCallback(() => {
    const url = window.location.href;
    if (navigator.share) {
      navigator
        .share({
          title: video?.title ?? 'Video',
          url,
        })
        .catch(() => {});
    } else {
      navigator.clipboard.writeText(url).catch(() => {});
      setShowShare(true);
      setTimeout(() => setShowShare(false), 2000);
      window.dispatchEvent(
        new CustomEvent('df-toast', {
          detail: { kind: 'info', message: 'Link copied!' },
        }),
      );
    }
  }, [video]);

  if (!video) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-red-400"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h1 className="mb-2 text-lg font-semibold text-[var(--color-fg)]">Video not found</h1>
        <p className="mb-4 text-sm text-[var(--color-muted)]">
          The video you&apos;re looking for doesn&apos;t exist or has been removed.
        </p>
        <Link
          href="/video"
          className="inline-flex items-center gap-2 rounded-xl bg-degen-500 px-4 py-2 text-sm font-semibold text-black hover:bg-degen-400 transition-colors"
        >
          &larr; Back to Video Hub
        </Link>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <nav className="mb-4 flex items-center gap-2 text-xs text-[var(--color-muted)]">
          <Link href="/feed" className="hover:text-[var(--color-fg)] transition-colors">
            Feed
          </Link>
          <span>/</span>
          <Link href="/video" className="hover:text-[var(--color-fg)] transition-colors">
            Video Hub
          </Link>
          <span>/</span>
          <span className="max-w-[200px] truncate text-[var(--color-fg)]">{video.title}</span>
        </nav>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Video Player */}
            <VideoPlayer
              title={video.title}
              embedUrl={video.embedUrl}
              videoUrl={video.videoUrl}
              source={video.source as 'youtube' | 'peertube' | 'shorts' | 'livestream'}
              poster={video.thumbnailUrl}
              className="w-full"
            />

            {/* Title & Meta */}
            <div>
              <h1 className="text-xl font-bold text-[var(--color-fg)] sm:text-2xl">
                {video.title}
              </h1>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <VideoSourceBadge source={video.source} size="md" />

                {/* Category link */}
                <Link
                  href={`/video?category=${video.category}`}
                  className="rounded-full border border-[var(--color-glass-border)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
                >
                  {video.category}
                </Link>

                <span className="text-xs text-[var(--color-muted)]">
                  {formatViews(video.views)} views
                </span>
                <span className="text-xs text-[var(--color-muted)]">·</span>
                <span className="text-xs text-[var(--color-muted)]">{video.publishedLabel}</span>
              </div>
            </div>

            {/* Channel & Actions */}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
              {/* Channel info */}
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 overflow-hidden rounded-full bg-[var(--color-overlay)]">
                  {video.channelAvatar ? (
                    <img
                      src={video.channelAvatar}
                      alt={video.channelName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm font-bold text-[var(--color-muted)]">
                      {video.channelName.charAt(0)}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--color-fg)]">
                    {video.channelName}
                  </p>
                  <p className="text-[11px] text-[var(--color-muted)]">
                    {video.sourceLabel} channel
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleWatchLater}
                  className="flex items-center gap-1.5 rounded-lg border border-[var(--color-glass-border)] px-3 py-2 text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:border-degen-500/30 transition-colors"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <path d="M12 6v6l4 2" />
                    <circle cx="12" cy="12" r="10" />
                  </svg>
                  Watch Later
                </button>

                <button
                  type="button"
                  onClick={handleToggleSave}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                    saved
                      ? 'border-degen-500/30 bg-degen-500/10 text-degen-400'
                      : 'border-[var(--color-glass-border)] text-[var(--color-muted)] hover:text-[var(--color-fg)]'
                  }`}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill={saved ? 'currentColor' : 'none'}
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
                  </svg>
                  {saved ? 'Saved' : 'Save'}
                </button>

                <button
                  type="button"
                  onClick={handleShare}
                  className="flex items-center gap-1.5 rounded-lg border border-[var(--color-glass-border)] px-3 py-2 text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <circle cx="18" cy="5" r="3" />
                    <circle cx="6" cy="12" r="3" />
                    <circle cx="18" cy="19" r="3" />
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                  </svg>
                  Share
                </button>

                <a
                  href={video.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-lg border border-[var(--color-glass-border)] px-3 py-2 text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                  Open
                </a>
              </div>
            </div>

            {/* Tags */}
            {video.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {video.tags.map((tag) => (
                  <Link
                    key={tag}
                    href={`/video?search=${encodeURIComponent(tag)}`}
                    className="rounded-full border border-[var(--color-glass-border)] bg-[var(--color-card)] px-2.5 py-1 text-[11px] text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:border-degen-500/30 transition-colors"
                  >
                    #{tag}
                  </Link>
                ))}
              </div>
            )}

            {/* Description */}
            <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
              <h2 className="mb-2 text-sm font-semibold text-[var(--color-fg)]">Description</h2>
              <pre className="whitespace-pre-wrap text-sm text-[var(--color-muted)] leading-relaxed font-sans">
                {video.description}
              </pre>
            </div>

            {/* Comments Section */}
            <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[var(--color-fg)]">Comments</h2>
                <span className="text-xs text-[var(--color-muted)]">
                  Source comments + DegenFeed
                </span>
              </div>

              {/* Comment composer */}
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-overlay)] text-xs text-[var(--color-muted)]">
                  👤
                </div>
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Add a comment..."
                    className="w-full border-b border-[var(--color-glass-border)] bg-transparent py-2 text-sm text-[var(--color-fg)] placeholder-[var(--color-muted)] outline-none transition-colors focus:border-degen-500/40"
                  />
                </div>
                <button
                  type="button"
                  className="rounded-lg bg-degen-500 px-4 py-1.5 text-xs font-semibold text-black opacity-50 cursor-not-allowed"
                  disabled
                >
                  Post
                </button>
              </div>

              {/* Placeholder comments */}
              <div className="space-y-4">
                {[
                  {
                    author: 'CryptoMaxi',
                    text: 'Great breakdown! Really helpful for understanding the space.',
                    time: '2h ago',
                  },
                  {
                    author: 'Web3Dev',
                    text: 'Would love to see a follow-up on the technical details.',
                    time: '5h ago',
                  },
                  { author: 'DegenTrader', text: 'This aged well 🚀', time: '1d ago' },
                ].map((comment, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-degen-500/10 text-xs font-bold text-degen-400">
                      {comment.author.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-[var(--color-fg)]">
                          {comment.author}
                        </span>
                        <span className="text-[10px] text-[var(--color-muted)]">
                          {comment.time}
                        </span>
                      </div>
                      <p className="text-sm text-[var(--color-muted)]">{comment.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar: Related Videos */}
          <div className="lg:col-span-1">
            <div className="sticky top-20 space-y-4">
              <h2 className="text-sm font-semibold text-[var(--color-fg)]">Related Videos</h2>

              <div className="flex flex-col gap-3">
                {relatedVideos.slice(0, 8).map((rv) => (
                  <Link
                    key={rv.id}
                    href={`/video/${rv.id}`}
                    className="group flex gap-3 rounded-xl p-2 transition-colors hover:bg-[var(--color-card)]"
                  >
                    {/* Thumbnail */}
                    <div className="relative w-40 shrink-0 overflow-hidden rounded-lg bg-[var(--color-card)]">
                      <img
                        src={rv.thumbnailUrl}
                        alt={rv.title}
                        className="aspect-video w-full object-cover"
                        loading="lazy"
                      />
                      {rv.durationLabel && (
                        <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 py-0.5 text-[9px] font-medium text-white">
                          {rv.durationLabel}
                        </span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <h3 className="text-xs font-semibold text-[var(--color-fg)] leading-tight line-clamp-2 group-hover:text-degen-400 transition-colors">
                        {rv.title}
                      </h3>
                      <p className="mt-1 text-[10px] text-[var(--color-muted)]">{rv.channelName}</p>
                      <p className="text-[10px] text-[var(--color-muted)]">
                        {formatViews(rv.views)} views · {rv.publishedLabel}
                      </p>
                      <div className="mt-1">
                        <VideoSourceBadge source={rv.source} size="sm" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              {/* More link */}
              <Link
                href={`/video?category=${video.category}`}
                className="block text-center text-xs text-degen-500 hover:text-degen-400 transition-colors"
              >
                More in {video.category} &rarr;
              </Link>
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
