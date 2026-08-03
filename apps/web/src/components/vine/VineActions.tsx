'use client';

/**
 * VineActions — Right-side vertical action rail for Vine shorts.
 *
 * Core Vine actions:
 *   - ❤️ Like (with count)
 *   - 🔄 Revine (repost) — "Revined" counter
 *   - 💬 Comment
 *   - ⚡ Tip
 *   - 📊 Vibe score breakdown
 *   - 👎 Not interested
 *   - 👍 See more like this
 */
import { memo } from 'react';

// ─── Helpers ──────────────────────────────────────────────────────────────

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

interface ActionBtnProps {
  icon: React.ReactNode;
  label: string;
  count?: number;
  active?: boolean;
  onClick?: () => void;
  color?: string;
  tooltip?: string;
  size?: 'sm' | 'md';
}

const ActionButton = memo(function ActionButton({
  icon,
  label,
  count,
  active = false,
  onClick,
  color,
  tooltip,
  size = 'md',
}: ActionBtnProps) {
  const btnSize = size === 'sm' ? 'h-9 w-9' : 'h-11 w-11';
  const iconSize = size === 'sm' ? 18 : 22;

  return (
    <div className="group relative flex flex-col items-center">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
        className={`flex flex-col items-center gap-0.5 transition-transform active:scale-90`}
        aria-label={`${label}${count != null && count > 0 ? ` — ${formatCount(count)}` : ''}`}
      >
        <span
          className={`flex ${btnSize} items-center justify-center rounded-full backdrop-blur-md transition-all duration-200 ${
            active
              ? 'bg-vine-500/20 text-vine-400 shadow-[0_0_12px_rgba(0,255,65,0.2)]'
              : 'bg-white/10 text-white/80 hover:bg-white/20 hover:text-white'
          }`}
          style={active && color ? { backgroundColor: `${color}22`, color } : undefined}
        >
          {icon}
        </span>
        {count != null && count > 0 && (
          <span className="text-[10px] font-medium tabular-nums text-white/70">
            {formatCount(count)}
          </span>
        )}
      </button>
      {tooltip && (
        <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-black/80 px-2 py-1 text-[9px] text-white/80 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
          {tooltip}
        </span>
      )}
    </div>
  );
});

// ─── Separator ────────────────────────────────────────────────────────────

function ActionSeparator() {
  return <div className="my-1 h-px w-6 bg-white/10" aria-hidden="true" />;
}

// ─── Props ────────────────────────────────────────────────────────────────

export interface VineActionsProps {
  liked: boolean;
  likeCount: number;
  revined: boolean;
  revineCount: number;
  vibeScore: number;
  canTip: boolean;
  commentCount?: number;
  onLike: () => void;
  onRevine: () => void;
  onComment: () => void;
  onTip: () => void;
  onShowVibe: () => void;
  onNotInterested: () => void;
  onSeeMoreLikeThis: () => void;
  visible: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────

export function VineActions({
  liked,
  likeCount,
  revined,
  revineCount,
  vibeScore,
  canTip,
  commentCount,
  onLike,
  onRevine,
  onComment,
  onTip,
  onShowVibe,
  onNotInterested,
  onSeeMoreLikeThis,
  visible,
}: VineActionsProps) {
  return (
    <div
      className={`flex flex-col items-center gap-3 transition-all duration-300 ${
        visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4 pointer-events-none'
      }`}
    >
      {/* ❤️ Like */}
      <ActionButton
        icon={
          liked ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#ff3040" aria-hidden="true">
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
        tooltip={liked ? 'Unlike' : 'Like (L)'}
      />

      {/* 🔄 Revine */}
      <ActionButton
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M1 12C1 12 5 4 12 4C19 4 23 12 23 12C23 12 19 20 12 20C5 20 1 12 1 12Z"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="M12 9C13.66 9 15 10.34 15 12C15 13.66 13.66 15 12 15C10.34 15 9 13.66 9 12C9 10.34 10.34 9 12 9Z"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="M16 8L20 12L16 16"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        }
        label="Revine"
        count={revineCount}
        active={revined}
        color="#00bfff"
        onClick={onRevine}
        tooltip={revined ? 'Revined!' : 'Revine (R)'}
      />

      {/* 💬 Comment */}
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
        count={commentCount}
        onClick={onComment}
        tooltip="Comment"
      />

      {/* ⚡ Tip (Lightning) */}
      {canTip && (
        <ActionButton
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                className="text-vine-400"
              />
            </svg>
          }
          label="Tip"
          color="#F5A623"
          onClick={onTip}
          tooltip="Tip creator (T)"
        />
      )}

      {/* Separator */}
      <ActionSeparator />

      {/* 📊 Vibe Score */}
      <ActionButton
        icon={
          <span
            className="text-sm font-bold tabular-nums"
            style={{ color: vibeScore >= 70 ? '#00FF41' : vibeScore >= 40 ? '#FFD600' : '#FF6B35' }}
          >
            {vibeScore}
          </span>
        }
        label="Vibe"
        onClick={onShowVibe}
        tooltip={`Vibe score: ${vibeScore}/100 (V)`}
        size="sm"
      />

      {/* 👎 Not interested */}
      <ActionButton
        icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M10 15l-4-4m0 0l4-4m-4 4h12"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        }
        label="Not interested"
        color="#FF6B35"
        onClick={onNotInterested}
        tooltip="Not interested (N)"
        size="sm"
      />

      {/* 👍 See more like this */}
      <ActionButton
        icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M14 9l4 4-4 4M10 15l-4-4 4-4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        }
        label="More like this"
        color="#00FF41"
        onClick={onSeeMoreLikeThis}
        tooltip="See more like this"
        size="sm"
      />
    </div>
  );
}
