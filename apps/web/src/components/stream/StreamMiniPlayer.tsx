'use client';

import { useCallback, useState } from 'react';

interface StreamMiniPlayerProps {
  title: string;
  onClose: () => void;
  onExpand: () => void;
}

export function StreamMiniPlayer({ title, onClose, onExpand }: StreamMiniPlayerProps) {
  const [isMuted, setIsMuted] = useState(false);

  const toggleMute = useCallback(() => setIsMuted((v) => !v), []);

  return (
    <div className="fixed bottom-4 right-4 z-50 w-72 overflow-hidden rounded-xl border border-white/10 bg-black shadow-2xl transition-all animate-slide-up">
      {/* Video area */}
      <div className="relative aspect-video bg-gradient-to-br from-degen-500/20 to-purple-600/20">
        <button
          type="button"
          onClick={onExpand}
          aria-label="Expand mini player"
          className="absolute inset-0 w-full cursor-pointer"
        />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="white"
            opacity="0.4"
            aria-hidden="true"
          >
            <polygon points="6 3 20 12 6 21 6 3" />
          </svg>
        </div>

        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-1 top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white/60 transition-colors hover:bg-black/80 hover:text-white"
          aria-label="Close mini player"
        >
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
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between px-2 py-1.5 bg-gray-900">
        <p className="truncate text-[10px] font-medium text-white/70">{title}</p>
        <button
          type="button"
          onClick={toggleMute}
          className="flex h-6 w-6 items-center justify-center rounded text-white/50 hover:text-white"
          aria-label={isMuted ? 'Unmute' : 'Mute'}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {isMuted ? (
              <>
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </>
            ) : (
              <>
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M15.54 8.46a5 5 0 010 7.07" />
                <path d="M19.07 4.93a10 10 0 010 14.14" />
              </>
            )}
          </svg>
        </button>
      </div>
    </div>
  );
}
