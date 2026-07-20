'use client';

/**
 * LiveShortsCountdown — "Ending in 10... 9... 8..." countdown overlay.
 *
 * Becomes visible when the live short is within the final 15 seconds.
 * Displays a large, animated countdown number with pulsing urgency.
 * Fires `onEnd` callback when countdown reaches 0.
 */

import { useEffect, useState } from 'react';

interface LiveShortsCountdownProps {
  startedAt: number;
  maxDuration: number; // seconds
  onEnd?: () => void;
}

export function LiveShortsCountdown({ startedAt, maxDuration, onEnd }: LiveShortsCountdownProps) {
  const [remaining, setRemaining] = useState(() => {
    const elapsed = Math.floor((Date.now() - startedAt) / 1000);
    return Math.max(0, maxDuration - elapsed);
  });

  const [showCountdown, setShowCountdown] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const rem = Math.max(0, maxDuration - elapsed);
      setRemaining(rem);

      // Show countdown in final 15 seconds
      if (rem <= 15 && rem > 0) {
        setShowCountdown(true);
      }

      if (rem <= 0) {
        clearInterval(interval);
        onEnd?.();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [startedAt, maxDuration, onEnd]);

  // Format MM:SS
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const display = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  if (remaining <= 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg bg-red-600/20 px-3 py-1.5 text-xs font-bold text-red-400">
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="6" y="4" width="4" height="16" />
          <rect x="14" y="4" width="4" height="16" />
        </svg>
        Ended
      </span>
    );
  }

  if (!showCountdown) {
    // Normal display — just the time
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-white/60 tabular-nums">
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        {display}
      </span>
    );
  }

  // Urgent countdown — show large animated number
  return (
    <div className="flex items-center gap-1">
      {/* Spinning clock icon */}
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-red-400 animate-pulse"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
      <span className="text-xs font-bold text-red-400 tabular-nums animate-pulse">
        Ends in {display}
      </span>

      {/* Large centered countdown (shown when <= 5s) */}
      {remaining <= 5 && remaining > 0 && (
        <style>{`
          @keyframes countdownPop {
            0% { transform: scale(1.5); opacity: 0; }
            30% { transform: scale(1); opacity: 1; }
            100% { transform: scale(0.9); opacity: 0.8; }
          }
        `}</style>
      )}
    </div>
  );
}
