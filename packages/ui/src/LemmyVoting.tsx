'use client';

/**
 * @degenfeed/ui — LemmyVoting
 *
 * Lemmy-style ▲ upvote / ▼ downvote buttons with score display.
 * Used in the PostCard engagement row for lemmy protocol posts.
 * Replaces the standard heart/repost buttons.
 */

import { memo, useState } from 'react';

export interface LemmyVotingProps {
  /** Current score (upvotes - downvotes) */
  score: number;
  /** Total upvotes */
  upvotes: number;
  /** Total downvotes */
  downvotes: number;
  /** Comment count for inline display */
  comments?: number;
  /** Current user vote state */
  userVote?: 'up' | 'down' | null;
  /** Called when the user votes */
  onVote?: (direction: 'up' | 'down' | null) => void;
  /** Compact mode for inline display in feed cards (default: true) */
  compact?: boolean;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export const LemmyVoting = memo(function LemmyVoting({
  score,
  upvotes,
  downvotes,
  comments,
  userVote: externalVote,
  onVote,
  compact = true,
}: LemmyVotingProps) {
  const [localVote, setLocalVote] = useState<'up' | 'down' | null>(externalVote ?? null);

  const handleVote = (direction: 'up' | 'down') => {
    const next = localVote === direction ? null : direction;
    setLocalVote(next);
    onVote?.(next);
  };

  // Adjust score for local optimistic update
  const displayScore = (() => {
    let s = score;
    if (localVote === 'up' && externalVote !== 'up') s += 1;
    else if (localVote === 'down' && externalVote !== 'down') s -= 1;
    else if (localVote === null && externalVote === 'up') s -= 1;
    else if (localVote === null && externalVote === 'down') s += 1;
    return s;
  })();

  const btnBase = 'flex items-center gap-0.5 rounded-md px-1.5 py-1 transition-all duration-150 focus:outline-none min-h-[28px]';

  if (compact) {
    // Compact inline row for feed cards
    return (
      <div className="flex items-center gap-0.5 text-xs text-gray-500">
        {/* Upvote */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleVote('up');
          }}
          className={`${btnBase} ${
            localVote === 'up'
              ? 'bg-orange-500/15 text-orange-400'
              : 'hover:bg-orange-500/10 hover:text-orange-400'
          }`}
          aria-label="Upvote"
          aria-pressed={localVote === 'up'}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="currentColor"
            aria-hidden="true"
            className={localVote === 'up' ? 'scale-110' : ''}
          >
            <path d="M7 1.5L13 11.5H1L7 1.5Z" />
          </svg>
        </button>

        {/* Score */}
        <span
          className={`font-medium tabular-nums ${
            localVote === 'up'
              ? 'text-orange-400'
              : localVote === 'down'
                ? 'text-blue-400'
                : displayScore >= 0
                  ? 'text-gray-500'
                  : 'text-gray-600'
          }`}
        >
          {formatCount(displayScore)}
        </span>

        {/* Downvote */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleVote('down');
          }}
          className={`${btnBase} ${
            localVote === 'down'
              ? 'bg-blue-500/15 text-blue-400'
              : 'hover:bg-blue-500/10 hover:text-blue-400'
          }`}
          aria-label="Downvote"
          aria-pressed={localVote === 'down'}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="currentColor"
            aria-hidden="true"
            className={localVote === 'down' ? 'scale-110' : ''}
          >
            <path d="M7 12.5L1 2.5H13L7 12.5Z" />
          </svg>
        </button>

        {/* Comment count */}
        <button
          type="button"
          className="flex items-center gap-1 rounded-md px-1.5 py-1 transition-colors hover:text-blue-400"
          aria-label="Comments"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M3 1.5H11C11.8284 1.5 12.5 2.17157 12.5 3V8.5C12.5 9.32843 11.8284 10 11 10H8L5 12.5V10H3C2.17157 10 1.5 9.32843 1.5 8.5V3C1.5 2.17157 2.17157 1.5 3 1.5Z"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinejoin="round"
            />
          </svg>
          <span className="tabular-nums" title="Comments">
            {formatCount(comments ?? upvotes)}
          </span>
        </button>
      </div>
    );
  }

  // Full mode (expanded view)
  return (
    <div className="flex flex-col items-center gap-0.5">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleVote('up');
        }}
        className={`rounded p-1 transition-colors ${
          localVote === 'up'
            ? 'bg-orange-500/15 text-orange-400'
            : 'text-gray-600 hover:bg-orange-500/10 hover:text-orange-400'
        }`}
        aria-label="Upvote"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
          <path d="M9 2L16 14H2L9 2Z" />
        </svg>
      </button>
      <span
        className={`text-xs font-bold tabular-nums ${
          localVote === 'up'
            ? 'text-orange-400'
            : localVote === 'down'
              ? 'text-blue-400'
              : displayScore >= 0
                ? 'text-gray-500'
                : 'text-gray-600'
        }`}
      >
        {formatCount(displayScore)}
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleVote('down');
        }}
        className={`rounded p-1 transition-colors ${
          localVote === 'down'
            ? 'bg-blue-500/15 text-blue-400'
            : 'text-gray-600 hover:bg-blue-500/10 hover:text-blue-400'
        }`}
        aria-label="Downvote"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
          <path d="M9 16L2 4H16L9 16Z" />
        </svg>
      </button>
    </div>
  );
});
