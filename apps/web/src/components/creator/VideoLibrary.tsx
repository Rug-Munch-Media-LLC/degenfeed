'use client';

import { useState } from 'react';
import type { CreatorVideoMeta } from './useCreatorVideos';
import { useCreatorVideos } from './useCreatorVideos';

// === Helpers =============================================================

function formatDuration(seconds: number): string {
  if (!seconds) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatCompact(n: number | undefined): string {
  if (!n) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function stateLabel(state: string): { text: string; color: string } {
  switch (state) {
    case 'published':
      return { text: 'Live', color: 'text-degen-400' };
    case 'processing':
      return { text: 'Processing', color: 'text-yellow-400' };
    case 'pending':
      return { text: 'Pending', color: 'text-[var(--color-muted)]' };
    case 'error':
      return { text: 'Error', color: 'text-red-400' };
    default:
      return { text: state, color: 'text-[var(--color-muted)]' };
  }
}

// === Video Card ==========================================================

function VideoCard({
  video,
  onEdit,
  onDelete,
  onAnalytics,
}: {
  video: CreatorVideoMeta;
  onEdit: (v: CreatorVideoMeta) => void;
  onDelete: (v: CreatorVideoMeta) => void;
  onAnalytics: (v: CreatorVideoMeta) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const state = stateLabel(video.state!);

  return (
    <div className="group relative overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] transition-all duration-200 hover:border-degen-500/20 hover:shadow-[0_0_20px_rgba(0,255,65,0.04)]">
      {/* Thumbnail */}
      <div className="relative aspect-video overflow-hidden bg-[var(--color-overlay)]">
        {video.thumbnailUrl ? (
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="text-3xl text-[var(--color-muted)]">
              {video.isShort ? '🎬' : '📹'}
            </span>
          </div>
        )}

        {/* Duration badge */}
        {(video.duration ?? 0) > 0 && (
          <span className="absolute bottom-2 right-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-white">
            {formatDuration(video.duration ?? 0)}
          </span>
        )}

        {/* Short badge */}
        {video.isShort && (
          <span className="absolute left-2 top-2 rounded-md bg-degen-500/80 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-black">
            Short
          </span>
        )}

        {/* State badge */}
        <span
          className={`absolute right-2 top-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-medium ${state.color}`}
        >
          {state.text}
        </span>
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="truncate text-sm font-medium text-[var(--color-fg)]" title={video.title}>
          {video.title}
        </h3>

        <div className="mt-1.5 flex items-center gap-3 text-[10px] text-[var(--color-muted)]">
          <span>{formatCompact(video.views ?? 0)} views</span>
          <span className="ml-auto">{video.createdAt ? formatDate(video.createdAt) : ''}</span>
        </div>

        {/* Tags */}
        {video.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {video.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-[var(--color-overlay)] px-2 py-0.5 text-[9px] text-[var(--color-muted)]"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="mt-3 flex items-center gap-1.5">
          <a
            href={video.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 rounded-lg bg-degen-500/20 py-1.5 text-center text-[10px] font-medium text-degen-400 transition-colors hover:bg-degen-500/30"
          >
            View
          </a>
          <button
            type="button"
            onClick={() => onAnalytics(video)}
            className="rounded-lg bg-[var(--color-overlay)] px-2.5 py-1.5 text-[10px] text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
            title="Analytics"
          >
            📊
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMenu(!showMenu)}
              className="rounded-lg bg-[var(--color-overlay)] px-2 py-1.5 text-[10px] text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
              aria-label="More actions"
            >
              ···
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-8 z-20 w-36 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] py-1 shadow-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      onEdit(video);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-xs text-[var(--color-fg)] transition-colors hover:bg-[var(--color-overlay)]"
                  >
                    ✏️ Edit
                  </button>
                  <a
                    href={video.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--color-fg)] transition-colors hover:bg-[var(--color-overlay)]"
                  >
                    🔗 Share
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      onDelete(video);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-400 transition-colors hover:bg-red-500/10"
                  >
                    🗑️ Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// === Main Video Library ==================================================

interface VideoLibraryProps {
  type?: 'video' | 'short';
  onUploadClick: () => void;
  onEdit: (video: CreatorVideoMeta) => void;
  onDelete: (video: CreatorVideoMeta) => void;
  onAnalytics: (video: CreatorVideoMeta) => void;
  onCreateShort?: () => void;
}

export default function VideoLibrary({
  type,
  onUploadClick,
  onEdit,
  onDelete,
  onAnalytics,
  onCreateShort,
}: VideoLibraryProps) {
  const { videos, loading, error } = useCreatorVideos(type);
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skeleton aspect-video rounded-xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="card border-red-500/20 bg-red-500/5 p-6 text-center">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] py-16 text-center backdrop-blur-xl">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
          <span className="text-2xl text-[var(--color-muted)]">
            {type === 'short' ? '🎬' : '📹'}
          </span>
        </div>
        <h3 className="mb-1 text-base font-semibold text-[var(--color-fg)]">
          No {type === 'short' ? 'shorts' : 'videos'} yet
        </h3>
        <p className="mb-6 text-sm text-[var(--color-muted)] max-w-sm mx-auto">
          {type === 'short'
            ? 'Create your first short-form video. Vertical format, up to 60 seconds.'
            : 'Upload your first video. It will appear on the Video Hub and be cross-posted to all protocols.'}
        </p>
        <div className="flex justify-center gap-3">
          <button type="button" onClick={onUploadClick} className="btn-primary text-sm">
            Upload {type === 'short' ? 'Short' : 'Video'}
          </button>
          {type === 'short' && onCreateShort && (
            <button type="button" onClick={onCreateShort} className="btn-secondary text-sm">
              Record Short
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs text-[var(--color-muted)]">
          {videos.length} video{videos.length !== 1 ? 's' : ''}
          {type === 'short' ? ' · Shorts' : ''}
        </p>
        {videos.length > 0 && (
          <span className="text-[10px] text-[var(--color-muted)]">
            (filtered from {videos.length})
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {videos.map((video) => (
          <VideoCard
            key={video.uuid}
            video={video}
            onEdit={onEdit}
            onDelete={onDelete}
            onAnalytics={onAnalytics}
          />
        ))}
      </div>
    </div>
  );
}
