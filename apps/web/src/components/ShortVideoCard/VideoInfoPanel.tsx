'use client';

import type { UnifiedPost } from '@degenfeed/types';
import { getProtocolColor } from '@degenfeed/ui';
import Image from 'next/image';
import { useMemo } from 'react';
import { extractHashtags, formatCount } from './helpers';

interface VideoInfoPanelProps {
  post: UnifiedPost;
  visible: boolean;
}

/**
 * Slide-up info panel showing full description, hashtags, creator, metrics
 */
export function VideoInfoPanel({ post, visible }: VideoInfoPanelProps) {
  const hashtags = useMemo(() => extractHashtags(post.text), [post.text]);
  const protocolColor = getProtocolColor(post.protocol);

  if (!visible) return null;

  return (
    <section
      className="absolute inset-x-0 bottom-0 z-40 max-h-[60vh] overflow-y-auto rounded-t-3xl border-t border-white/[0.06] bg-[#0a0a0a]/98 px-5 pb-8 pt-5 backdrop-blur-2xl"
      style={{ animation: 'shorts-panel-slide-up 0.35s cubic-bezier(0.32, 0.72, 0, 1)' }}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Escape') e.stopPropagation();
      }}
      aria-label="Video information"
    >
      {/* Handle */}
      <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />

      {/* Full description */}
      <h3 className="mb-1 text-sm font-bold text-white">Description</h3>
      <p className="mb-4 text-sm leading-relaxed text-white/70 whitespace-pre-wrap">{post.text}</p>

      {/* All hashtags */}
      {hashtags.length > 0 && (
        <div className="mb-4">
          <h4 className="mb-1.5 text-xs font-medium text-white/50">Topics</h4>
          <div className="flex flex-wrap gap-1.5">
            {hashtags.map((tag) => (
              <a
                key={tag}
                href={`/topics/${encodeURIComponent(tag.slice(1))}`}
                className="rounded-full bg-degen-500/10 px-2.5 py-1 text-xs font-medium text-degen-400 transition-colors hover:bg-degen-500/20"
              >
                {tag}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Creator info */}
      <div className="mb-4">
        <h4 className="mb-1.5 text-xs font-medium text-white/50">Creator</h4>
        <a
          href={`/profile?protocol=${post.protocol}&id=${encodeURIComponent(post.author.id)}`}
          className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-3 transition-colors hover:bg-white/[0.06]"
        >
          {post.author.avatarUrl ? (
            <Image
              src={post.author.avatarUrl}
              alt={post.author.displayName}
              width={36}
              height={36}
              className="h-9 w-9 rounded-full border border-white/10 object-cover"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-degen-500/20 text-xs font-bold text-degen-400">
              {post.author.displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{post.author.displayName}</p>
            <p className="text-xs text-white/50 truncate">
              @{post.author.handles[post.protocol] ?? post.author.id.slice(0, 16)}
            </p>
          </div>
          <span
            className="rounded-full px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider shrink-0"
            style={{ backgroundColor: `${protocolColor}18`, color: protocolColor }}
          >
            {post.protocol}
          </span>
        </a>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-3 rounded-xl bg-white/[0.03] p-3">
        <div className="text-center">
          <p className="text-sm font-bold text-white">{formatCount(post.metrics.likes)}</p>
          <p className="text-[10px] text-white/40">Likes</p>
        </div>
        <div className="text-center">
          <p className="text-sm font-bold text-white">{formatCount(post.metrics.replies)}</p>
          <p className="text-[10px] text-white/40">Comments</p>
        </div>
        <div className="text-center">
          <p className="text-sm font-bold text-white">{formatCount(post.metrics.reposts)}</p>
          <p className="text-[10px] text-white/40">Shares</p>
        </div>
      </div>
    </section>
  );
}
