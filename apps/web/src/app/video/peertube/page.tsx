'use client';

/**
 * @degenfeed/web — /video/peertube (PeerTube Explorer)
 *
 * Browse, search, and discover videos from the DegenFeed PeerTube instance.
 * Features:
 *   - Trending video grid with thumbnails, title, channel, views, duration
 *   - Category filter pills (Music, Gaming, Education, Tech, Entertainment, etc.)
 *   - Search bar for videos and channels
 *   - Featured channels section
 *   - Live now indicator for active streams
 *   - Upload button (opens upload modal)
 */

import { ErrorBoundary } from '@degenfeed/ui';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// ─── Types ─────────────────────────────────────────────────────────

interface PeerTubeVideoItem {
  id: string;
  numericId: number;
  title: string;
  description: string;
  url: string;
  embedUrl: string | null;
  thumbnailUrl: string | null;
  previewUrl: string | null;
  duration: number;
  views: number;
  likes: number;
  isLive: boolean;
  publishedAt: string;
  categoryLabel: string;
  category: { id: number | null; label: string } | null;
  tags: string[];
  channel: {
    name: string;
    displayName: string;
    url: string;
    avatarUrl: string | null;
  } | null;
  liveInfo: {
    viewerCount: number;
    health: string;
    state: string;
  } | null;
}

interface PeerTubeChannelItem {
  id: number;
  name: string;
  displayName: string;
  description: string;
  url: string;
  avatarUrl: string | null;
  videosCount: number;
  viewsCount: number;
  followersCount: number;
}

const API_BASE = '/api/peertube';

const CATEGORIES = [
  { id: 0, label: 'All' },
  { id: 14, label: 'Crypto & Web3' },
  { id: 13, label: 'Tech' },
  { id: 12, label: 'Education' },
  { id: 9, label: 'Gaming' },
  { id: 10, label: 'Entertainment' },
  { id: 1, label: 'Music' },
  { id: 11, label: 'News & Politics' },
  { id: 5, label: 'Science' },
  { id: 7, label: 'Lifestyle' },
];

const SORT_OPTIONS = [
  { value: '-publishedAt', label: 'Newest' },
  { value: '-views', label: 'Most Viewed' },
  { value: '-likes', label: 'Most Liked' },
  { value: 'duration', label: 'Shortest' },
  { value: '-duration', label: 'Longest' },
  { value: 'name', label: 'Name A-Z' },
];

// ─── Format Helpers ────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  if (seconds <= 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatViews(views: number): string {
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(1)}K`;
  return String(views);
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  const diffMonths = Math.floor(diffDays / 30);
  return `${diffMonths}mo ago`;
}

// ─── Upload Modal ──────────────────────────────────────────────────

function UploadModal({ onClose, onUploaded }: { onClose: () => void; onUploaded: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('13');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedFile || !title.trim()) {
        setError('Video file and title are required');
        return;
      }

      setUploading(true);
      setError(null);

      try {
        const formData = new FormData();
        formData.append('videofile', selectedFile);
        formData.append('name', title.trim());
        if (description.trim()) formData.append('description', description.trim());
        formData.append('category', category);
        formData.append('privacy', '1');
        formData.append('tags', 'degenfeed');

        const response = await fetch(`${API_BASE}/upload`, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({ error: 'Upload failed' }));
          throw new Error(err.error ?? `HTTP ${response.status}`);
        }

        onUploaded();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
      } finally {
        setUploading(false);
      }
    },
    [selectedFile, title, description, category, onClose, onUploaded],
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--color-fg)]">Upload to PeerTube</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--color-muted)] hover:text-[var(--color-fg)]"
          >
            <svg
              aria-hidden="true"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          {/* File picker */}
          <div>
            <label
              className="mb-1 block text-xs font-medium text-[var(--color-muted)]"
              htmlFor="field-79ccc209"
            >
              Video File *
            </label>
            <input
              id="field-79ccc209"
              type="file"
              accept="video/*"
              onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-2 text-sm text-[var(--color-fg)] file:mr-2 file:rounded file:border-0 file:bg-[var(--color-accent)] file:px-3 file:py-1 file:text-xs file:text-white"
            />
            {selectedFile && (
              <p className="mt-1 text-[11px] text-[var(--color-muted)]">
                {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(1)} MB)
              </p>
            )}
          </div>

          {/* Title */}
          <div>
            <label
              className="mb-1 block text-xs font-medium text-[var(--color-muted)]"
              htmlFor="field-79f13db6"
            >
              Title *
            </label>
            <input
              id="field-79f13db6"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              placeholder="Enter video title..."
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)]"
            />
          </div>

          {/* Description */}
          <div>
            <label
              className="mb-1 block text-xs font-medium text-[var(--color-muted)]"
              htmlFor="field-15a851cb"
            >
              Description
            </label>
            <textarea
              id="field-15a851cb"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Describe your video..."
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)]"
            />
          </div>

          {/* Category */}
          <div>
            <label
              className="mb-1 block text-xs font-medium text-[var(--color-muted)]"
              htmlFor="field-a122251a"
            >
              Category
            </label>
            <select
              id="field-a122251a"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-fg)]"
            >
              {CATEGORIES.filter((c) => c.id > 0).map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-red-500/10 p-3 text-xs text-red-400">{error}</div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={uploading}
            className="w-full rounded-lg bg-[var(--color-accent)] py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading ? 'Uploading...' : 'Upload to PeerTube'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Video Card ────────────────────────────────────────────────────

function VideoCard({ video }: { video: PeerTubeVideoItem }) {
  const [imgError, setImgError] = useState(false);

  return (
    <Link
      href={`/video?id=${video.id}&source=peertube`}
      className="group flex flex-col overflow-hidden rounded-xl bg-[var(--color-card)] transition-all hover:ring-1 hover:ring-[var(--color-accent)]/30"
    >
      {/* Thumbnail */}
      <div className="relative aspect-video overflow-hidden bg-[var(--color-bg)]">
        {video.thumbnailUrl && !imgError ? (
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[var(--color-muted)]">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
          </div>
        )}

        {/* Duration badge */}
        {video.duration > 0 && !video.isLive && (
          <span className="absolute bottom-1.5 right-1.5 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-medium text-white">
            {formatDuration(video.duration)}
          </span>
        )}

        {/* Live badge */}
        {video.isLive && (
          <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
            LIVE
            {video.liveInfo && (
              <span className="ml-0.5 font-normal">{video.liveInfo.viewerCount}</span>
            )}
          </span>
        )}

        {/* Category label */}
        {video.categoryLabel && video.categoryLabel !== 'Uncategorized' && (
          <span className="absolute right-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
            {video.categoryLabel}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex gap-3 p-3">
        {/* Channel avatar */}
        {video.channel?.avatarUrl && (
          <img
            src={video.channel.avatarUrl}
            alt=""
            className="mt-0.5 h-8 w-8 flex-shrink-0 rounded-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        )}

        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-sm font-medium leading-snug text-[var(--color-fg)]">
            {video.title}
          </h3>
          {video.channel && (
            <p className="mt-1 truncate text-[12px] text-[var(--color-muted)]">
              {video.channel.displayName}
            </p>
          )}
          <div className="mt-1 flex items-center gap-2 text-[11px] text-[var(--color-muted)]">
            <span>{formatViews(video.views)} views</span>
            <span>•</span>
            <span>{timeAgo(video.publishedAt)}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─── Channel Card ──────────────────────────────────────────────────

function ChannelCard({ channel }: { channel: PeerTubeChannelItem }) {
  return (
    <a
      href={channel.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-xl bg-[var(--color-card)] p-3 transition-colors hover:ring-1 hover:ring-[var(--color-accent)]/30"
    >
      {channel.avatarUrl ? (
        <img
          src={channel.avatarUrl}
          alt={channel.displayName}
          className="h-10 w-10 flex-shrink-0 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--color-fg)]">{channel.displayName}</p>
        <p className="text-[11px] text-[var(--color-muted)]">
          {channel.videosCount} videos · {formatViews(channel.viewsCount)} views
          {channel.followersCount > 0 && ` · ${channel.followersCount} followers`}
        </p>
      </div>
    </a>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────

export default function PeerTubeExplorerPage() {
  const [videos, setVideos] = useState<PeerTubeVideoItem[]>([]);
  const [channels, setChannels] = useState<PeerTubeChannelItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState(0);
  const [sort, setSort] = useState('-publishedAt');
  const [showUpload, setShowUpload] = useState(false);
  const [showChannels, setShowChannels] = useState(false);

  // Fetch videos
  const fetchVideos = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        sort,
        count: '50',
        start: '1',
      });

      if (searchQuery.trim()) {
        params.set('search', searchQuery.trim());
      }
      if (activeCategory > 0) {
        params.set('category', String(activeCategory));
      }

      const response = await fetch(`${API_BASE}/videos?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = (await response.json()) as { total: number; data: PeerTubeVideoItem[] };
      setVideos(data.data ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch videos');
      setVideos([]);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, activeCategory, sort]);

  // Fetch channels
  const fetchChannels = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/channels?count=20&sort=-videosCount`);
      if (!response.ok) return;
      const data = (await response.json()) as { total: number; data: PeerTubeChannelItem[] };
      setChannels(data.data ?? []);
    } catch {
      // Non-critical
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchVideos();
    fetchChannels();
  }, [fetchVideos, fetchChannels]);

  // Search debounce
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = useCallback((value: string) => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setSearchQuery(value);
    }, 400);
  }, []);

  // Separate live and on-demand videos
  const { liveVideos, onDemandVideos } = useMemo(() => {
    const live = videos.filter((v) => v.isLive);
    const onDemand = videos.filter((v) => !v.isLive);
    return { liveVideos: live, onDemandVideos: onDemand };
  }, [videos]);

  return (
    <ErrorBoundary>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <div className="mb-4 flex items-center gap-2 text-xs text-[var(--color-muted)]">
          <Link href="/feed" className="hover:text-[var(--color-fg)] transition-colors">
            Feed
          </Link>
          <span>/</span>
          <Link href="/video" className="hover:text-[var(--color-fg)] transition-colors">
            Video Hub
          </Link>
          <span>/</span>
          <span className="text-[var(--color-fg)]">PeerTube</span>
          <span className="ml-auto text-[10px] text-[var(--color-muted)]">
            {total} video{total !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-fg)]">PeerTube Explorer</h1>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Browse videos from video.degenfeed.xyz — our self-hosted, federated video platform
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-5 py-2.5 text-sm font-medium text-white transition-all hover:opacity-90"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Upload
          </button>
        </div>

        {/* Search bar */}
        <div className="mb-4">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="search"
              placeholder="Search videos and channels..."
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] py-2.5 pl-10 pr-4 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:border-[var(--color-accent)] focus:outline-none"
            />
          </div>
        </div>

        {/* Category pills */}
        <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                activeCategory === cat.id
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'bg-[var(--color-card)] text-[var(--color-muted)] hover:text-[var(--color-fg)]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Sort + Channels toggle */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <label className="text-xs text-[var(--color-muted)]" htmlFor="field-aa929f56">
              Sort:
            </label>
            <select
              id="field-aa929f56"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-2.5 py-1.5 text-xs text-[var(--color-fg)]"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => setShowChannels(!showChannels)}
            className={`text-xs font-medium transition-colors ${
              showChannels
                ? 'text-[var(--color-accent)]'
                : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
            }`}
          >
            {showChannels ? 'Hide Channels' : `Browse Channels (${channels.length})`}
          </button>
        </div>

        {/* Channels section */}
        {showChannels && channels.length > 0 && (
          <div className="mb-6">
            <h2 className="mb-3 text-sm font-semibold text-[var(--color-fg)]">Featured Channels</h2>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {channels.map((ch) => (
                <ChannelCard key={ch.id} channel={ch} />
              ))}
            </div>
          </div>
        )}

        {/* Live now section */}
        {liveVideos.length > 0 && (
          <div className="mb-6">
            <div className="mb-3 flex items-center gap-2">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
              <h2 className="text-sm font-semibold text-[var(--color-fg)]">
                Live Now ({liveVideos.length})
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {liveVideos.map((video) => (
                <VideoCard key={video.id} video={video} />
              ))}
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center">
            <p className="text-sm text-red-400">{error}</p>
            <button
              type="button"
              onClick={fetchVideos}
              className="mt-3 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-xs font-medium text-white"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-xl bg-[var(--color-card)]">
                <div className="aspect-video rounded-t-xl bg-[var(--color-bg)]" />
                <div className="space-y-2 p-3">
                  <div className="h-3 w-3/4 rounded bg-[var(--color-bg)]" />
                  <div className="h-2 w-1/2 rounded bg-[var(--color-bg)]" />
                  <div className="h-2 w-1/3 rounded bg-[var(--color-bg)]" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Video grid */}
        {!loading &&
          !error &&
          (onDemandVideos.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {onDemandVideos.map((video) => (
                <VideoCard key={video.id} video={video} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-card)]">
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="text-[var(--color-muted)]"
                >
                  <polygon points="23 7 16 12 23 17 23 7" />
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                </svg>
              </div>
              <p className="text-sm font-medium text-[var(--color-muted)]">
                {searchQuery.trim() ? 'No videos match your search' : 'No videos found'}
              </p>
              <p className="mt-1 text-xs text-[var(--color-muted)]/60">
                {searchQuery.trim()
                  ? 'Try different keywords or browse all categories'
                  : 'Upload a video to get started'}
              </p>
            </div>
          ))}

        {/* Upload modal */}
        {showUpload && (
          <UploadModal onClose={() => setShowUpload(false)} onUploaded={fetchVideos} />
        )}
      </div>
    </ErrorBoundary>
  );
}
