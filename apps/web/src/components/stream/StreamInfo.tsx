'use client';

import { useState } from 'react';
import type { StreamExtended } from './types';
import { getCategoryInfo } from './types';
import { StreamFollowButton } from './StreamFollowButton';
import { StreamSubscribeButton } from './StreamSubscribeButton';
import { StreamReportButton } from './StreamReportButton';
import { StreamClipButton } from './StreamClipButton';
import { StreamShareButton } from './StreamShareButton';

/* === StreamInfo Component ===================================== */

interface StreamInfoProps {
  stream: StreamExtended;
}

export function StreamInfo({ stream }: StreamInfoProps) {
  const [expanded, setExpanded] = useState(false);
  const category = getCategoryInfo(stream.category);

  return (
    <div className="space-y-4">
      {/* Title + actions row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-white sm:text-2xl line-clamp-2">
            {stream.title}
          </h1>
          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
            {/* Category badge */}
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
              style={{ backgroundColor: `${category.color}20`, color: category.color }}
            >
              <span aria-hidden="true">{category.icon}</span>
              {category.label}
            </span>

            {/* Tags */}
            {stream.tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-white/5 px-2.5 py-0.5 text-[10px] font-medium text-white/50"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <StreamClipButton streamId={stream.id} />
          <StreamShareButton streamId={stream.id} title={stream.title} />
          <StreamReportButton streamId={stream.id} />
        </div>
      </div>

      {/* Creator info + follow/subscribe */}
      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-degen-500/30 to-purple-500/30 text-sm font-bold text-degen-400 ring-2 ring-degen-500/20">
              {stream.creatorAvatar ? (
                <img src={stream.creatorAvatar} alt={stream.creatorDisplayName} className="h-full w-full rounded-full object-cover" />
              ) : (
                stream.creatorHandle[0]?.toUpperCase() || '?'
              )}
            </div>
            {stream.isLive && (
              <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 ring-2 ring-gray-900">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
              </span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white">{stream.creatorDisplayName}</h2>
              <span className="text-xs text-white/40">@{stream.creatorHandle}</span>
            </div>
            <div className="mt-0.5 flex items-center gap-3 text-[11px] text-white/50">
              <span>{formatCount(stream.stats.followers)} followers</span>
              <span>·</span>
              <span>{formatCount(stream.stats.subscribers)} subscribers</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <StreamFollowButton streamId={stream.id} isFollowing={stream.isFollowing} />
          <StreamSubscribeButton streamId={stream.id} isSubscribed={stream.isSubscribed} />
        </div>
      </div>

      {/* Description (expandable) */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white/90">About</h3>
          <span className="text-[10px] text-white/30">{stream.viewerCount.toLocaleString()} watching</span>
        </div>
        <p className={`mt-2 text-sm leading-relaxed text-white/60 ${expanded ? '' : 'line-clamp-3'}`}>
          {stream.description}
        </p>
        {stream.description.length > 150 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-1 text-xs font-medium text-degen-400 transition-colors hover:text-degen-300"
          >
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}

        {/* Stats row */}
        <div className="mt-3 grid grid-cols-3 gap-3 border-t border-white/10 pt-3">
          <div className="text-center">
            <p className="text-xs font-bold text-white">{formatCount(stream.stats.totalViews)}</p>
            <p className="text-[9px] text-white/40">Total Views</p>
          </div>
          <div className="text-center">
            <p className="text-xs font-bold text-white">{formatCount(stream.stats.totalStreams)}</p>
            <p className="text-[9px] text-white/40">Streams</p>
          </div>
          <div className="text-center">
            <p className="text-xs font-bold text-white">{formatCount(stream.stats.averageViewers)}</p>
            <p className="text-[9px] text-white/40">Avg Viewers</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* === Helper =================================================== */

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
