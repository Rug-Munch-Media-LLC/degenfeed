'use client';

import type { UnifiedPost } from '@degenfeed/types';
import Image from 'next/image';

interface ContentMosaicProps {
  posts: UnifiedPost[];
  color: string;
  onPostClick: (id: string) => void;
  loading: boolean;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function MosaicCard({
  post,
  color,
  onClick,
}: {
  post: UnifiedPost;
  color: string;
  onClick: (id: string) => void;
}) {
  const hasMedia = post.embeds?.some((e) => e.kind === 'image' || e.kind === 'video');
  const firstMedia = post.embeds?.find((e) => e.kind === 'image' || e.kind === 'video');

  return (
    <button
      type="button"
      onClick={() => onClick(post.id)}
      className="group relative flex w-64 shrink-0 flex-col overflow-hidden rounded-xl border text-left transition-all duration-200 hover:scale-[1.02] hover:shadow-lg sm:w-72"
      style={{
        borderColor: `${color}22`,
        backgroundColor: 'var(--color-card)',
      }}
    >
      {/* Media preview */}
      {firstMedia ? (
        <div className="relative h-32 w-full overflow-hidden sm:h-36">
          <Image
            src={firstMedia.url}
            alt="Featured post media"
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="288px"
          />
          <div
            className="absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100"
            style={{
              background: `linear-gradient(0deg, ${color}33 0%, transparent 50%)`,
            }}
          />
        </div>
      ) : (
        <div
          className="flex h-20 items-center justify-center sm:h-24"
          style={{ backgroundColor: `${color}08` }}
        >
          <span className="text-3xl opacity-30">
            {post.protocol === 'farcaster'
              ? '◈'
              : post.protocol === 'lens'
                ? '◎'
                : post.protocol === 'bluesky'
                  ? '☁'
                  : post.protocol === 'nostr'
                    ? '☰'
                    : 'M'}
          </span>
        </div>
      )}

      {/* Content */}
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        {/* Author row */}
        <div className="flex items-center gap-2">
          {post.author.avatarUrl ? (
            <Image
              src={post.author.avatarUrl}
              alt={post.author.displayName}
              width={20}
              height={20}
              className="h-5 w-5 rounded-full object-cover"
            />
          ) : (
            <div
              className="flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-bold"
              style={{ backgroundColor: `${color}22`, color }}
            >
              {post.author.displayName[0]?.toUpperCase() || '?'}
            </div>
          )}
          <span className="truncate text-xs font-medium" style={{ color: 'var(--color-fg)' }}>
            {post.author.displayName}
          </span>
        </div>

        {/* Text */}
        <p className="line-clamp-2 text-xs" style={{ color: 'var(--color-muted)' }}>
          {post.text}
        </p>

        {/* Metrics */}
        <div
          className="mt-auto flex items-center gap-3 text-[10px]"
          style={{ color: 'var(--color-muted)' }}
        >
          <span>♥ {formatCount(post.metrics.likes)}</span>
          <span>↻ {formatCount(post.metrics.reposts)}</span>
          {hasMedia && <span className="ml-auto">🖼</span>}
        </div>
      </div>
    </button>
  );
}

export function ContentMosaic({ posts, color, onPostClick, loading }: ContentMosaicProps) {
  if (loading) {
    return (
      <div className="mb-6">
        <div className="mb-3 flex items-center gap-2">
          <span className="h-4 w-24 animate-pulse rounded bg-[var(--color-overlay)]" />
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-48 w-64 shrink-0 animate-pulse rounded-xl sm:w-72"
              style={{ backgroundColor: 'var(--color-overlay)' }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (!posts.length) return null;

  return (
    <div className="mb-6">
      <div className="mb-3 flex items-center gap-2">
        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
        <span
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: 'var(--color-muted)' }}
        >
          Featured posts
        </span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
        {posts.slice(0, 6).map((post) => (
          <MosaicCard key={post.id} post={post} color={color} onClick={onPostClick} />
        ))}
      </div>
    </div>
  );
}
