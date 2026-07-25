'use client';

/**
 * @degenfeed/web — /video/all (Unified Video Feed)
 *
 * A unified video feed page showing content from ALL video platforms.
 *
 * Features:
 * - Tabs per platform: All, YouTube, PeerTube, Odysee, Twitch, DTube, Rumble, Vimeo, Kick, LiveTube, Nostr, Farcaster, IPFS, Arweave
 * - Category filter across all platforms
 * - Trending section
 * - Subscribe to creators
 * - Watch later playlist
 *
 * Every video is labeled with its source platform (color-coded).
 */

import { ErrorBoundary } from '@degenfeed/ui';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { VideoCard } from '../../../components/video/VideoCard';
import { VideoSourceBadge } from '../../../components/video/VideoSourceBadge';
import type { UnifiedVideo, UnifiedVideoFeed } from '../../../components/video/useVideoHub';

// ─── Platform tabs configuration ───────────────────────────────────────

interface PlatformTab {
  id: string;
  label: string;
  color: string;
  icon?: string;
}

const VIDEO_PLATFORMS: PlatformTab[] = [
  { id: 'all', label: 'All', color: '#FFFFFF' },
  { id: 'youtube', label: 'YouTube', color: '#FF0000' },
  { id: 'peertube', label: 'PeerTube', color: '#F1680D' },
  { id: 'odysee', label: 'Odysee', color: '#FF6A00' },
  { id: 'twitch', label: 'Twitch', color: '#9146FF' },
  { id: 'dtube', label: 'DTube', color: '#FF0000' },
  { id: 'rumble', label: 'Rumble', color: '#85C742' },
  { id: 'vimeo', label: 'Vimeo', color: '#1AB7EA' },
  { id: 'dailymotion', label: 'Dailymotion', color: '#0066FF' },
  { id: 'bitchute', label: 'BitChute', color: '#8B0000' },
  { id: 'kick', label: 'Kick', color: '#53FC18' },
  { id: 'livetube', label: 'LiveTube', color: '#FF4500' },
  { id: 'nostr', label: 'Nostr', color: '#8B5CF6' },
  { id: 'farcaster', label: 'Farcaster', color: '#8A63D2' },
  { id: 'ipfs', label: 'IPFS', color: '#4FC3F7' },
  { id: 'arweave', label: 'Arweave', color: '#9C27B0' },
];

const CATEGORY_OPTIONS = [
  'All',
  'Crypto',
  'Tech',
  'AI',
  'Gaming',
  'Music',
  'Education',
  'Science',
  'News',
  'Entertainment',
  'Sports',
  'Live',
  'Podcast',
];

// ─── API response types ──────────────────────────────────────────────

interface UnifiedFeedItem {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  videoUrl: string;
  duration: number;
  durationLabel: string;
  source: string;
  sourceLabel: string;
  sourceColor: string;
  channelName: string;
  channelId: string;
  channelAvatar?: string;
  channelUrl?: string;
  publishedAt: number;
  publishedLabel: string;
  views: number;
  likes: number;
  category: string;
  tags: string[];
  isLive: boolean;
  isZeroCost: boolean;
}

interface UnifiedFeedAPI {
  items: UnifiedFeedItem[];
  total: number;
  hasMore: boolean;
  cursor?: string;
  sourceCounts: Array<{ source: string; count: number }>;
  categoryCounts: Array<{ category: string; count: number }>;
}

interface TrendingItemAPI {
  id: string;
  title: string;
  thumbnailUrl: string;
  source: string;
  sourceLabel: string;
  sourceColor: string;
  channelName: string;
  views: number;
  publishedLabel: string;
  score: number;
}

// ─── Helpers ────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ─── Component ──────────────────────────────────────────────────────

export default function UnifiedVideoFeedPage() {
  // ── State ────────────────────────────────────────────────────────
  const [activePlatform, setActivePlatform] = useState('all');
  const [activeCategory, setActiveCategory] = useState('All');
  const [items, setItems] = useState<UnifiedFeedItem[]>([]);
  const [trending, setTrending] = useState<TrendingItemAPI[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(true);
  const [sourceCounts, setSourceCounts] = useState<Array<{ source: string; count: number }>>([]);
  const [watchLater, setWatchLater] = useState<Set<string>>(new Set());

  // ── Fetch feed ──────────────────────────────────────────────────
  const fetchFeed = useCallback(async (append = false) => {
    try {
      if (append) setLoadingMore(true);
      else setLoading(true);

      const params = new URLSearchParams();
      if (activePlatform !== 'all') params.set('source', activePlatform);
      if (activeCategory !== 'All') params.set('category', activeCategory.toLowerCase());
      params.set('limit', '30');
      if (append && cursor) params.set('cursor', cursor);

      const res = await fetch(`/api/video/unified-feed?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = (await res.json()) as UnifiedFeedAPI;

      if (append) {
        setItems((prev) => {
          const seen = new Set(prev.map((i) => i.id));
          const newItems = data.items.filter((i) => !seen.has(i.id));
          return [...prev, ...newItems];
        });
      } else {
        setItems(data.items);
      }

      setHasMore(data.hasMore);
      setCursor(data.cursor);
      setSourceCounts(data.sourceCounts ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load feed');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [activePlatform, activeCategory, cursor]);

  // ── Fetch trending ──────────────────────────────────────────────
  const fetchTrending = useCallback(async () => {
    try {
      const res = await fetch('/api/video/unified-feed/trending?limit=12');
      if (res.ok) {
        const data = (await res.json()) as { items: TrendingItemAPI[] };
        setTrending(data.items ?? []);
      }
    } catch {
      // trending is best-effort
    }
  }, []);

  // ── Effects ─────────────────────────────────────────────────────
  useEffect(() => {
    setCursor(undefined);
    setItems([]);
  }, [activePlatform, activeCategory]);

  useEffect(() => {
    if (!cursor) fetchFeed(false);
  }, [cursor, fetchFeed]);

  useEffect(() => {
    fetchTrending();
  }, [fetchTrending]);

  // ── Handlers ────────────────────────────────────────────────────
  const handleLoadMore = useCallback(() => fetchFeed(true), [fetchFeed]);

  const handleToggleWatchLater = useCallback((id: string) => {
    setWatchLater((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      // Persist to localStorage
      try {
        localStorage.setItem('degen-watch-later', JSON.stringify([...next]));
      } catch { /* noop */ }
      return next;
    });
  }, []);

  // Load watch later from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('degen-watch-later');
      if (stored) setWatchLater(new Set(JSON.parse(stored)));
    } catch { /* noop */ }
  }, []);

  // ── Derived ─────────────────────────────────────────────────────

  const currentPlatform = useMemo(
    () => VIDEO_PLATFORMS.find((p) => p.id === activePlatform) ?? VIDEO_PLATFORMS[0]!,
    [activePlatform],
  );

  // ── Render ──────────────────────────────────────────────────────
  return (
    <ErrorBoundary fallback={<div className="p-8 text-center text-red-400">Something went wrong loading the unified video feed.</div>}>
      <div className="min-h-screen bg-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-6">
          {/* ── Header ─────────────────────────────────────────────── */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold tracking-tight">
              Unified Video Feed
            </h1>
            <p className="mt-1 text-sm text-gray-400">
              Every video platform, one feed. Each video labeled with its source.
            </p>
          </div>

          {/* ── Zero-cost banner ──────────────────────────────────── */}
          <div className="mb-6 rounded-lg border border-green-500/20 bg-green-500/5 px-4 py-2 text-sm text-green-400">
            <span className="font-semibold">Zero-Cost Hosting:</span> All external video content is served directly from
            source platforms — no hosting costs for DegenFeed.
            {currentPlatform.id !== 'all' && (
              <span> Currently viewing <strong>{currentPlatform.label}</strong>.</span>
            )}
          </div>

          {/* ── Platform Tabs ─────────────────────────────────────── */}
          <div className="mb-4 overflow-x-auto">
            <div className="flex gap-1 min-w-max pb-2">
              {VIDEO_PLATFORMS.map((platform) => (
                <button
                  key={platform.id}
                  onClick={() => setActivePlatform(platform.id)}
                  className={`relative flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all whitespace-nowrap ${
                    activePlatform === platform.id
                      ? 'bg-white/10 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {activePlatform === platform.id && (
                    <span
                      className="absolute inset-0 rounded-full opacity-20"
                      style={{ backgroundColor: platform.color }}
                    />
                  )}
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: platform.color }}
                  />
                  {platform.label}
                  {sourceCounts.find((s) => s.source === platform.id) && (
                    <span className="ml-1 rounded bg-white/10 px-1.5 text-[10px] tabular-nums">
                      {sourceCounts.find((s) => s.source === platform.id)!.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* ── Category filter ──────────────────────────────────── */}
          <div className="mb-6 flex flex-wrap gap-1.5">
            {CATEGORY_OPTIONS.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  activeCategory === cat
                    ? 'bg-white text-black'
                    : 'bg-white/10 text-gray-300 hover:bg-white/20'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* ── Trending section ─────────────────────────────────── */}
          {trending.length > 0 && activePlatform === 'all' && (
            <section className="mb-8">
              <h2 className="mb-3 text-lg font-semibold">🔥 Trending Across All Platforms</h2>
              <div className="flex gap-4 overflow-x-auto pb-2">
                {trending.map((item) => (
                  <Link
                    key={item.id}
                    href={`/video/${item.id}`}
                    className="group flex-shrink-0 w-48"
                  >
                    <div className="relative aspect-video overflow-hidden rounded-lg bg-gray-800">
                      {item.thumbnailUrl && (
                        <img
                          src={item.thumbnailUrl}
                          alt={item.title}
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                          loading="lazy"
                        />
                      )}
                      <div className="absolute bottom-1.5 left-1.5">
                        <VideoSourceBadge
                          source={item.source as any}
                          size="sm"
                        />
                      </div>
                    </div>
                    <h3 className="mt-1.5 text-sm font-medium line-clamp-2">{item.title}</h3>
                    <p className="text-xs text-gray-400">{item.channelName}</p>
                    <div className="flex items-center gap-2 text-[11px] text-gray-500">
                      <span>{formatCount(item.views)} views</span>
                      <span>{item.publishedLabel}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* ── Feed Grid ────────────────────────────────────────── */}
          {loading && items.length === 0 && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {Array.from({ length: 20 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-video rounded-lg bg-gray-800" />
                  <div className="mt-2 h-4 w-3/4 rounded bg-gray-800" />
                  <div className="mt-1 h-3 w-1/2 rounded bg-gray-800" />
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-center text-red-400">
              {error}
              <button
                onClick={() => { setError(null); fetchFeed(false); }}
                className="ml-2 underline hover:text-red-300"
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && items.length === 0 && (
            <div className="py-16 text-center text-gray-500">
              <p className="text-lg">No videos found</p>
              <p className="mt-1 text-sm">Try selecting a different platform or category.</p>
            </div>
          )}

          {items.length > 0 && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="group relative"
                >
                  {/* Video Card */}
                  <Link href={`/video/${item.id}`} className="block">
                    {/* Thumbnail */}
                    <div className="relative aspect-video overflow-hidden rounded-lg bg-gray-800">
                      {item.thumbnailUrl && (
                        <img
                          src={item.thumbnailUrl}
                          alt={item.title}
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                          loading="lazy"
                        />
                      )}
                      {/* Duration badge */}
                      {item.durationLabel && (
                        <span className="absolute bottom-1.5 right-1.5 rounded bg-black/80 px-1.5 py-0.5 text-[11px] font-medium">
                          {item.durationLabel}
                        </span>
                      )}
                      {/* Source badge */}
                      <div className="absolute bottom-1.5 left-1.5">
                        <VideoSourceBadge
                          source={item.source as any}
                          size="sm"
                        />
                      </div>
                      {/* Live indicator */}
                      {item.isLive && (
                        <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold uppercase">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                          Live
                        </span>
                      )}
                      {/* Zero-cost indicator */}
                      {item.isZeroCost && (
                        <span className="absolute right-1.5 top-1.5 rounded bg-green-600/80 px-1.5 py-0.5 text-[9px] font-medium text-green-100">
                          $0 Hosting
                        </span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="mt-1.5 px-0.5">
                      <h3 className="text-sm font-medium leading-tight line-clamp-2 group-hover:text-blue-400 transition-colors">
                        {item.title}
                      </h3>
                      <p className="mt-0.5 text-xs text-gray-400 truncate">{item.channelName}</p>
                      <div className="flex items-center gap-2 text-[11px] text-gray-500">
                        <span>{formatCount(item.views)} views</span>
                        <span>{item.publishedLabel}</span>
                      </div>
                    </div>
                  </Link>

                  {/* Watch Later button */}
                  <button
                    onClick={() => handleToggleWatchLater(item.id)}
                    className="absolute right-2 top-2 z-10 rounded-full bg-black/60 p-1.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/80"
                    title={watchLater.has(item.id) ? 'Remove from Watch Later' : 'Add to Watch Later'}
                  >
                    {watchLater.has(item.id) ? (
                      <svg className="h-4 w-4 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                      </svg>
                    )}
                  </button>

                  {/* Platform indicator dot */}
                  <span
                    className="absolute left-2 top-2 z-10 h-2 w-2 rounded-full opacity-80"
                    style={{ backgroundColor: item.sourceColor }}
                    title={item.sourceLabel}
                  />
                </div>
              ))}
            </div>
          )}

          {/* ── Load More ──────────────────────────────────────────── */}
          {hasMore && items.length > 0 && (
            <div className="mt-8 text-center">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="rounded-lg border border-white/20 bg-white/5 px-6 py-2.5 text-sm font-medium transition-colors hover:bg-white/10 disabled:opacity-50"
              >
                {loadingMore ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Loading more...
                  </span>
                ) : (
                  'Load More Videos'
                )}
              </button>
            </div>
          )}

          {/* ── Footer stats ───────────────────────────────────────── */}
          <div className="mt-6 border-t border-white/10 pt-4">
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-gray-500">
              <span>All platforms: zero-cost hosting</span>
              <span>Source: YouTube, PeerTube, Odysee, Twitch, DTube, Rumble, Vimeo, Dailymotion, BitChute, Kick, LiveTube, Nostr, Farcaster, IPFS, Arweave</span>
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
