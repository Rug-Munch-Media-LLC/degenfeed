'use client';

import Image from 'next/image';
import { formatCount, formatDate, formatDuration } from '../SearchHelpers';
import type { FlatItem, VideoResult } from '../SearchTypes';

interface Props {
  videos: VideoResult[];
  flatItems: FlatItem[];
  selectedIndex: number;
  onSelectIndex: (idx: number) => void;
  onClose: () => void;
  query: string;
  onCommitSearch: (q: string) => void;
}

export function VideosSection({
  videos,
  flatItems,
  selectedIndex,
  onSelectIndex,
  onClose,
  query,
  onCommitSearch,
}: Props) {
  if (videos.length === 0) return null;
  return (
    <div>
      <div className="sticky top-0 z-10 bg-[var(--color-card)]/95 backdrop-blur-sm px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-muted)] border-b border-[var(--color-border)]">
        Videos
      </div>
      {videos.map((video) => {
        const globalIdx = flatItems.findIndex(
          (fi) => fi.type === 'video' && (fi.data as VideoResult).id === video.id,
        );
        return (
          <button
            key={video.id}
            type="button"
            data-result-idx={globalIdx}
            onClick={() => {
              onCommitSearch(query);
              window.open(video.url, '_blank', 'noopener,noreferrer');
              onClose();
            }}
            onMouseEnter={() => onSelectIndex(globalIdx)}
            className={`flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors ${selectedIndex === globalIdx ? 'bg-degen-500/10' : 'hover:bg-[var(--color-overlay)]'}`}
          >
            <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-[var(--color-overlay)]">
              {video.thumbnailUrl ? (
                <Image
                  src={video.thumbnailUrl}
                  alt=""
                  width={96}
                  height={56}
                  className="h-14 w-24 object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-lg text-[var(--color-muted)]">
                  ▶
                </div>
              )}
              {video.durationSeconds > 0 && (
                <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[9px] text-white leading-normal">
                  {formatDuration(video.durationSeconds)}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium text-[var(--color-fg)]">
                  {video.title}
                </span>
                <span className="shrink-0 rounded-full bg-orange-500/20 px-1.5 py-0.5 text-[9px] font-medium text-orange-400">
                  {video.source}
                </span>
              </div>
              {video.channelName && (
                <div className="mt-0.5 text-xs text-[var(--color-muted)] truncate">
                  {video.channelName}
                </div>
              )}
              <div className="mt-1 flex gap-3 text-[10px] text-[var(--color-muted)]">
                {video.views > 0 && <span>{formatCount(video.views)} views</span>}
                {video.publishedAt > 0 && <span>{formatDate(video.publishedAt)}</span>}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
