'use client';

/**
 * SwipeablePostCard — mobile quick actions.
 *
 * Swiping a post card to the LEFT reveals quick actions (like, repost,
 * bookmark) pinned to the right edge — a native-app pattern that makes
 * engagement one gesture away without cluttering the card.
 *
 * Desktop and non-touch devices render the plain card untouched.
 * Vertical scrolling and horizontal swipe-tabs are preserved: only
 * horizontal gestures on the card itself are captured.
 */

import type { EngagementAction, UnifiedPost } from '@degenfeed/types';
import { memo, useCallback, useRef, useState } from 'react';
import { useHapticFeedback } from '../../hooks/useHapticFeedback';

export interface SwipeablePostCardProps {
  post: UnifiedPost;
  onEngage: (
    action: EngagementAction,
    postId: string,
    content?: string,
  ) => Promise<{ ok: boolean; error?: string }> | { ok: boolean; error?: string };
  children: React.ReactElement;
}

const REVEAL_WIDTH = 88; // px of actions revealed
const SNAP_THRESHOLD = 40; // px of swipe before snapping open

function QuickActionButton({
  label,
  icon,
  colorClass,
  active,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  colorClass: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onKeyDown={(e) => e.stopPropagation()}
      className={`flex h-11 w-11 items-center justify-center rounded-full text-lg transition-transform active:scale-90 ${colorClass} ${
        active ? 'scale-110' : ''
      }`}
      aria-label={label}
      title={label}
    >
      {icon}
    </button>
  );
}

export const SwipeablePostCard = memo(function SwipeablePostCard({
  post,
  onEngage,
  children,
}: SwipeablePostCardProps) {
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState(false);
  const dragStartX = useRef<number | null>(null);
  const dragStartY = useRef<number | null>(null);
  const draggingRef = useRef(false);
  const haptic = useHapticFeedback();

  const isTouch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    dragStartX.current = touch.clientX;
    dragStartY.current = touch.clientY;
    draggingRef.current = true;
  }, []);

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!draggingRef.current || dragStartX.current === null || dragStartY.current === null)
        return;
      const touch = e.touches[0];
      if (!touch) return;
      const dx = touch.clientX - dragStartX.current;
      const dy = touch.clientY - dragStartY.current;
      // Only horizontal gestures — let vertical scrolling through untouched.
      if (Math.abs(dy) > Math.abs(dx)) {
        dragStartX.current = null;
        draggingRef.current = false;
        return;
      }
      if (Math.abs(dx) < 8) return;
      e.preventDefault();
      // Leftward drag opens; rightward drag closes. Clamp to [ -REVEAL_WIDTH, 0 ].
      const next = Math.max(-REVEAL_WIDTH, Math.min(0, dx - (open ? REVEAL_WIDTH : 0)));
      setOffset(next);
    },
    [open],
  );

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      const touch = e.changedTouches[0];
      const dx = touch && dragStartX.current !== null ? touch.clientX - dragStartX.current : 0;
      dragStartX.current = null;
      dragStartY.current = null;
      if (!open && dx < -SNAP_THRESHOLD) {
        setOpen(true);
        setOffset(-REVEAL_WIDTH);
        haptic.triggerBookmark();
      } else if (open && dx > SNAP_THRESHOLD) {
        setOpen(false);
        setOffset(0);
        haptic.triggerLike();
      } else {
        setOffset(open ? -REVEAL_WIDTH : 0);
      }
    },
    [open, haptic],
  );

  const runAction = useCallback(
    async (action: EngagementAction) => {
      // Close the sheet then dispatch — feels like a native swipe action.
      setOpen(false);
      setOffset(0);
      await onEngage(action, post.id);
    },
    [onEngage, post.id],
  );

  const viewerLiked = post.engagement?.viewerLiked ?? false;
  const viewerReposted = post.engagement?.viewerReposted ?? false;
  const viewerBookmarked = post.engagement?.viewerBookmarked ?? false;

  // Non-touch devices: render the card as-is.
  if (!isTouch) return children;

  return (
    <div
      className="relative overflow-hidden"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      {/* Quick actions revealed behind the card */}
      <div
        className="absolute inset-y-0 right-0 flex w-[88px] flex-col items-center justify-center gap-1.5"
        aria-hidden={!open}
        style={{
          backgroundColor: 'color-mix(in srgb, var(--color-accent) 8%, var(--color-card))',
        }}
      >
        <QuickActionButton
          label="Like"
          active={viewerLiked}
          colorClass={viewerLiked ? 'text-pink-500' : 'text-[var(--color-fg-secondary)]'}
          icon={viewerLiked ? <span className="text-pink-500">♥</span> : <span>♡</span>}
          onClick={() => void runAction(viewerLiked ? 'unlike' : 'like')}
        />
        <QuickActionButton
          label="Repost"
          active={viewerReposted}
          colorClass={viewerReposted ? 'text-degen-500' : 'text-[var(--color-fg-secondary)]'}
          icon={viewerReposted ? '↻' : '↺'}
          onClick={() => void runAction(viewerReposted ? 'unrepost' : 'repost')}
        />
        <QuickActionButton
          label="Bookmark"
          active={viewerBookmarked}
          colorClass={viewerBookmarked ? 'text-amber-400' : 'text-[var(--color-fg-secondary)]'}
          icon={viewerBookmarked ? '★' : '☆'}
          onClick={() => void runAction(viewerBookmarked ? 'unbookmark' : 'bookmark')}
        />
      </div>

      {/* Card with live drag transform */}
      <div
        className="relative bg-[var(--color-bg)] transition-transform duration-200 ease-out"
        style={{
          transform: `translateX(${offset}px)`,
          transitionTimingFunction: draggingRef.current
            ? undefined
            : 'cubic-bezier(0.22, 1, 0.36, 1)',
          touchAction: 'pan-y',
        }}
      >
        {children}
      </div>
    </div>
  );
});

export default SwipeablePostCard;
