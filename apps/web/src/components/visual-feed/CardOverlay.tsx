'use client';

/**
 * CardOverlay — Hover/active overlay with tip/mint/collect/like actions.
 * Appears on hover on desktop, tap on mobile.
 */

import type { VisualPost } from '@degenfeed/types';
import { useCallback, useState } from 'react';

interface CardOverlayProps {
  post: VisualPost;
  onTip?: (post: VisualPost) => void;
  onMint?: (post: VisualPost) => void;
  onCollect?: (post: VisualPost) => void;
  onLike?: (post: VisualPost) => void;
  onComment?: (post: VisualPost) => void;
  onRepost?: (post: VisualPost) => void;
}

export function CardOverlay({
  post,
  onTip,
  onMint,
  onCollect,
  onLike,
  onComment,
  onRepost,
}: CardOverlayProps) {
  const [liked, setLiked] = useState(post.engagement?.viewerLiked ?? false);
  const [likeCount, setLikeCount] = useState(post.metrics?.likes ?? 0);

  const handleLike = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setLiked((prev) => !prev);
      setLikeCount((prev) => (liked ? prev - 1 : prev + 1));
      onLike?.(post);
    },
    [post, liked, onLike],
  );

  const handleTip = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onTip?.(post);
    },
    [post, onTip],
  );

  const handleMint = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onMint?.(post);
    },
    [post, onMint],
  );

  const handleCollect = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onCollect?.(post);
    },
    [post, onCollect],
  );

  const handleComment = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onComment?.(post);
    },
    [post, onComment],
  );

  const handleRepost = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onRepost?.(post);
    },
    [post, onRepost],
  );

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-end bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100 sm:pointer-events-auto">
      {/* Top section: protocol badge */}
      <div className="absolute right-2 top-2">
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm"
          style={{ backgroundColor: `${post.sourceColor}99` }}
        >
          <span aria-hidden="true">{post.sourceBadge}</span>
          <span>{post.sourceLabel}</span>
        </span>
      </div>

      {/* Creator info */}
      <div className="px-3 pb-2">
        <div className="flex items-center gap-2">
          {post.author.avatarUrl ? (
            <img
              src={post.author.avatarUrl}
              alt=""
              className="h-7 w-7 rounded-full border-2 border-white/30 object-cover"
            />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-[10px] font-bold text-white">
              {post.author.displayName?.[0] ?? '?'}
            </div>
          )}
          <span className="truncate text-xs font-medium text-white drop-shadow-sm">
            {post.author.displayName ||
              post.author.handles?.bluesky ||
              post.author.handles?.mastodon ||
              'Anonymous'}
          </span>
        </div>
        {post.text && (
          <p className="mt-1 line-clamp-2 text-[11px] text-white/80 drop-shadow-sm">{post.text}</p>
        )}
      </div>

      {/* Action buttons row */}
      <div className="flex items-center justify-around px-3 pb-3">
        {/* Like */}
        <button
          type="button"
          onClick={handleLike}
          className={`flex flex-col items-center gap-0.5 transition-colors ${
            liked ? 'text-red-400' : 'text-white/70 hover:text-white'
          }`}
          aria-label={liked ? 'Unlike' : 'Like'}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill={liked ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          {likeCount > 0 && (
            <span className="text-[10px] font-medium tabular-nums">{formatCount(likeCount)}</span>
          )}
        </button>

        {/* Comment */}
        <button
          type="button"
          onClick={handleComment}
          className="flex flex-col items-center gap-0.5 text-white/70 hover:text-white transition-colors"
          aria-label="Comment"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          {post.metrics?.replies > 0 && (
            <span className="text-[10px] font-medium tabular-nums">
              {formatCount(post.metrics.replies)}
            </span>
          )}
        </button>

        {/* Repost */}
        <button
          type="button"
          onClick={handleRepost}
          className="flex flex-col items-center gap-0.5 text-white/70 hover:text-green-400 transition-colors"
          aria-label="Repost"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M17 1l4 4-4 4M7 19l-4-4 4-4" />
            <path d="M21 5H10a5 5 0 0 0-5 5v1" />
            <path d="M3 19h11a5 5 0 0 0 5-5v-1" />
          </svg>
          {post.metrics?.reposts > 0 && (
            <span className="text-[10px] font-medium tabular-nums">
              {formatCount(post.metrics.reposts)}
            </span>
          )}
        </button>

        {/* Tip */}
        <button
          type="button"
          onClick={handleTip}
          className="flex flex-col items-center gap-0.5 text-white/70 hover:text-yellow-400 transition-colors"
          aria-label="Tip"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </button>

        {/* Mint (NFT only) */}
        {post.isNFT && post.mintUrl && (
          <button
            type="button"
            onClick={handleMint}
            className="flex flex-col items-center gap-0.5 text-white/70 hover:text-purple-400 transition-colors"
            aria-label="Mint NFT"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M12 8v8M8 12h8" />
            </svg>
          </button>
        )}

        {/* Collect (creator coin) */}
        {post.collectUrl && (
          <button
            type="button"
            onClick={handleCollect}
            className="flex flex-col items-center gap-0.5 text-white/70 hover:text-cyan-400 transition-colors"
            aria-label="Collect"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M12 2l2.4 7.2H22l-6 4.8 2.4 7.2L12 16l-6.4 5.2L8 14l-6-4.8h7.6z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
