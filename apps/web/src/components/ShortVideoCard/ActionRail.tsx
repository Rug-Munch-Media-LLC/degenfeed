'use client';

import type { UnifiedPost } from '@degenfeed/types';
import Image from 'next/image';
import { ActionButton } from './ActionButton';

interface ActionRailProps {
  post: UnifiedPost;
  liked: boolean;
  bookmarked: boolean;
  likeCount: number;
  tipCount: number;
  protocolColor: string;
  showOverlay: boolean;
  showInfoPanel: boolean;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  onTip: () => void;
  onBookmark: () => void;
}

export function ActionRail({
  post,
  liked,
  bookmarked,
  likeCount,
  tipCount,
  protocolColor,
  showOverlay,
  showInfoPanel,
  onLike,
  onComment,
  onShare,
  onTip,
  onBookmark,
}: ActionRailProps) {
  return (
    <div
      className={`absolute bottom-24 right-3 z-30 flex flex-col items-center gap-3 transition-all duration-300 sm:bottom-28 ${
        showOverlay && !showInfoPanel
          ? 'opacity-100 translate-x-0'
          : 'opacity-0 translate-x-4 pointer-events-none'
      }`}
    >
      {/* Avatar */}
      <div className="mb-1 flex flex-col items-center">
        <a
          href={`/profile?protocol=${post.protocol}&id=${encodeURIComponent(post.author.id)}`}
          className="block"
          aria-label={`${post.author.displayName}'s profile`}
        >
          {post.author.avatarUrl ? (
            <Image
              src={post.author.avatarUrl}
              alt={post.author.displayName}
              width={40}
              height={40}
              className="h-10 w-10 rounded-full border-2 border-white/20 object-cover ring-1 ring-degen-500/30"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white/20 bg-degen-500/20 text-sm font-bold text-degen-400">
              {post.author.displayName.charAt(0).toUpperCase()}
            </div>
          )}
        </a>
        <span
          className="mt-0.5 h-0.5 w-4 rounded-full"
          style={{ backgroundColor: protocolColor }}
        />
      </div>

      <ActionButton
        icon={
          liked ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )
        }
        label="Like"
        count={likeCount}
        active={liked}
        color="#ff2d55"
        onClick={onLike}
      />

      <ActionButton
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        }
        label="Comment"
        count={post.metrics.replies > 0 ? post.metrics.replies : undefined}
        onClick={onComment}
      />

      <ActionButton
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        }
        label="Share"
        onClick={onShare}
      />

      <ActionButton
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        }
        label="Tip"
        count={(post.tipCount ?? tipCount) > 0 ? (post.tipCount ?? tipCount) : undefined}
        color="#ffaa00"
        onClick={onTip}
      />

      <ActionButton
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d={
                bookmarked
                  ? 'M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z'
                  : 'M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z'
              }
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill={bookmarked ? 'currentColor' : 'none'}
            />
          </svg>
        }
        label={bookmarked ? 'Saved' : 'Bookmark'}
        active={bookmarked}
        color="#00bfff"
        onClick={onBookmark}
      />
    </div>
  );
}
