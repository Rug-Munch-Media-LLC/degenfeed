'use client';

/**
 * ShortsActions — Right-side vertical action rail.
 * Like, Comment, Tip, Share, Bookmark buttons with counts.
 */

import { memo } from 'react';

// ─── Helpers ──────────────────────────────────────────────────────────────

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ─── Types ────────────────────────────────────────────────────────────────

interface ShortsActionsProps {
  liked: boolean;
  likeCount: number;
  commentCount?: number;
  tipCount?: number;
  bookmarked: boolean;
  showCreatorCoin?: boolean;
  creatorCoinSymbol?: string;
  onLike: () => void;
  onComment: () => void;
  onTip: () => void;
  onShare: () => void;
  onBookmark: () => void;
  onCreatorCoin?: () => void;
  visible: boolean;
}

// ─── Individual action button ─────────────────────────────────────────────

interface ActionBtnProps {
  icon: React.ReactNode;
  label: string;
  count?: number;
  active?: boolean;
  onClick?: () => void;
  color?: string;
}

const ActionButton = memo(function ActionButton({
  icon,
  label,
  count,
  active = false,
  onClick,
  color,
}: ActionBtnProps) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className="group flex flex-col items-center gap-0.5 transition-transform active:scale-90"
      aria-label={`${label}${count != null ? ` — ${formatCount(count)}` : ''}`}
    >
      <span
        className={`flex h-11 w-11 items-center justify-center rounded-full backdrop-blur-md transition-all
        ${
          active
            ? 'bg-degen-500/20 text-degen-400 shadow-[0_0_12px_rgba(0,255,65,0.2)]'
            : 'bg-white/10 text-white/80 hover:bg-white/20 hover:text-white'
        }`}
        style={active && color ? { backgroundColor: `${color}22`, color } : undefined}
      >
        {icon}
      </span>
      {count != null && count > 0 && (
        <span className="text-[10px] font-medium text-white/70">{formatCount(count)}</span>
      )}
    </button>
  );
});

// ─── Main component ──────────────────────────────────────────────────────

export function ShortsActions({
  liked,
  likeCount,
  commentCount,
  tipCount,
  bookmarked,
  showCreatorCoin,
  creatorCoinSymbol,
  onLike,
  onComment,
  onTip,
  onShare,
  onBookmark,
  onCreatorCoin,
  visible,
}: ShortsActionsProps) {
  return (
    <div
      className={`flex flex-col items-center gap-3 transition-all duration-300 ${
        visible
          ? 'opacity-100 translate-x-0'
          : 'opacity-0 translate-x-4 pointer-events-none'
      }`}
    >
      {/* Like */}
      <ActionButton
        icon={
          liked ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )
        }
        label="Like"
        count={likeCount}
        active={liked}
        color="#ff2d55"
        onClick={onLike}
      />

      {/* Comment */}
      <ActionButton
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        }
        label="Comment"
        count={commentCount}
        onClick={onComment}
      />

      {/* Tip */}
      <ActionButton
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        }
        label="Tip"
        count={tipCount}
        color="#ffaa00"
        onClick={onTip}
      />

      {/* Share */}
      <ActionButton
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        }
        label="Share"
        onClick={onShare}
      />

      {/* Bookmark */}
      <ActionButton
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d={bookmarked ? 'M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z' : 'M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z'} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill={bookmarked ? 'currentColor' : 'none'} />
          </svg>
        }
        label={bookmarked ? 'Saved' : 'Bookmark'}
        active={bookmarked}
        color="#00bfff"
        onClick={onBookmark}
      />

      {/* Creator Coin */}
      {showCreatorCoin && creatorCoinSymbol && (
        <ActionButton
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
              <path d="M12 7v10M8 12h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          }
          label={creatorCoinSymbol}
          color="#f7931a"
          onClick={onCreatorCoin}
        />
      )}
    </div>
  );
}
