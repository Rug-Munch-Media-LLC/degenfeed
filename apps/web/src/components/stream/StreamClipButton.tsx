'use client';

import { useCallback, useState } from 'react';

interface StreamClipButtonProps {
  streamId: string;
}

export function StreamClipButton(_props: StreamClipButtonProps) {
  const [creating, setCreating] = useState(false);
  const [done, setDone] = useState(false);

  const handleClip = useCallback(async () => {
    setCreating(true);
    // Simulate clip creation
    await new Promise((r) => setTimeout(r, 1200));
    setCreating(false);
    setDone(true);
    setTimeout(() => setDone(false), 3000);
  }, []);

  return (
    <button
      type="button"
      onClick={handleClip}
      disabled={creating}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all active:scale-[0.97] ${
        done
          ? 'bg-degen-500/20 text-degen-400'
          : 'border border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
      } disabled:opacity-50`}
      aria-label="Create clip"
      title="Create clip from last 30 seconds"
    >
      {creating ? (
        <>
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          Clipping...
        </>
      ) : done ? (
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
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Clipped!
        </>
      ) : (
        <>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polygon points="23 7 16 12 23 17 23 7" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </svg>
          Clip
        </>
      )}
    </button>
  );
}
