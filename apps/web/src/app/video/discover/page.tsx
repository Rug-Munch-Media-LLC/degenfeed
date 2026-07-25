'use client';

/**
 * @degenfeed/web — /video/discover (Video Discovery Page)
 *
 * YouTube-style video discovery page with horizontal scrollable rows:
 * 1. "Continue Watching" — videos in progress with progress bars
 * 2. "Recommended for You" — personalized picks
 * 3. "Trending Now" — what's hot right now
 * 4. "Hidden Gems" — underrated quality content
 * 5. "From Your Creators" — videos from creators you follow
 * 6. "Because you watched..." — related to recent watches
 *
 * Each video card shows:
 * - Large thumbnail with duration badge
 * - Creator avatar + name
 * - Title (2 lines max)
 * - Views + time ago
 * - Platform badge (PeerTube, YouTube, etc.)
 * - "Watch Later" bookmark button
 */

import { ErrorBoundary } from '@degenfeed/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { UnifiedVideo } from '../../../components/video/useVideoHub';
import { VideoRow } from '../../../components/video/VideoRow';
import { VideoSourceBadge } from '../../../components/video/VideoSourceBadge';

// ─── API Response Types ────────────────────────────────────────────────

interface DiscoveryRowAPI {
  id: string;
  label: string;
  subtitle?: string;
  strategy: string;
  videos: UnifiedVideoAPI[];
  seeAllLink?: string;
}

interface UnifiedVideoAPI {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  videoUrl: string;
  embedUrl?: string;
  duration: number;
  durationLabel: string;
  source: string;
  sourceLabel: string;
  sourceColor: string;
  channelName: string;
  channelUrl?: string;
  channelAvatar?: string;
  publishedAt: number;
  publishedLabel: string;
  views: number;
  category: string;
  tags: string[];
  isLive: boolean;
  watchProgress?: number;
  watchPosition?: number;
}

interface DiscoveryPageAPI {
  rows: DiscoveryRowAPI[];
  interestCategories: string[];
  userWallet?: string;
}

// ─── API Adapter ───────────────────────────────────────────────────────

function mapAPIToUnifiedVideo(api: UnifiedVideoAPI): UnifiedVideo {
  return {
    id: api.id,
    title: api.title,
    description: api.description,
    thumbnailUrl: api.thumbnailUrl,
    videoUrl: api.videoUrl,
    embedUrl: api.embedUrl,
    duration: api.duration,
    durationLabel: api.durationLabel,
    source: api.source as UnifiedVideo['source'],
    sourceLabel: api.sourceLabel,
    sourceColor: api.sourceColor,
    channelName: api.channelName,
    channelId: api.id,
    channelUrl: api.channelUrl,
    channelAvatar: api.channelAvatar,
    publishedAt: api.publishedAt,
    publishedLabel: api.publishedLabel,
    views: api.views,
    category: api.category,
    tags: api.tags,
    isLive: api.isLive,
  };
}

// ─── Page Component ───────────────────────────────────────────────────

export default function VideoDiscoveryPage() {
  const [rows, setRows] = useState<DiscoveryRowAPI[]>([]);
  const [interestCategories, setInterestCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchDiscovery() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch('/api/video/recommendations?limit=20');
        if (!res.ok) {
          throw new Error(`API error: ${res.status}`);
        }

        const data = (await res.json()) as DiscoveryPageAPI;

        if (!cancelled) {
          setRows(data.rows ?? []);
          setInterestCategories(data.interestCategories ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load recommendations');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchDiscovery();

    return () => {
      cancelled = true;
    };
  }, []);

  const handlePlay = useCallback((video: UnifiedVideo) => {
    if (video.videoUrl) {
      window.open(video.videoUrl, '_blank', 'noopener noreferrer');
    } else if (video.embedUrl) {
      window.open(video.embedUrl, '_blank', 'noopener noreferrer');
    }
  }, []);

  const handleSave = useCallback((video: UnifiedVideo) => {
    try {
      const saved = JSON.parse(localStorage.getItem('df:saved-videos') ?? '[]') as string[];
      if (!saved.includes(video.id)) {
        saved.push(video.id);
        localStorage.setItem('df:saved-videos', JSON.stringify(saved));
        window.dispatchEvent(
          new CustomEvent('df-toast', {
            detail: { kind: 'success', message: 'Video saved!' },
          }),
        );
      }
    } catch {
      // Storage unavailable
    }
  }, []);

  // ── Loading skeleton ──────────────────────────────────────────────

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6">
          <div className="mb-6 h-8 w-48 animate-pulse rounded-lg bg-[var(--color-card)]" />
          <div className="flex gap-4 overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="w-64 shrink-0">
                <div className="mb-2 aspect-video animate-pulse rounded-xl bg-[var(--color-card)]" />
                <div className="mb-1 h-4 w-3/4 animate-pulse rounded bg-[var(--color-card)]" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-[var(--color-card)]" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────────────

  if (error) {
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
        <h1 className="mb-2 text-lg font-semibold text-[var(--color-fg)]">
          Couldn&apos;t load recommendations
        </h1>
        <p className="mb-4 text-sm text-[var(--color-muted)]">{error}. Try refreshing the page.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 rounded-xl bg-degen-500 px-4 py-2 text-sm font-semibold text-black hover:bg-degen-400 transition-colors"
        >
          Refresh
        </button>
      </div>
    );
  }

  // ── Determine row size based on strategy ──────────────────────────

  function getRowSize(strategy: string): 'sm' | 'md' | 'lg' {
    switch (strategy) {
      case 'continue-watching':
        return 'lg';
      case 'because-you-watched':
      case 'trending-interests':
        return 'md';
      case 'hidden-gems':
        return 'md';
      default:
        return 'md';
    }
  }

  // ── Main content ─────────────────────────────────────────────────

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
          <span className="text-[var(--color-fg)]">Discover</span>
        </nav>

        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-fg)]">Discover</h1>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Personalized video recommendations across all platforms
            </p>
          </div>

          {/* Interest category pills */}
          {interestCategories.length > 0 && (
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-[10px] font-medium text-[var(--color-muted)] uppercase">
                Interests:
              </span>
              <div className="flex gap-1.5">
                {interestCategories.map((cat) => (
                  <Link
                    key={cat}
                    href={`/video?category=${cat}`}
                    className="rounded-full border border-[var(--color-glass-border)] bg-[var(--color-card)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:border-degen-500/30 transition-colors"
                  >
                    {cat}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Discovery Rows */}
        <div className="space-y-8">
          {rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-[var(--color-glass-border)] bg-[var(--color-card)]">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-[var(--color-muted)]"
                  aria-hidden="true"
                >
                  <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
                  <line x1="7" y1="2" x2="7" y2="22" />
                  <line x1="17" y1="2" x2="17" y2="22" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <line x1="2" y1="7" x2="7" y2="7" />
                  <line x1="2" y1="17" x2="7" y2="17" />
                  <line x1="17" y1="7" x2="22" y2="7" />
                  <line x1="17" y1="17" x2="22" y2="17" />
                </svg>
              </div>
              <h2 className="mb-1 text-base font-semibold text-[var(--color-fg)]">
                No recommendations yet
              </h2>
              <p className="text-sm text-[var(--color-muted)]">
                Watch some videos to get personalized recommendations.
              </p>
              <Link
                href="/video"
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-degen-500 px-4 py-2 text-sm font-semibold text-black hover:bg-degen-400 transition-colors"
              >
                Browse Videos
              </Link>
            </div>
          ) : (
            rows.map((row) => {
              const videos = row.videos.map(mapAPIToUnifiedVideo);

              // If this is a "continue watching" row, add progress bars
              if (row.strategy === 'continue-watching') {
                return (
                  <div key={row.id}>
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <h2 className="text-base font-bold text-[var(--color-fg)] sm:text-lg">
                          {row.label}
                        </h2>
                        {row.subtitle && (
                          <p className="text-xs text-[var(--color-muted)]">{row.subtitle}</p>
                        )}
                      </div>
                      {row.seeAllLink && (
                        <Link
                          href={row.seeAllLink}
                          className="text-xs font-medium text-degen-500 hover:text-degen-400 transition-colors"
                        >
                          See all &rarr;
                        </Link>
                      )}
                    </div>

                    {/* Continue watching with progress bars */}
                    <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin">
                      {videos.map((video) => {
                        const apiVideo = row.videos.find((v) => v.id === video.id);
                        const progress = apiVideo?.watchProgress ?? 0;
                        const position = apiVideo?.watchPosition ?? 0;

                        return (
                          <Link
                            key={video.id}
                            href={`/video/${video.id}`}
                            className="w-72 shrink-0 group"
                          >
                            {/* Thumbnail with progress bar */}
                            <div className="relative mb-2 aspect-video overflow-hidden rounded-xl bg-[var(--color-card)]">
                              <img
                                src={video.thumbnailUrl}
                                alt={video.title}
                                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                loading="lazy"
                              />
                              {video.durationLabel && (
                                <span className="absolute bottom-1.5 right-1.5 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-medium text-white tabular-nums">
                                  {video.durationLabel}
                                </span>
                              )}
                              <div className="absolute left-1.5 top-1.5">
                                <VideoSourceBadge source={video.source} size="sm" />
                              </div>

                              {/* Progress bar */}
                              {progress > 0 && progress < 95 && (
                                <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
                                  <div
                                    className="h-full bg-degen-500 transition-all duration-300"
                                    style={{ width: `${Math.min(100, progress)}%` }}
                                  />
                                </div>
                              )}
                            </div>

                            {/* Info */}
                            <div className="flex gap-2">
                              {video.channelAvatar && (
                                <img
                                  src={video.channelAvatar}
                                  alt={video.channelName}
                                  className="mt-0.5 h-7 w-7 shrink-0 rounded-full bg-[var(--color-card)]"
                                  loading="lazy"
                                />
                              )}
                              <div className="min-w-0 flex-1">
                                <h3 className="text-sm font-semibold text-[var(--color-fg)] leading-tight line-clamp-2 group-hover:text-degen-400 transition-colors">
                                  {video.title}
                                </h3>
                                <p className="mt-0.5 text-xs text-[var(--color-muted)] truncate">
                                  {video.channelName}
                                </p>
                                <p className="text-[10px] text-[var(--color-muted)]">
                                  {progress > 0 && `${Math.round(progress)}% · `}
                                  {video.publishedLabel}
                                </p>
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              // Default: use VideoRow for standard rows
              return (
                <VideoRow
                  key={row.id}
                  title={row.label}
                  subtitle={row.subtitle}
                  videos={videos}
                  href={row.seeAllLink}
                  size={getRowSize(row.strategy)}
                  onPlay={handlePlay}
                  onSave={handleSave}
                  showChannel
                />
              );
            })
          )}
        </div>

        {/* Bottom nav */}
        <div className="mt-12 flex items-center justify-center gap-4 border-t border-[var(--color-glass-border)] pt-8">
          <Link
            href="/video"
            className="text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
          >
            Browse All Videos
          </Link>
          <span className="text-[var(--color-glass-border)]">·</span>
          <Link
            href="/video/history"
            className="text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
          >
            Watch History
          </Link>
          <span className="text-[var(--color-glass-border)]">·</span>
          <Link
            href="/video/categories"
            className="text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
          >
            Categories
          </Link>
        </div>
      </div>
    </ErrorBoundary>
  );
}
