'use client';

import { useCallback, useState } from 'react';

interface StreamFollowButtonProps {
  streamId: string;
  isFollowing?: boolean;
  onFollow?: (id: string) => void;
}

export function StreamFollowButton({
  streamId,
  isFollowing: initial = false,
  onFollow,
}: StreamFollowButtonProps) {
  const [following, setFollowing] = useState(initial);
  const [animating, setAnimating] = useState(false);

  const handleClick = useCallback(() => {
    setAnimating(true);
    const newState = !following;
    setFollowing(newState);
    onFollow?.(streamId);
    setTimeout(() => setAnimating(false), 300);
  }, [following, streamId, onFollow]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`relative inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-all active:scale-[0.97] ${
        following
          ? 'border border-white/20 bg-white/5 text-white/70 hover:border-red-500/30 hover:text-red-400'
          : 'bg-degen-500 text-black hover:bg-degen-400 hover:shadow-[0_0_16px_rgba(0,255,65,0.25)]'
      } ${animating ? 'scale-105' : ''}`}
      aria-label={following ? 'Unfollow' : 'Follow'}
    >
      {following ? (
        <>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
            <circle cx="8.5" cy="7" r="4" />
            <line x1="20" y1="8" x2="20" y2="14" />
            <line x1="23" y1="11" x2="17" y2="11" />
          </svg>
          Following
        </>
      ) : (
        <>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
            <circle cx="8.5" cy="7" r="4" />
            <line x1="20" y1="8" x2="20" y2="14" />
            <line x1="23" y1="11" x2="17" y2="11" />
          </svg>
          Follow
        </>
      )}
    </button>
  );
}
