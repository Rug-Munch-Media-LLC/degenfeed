'use client';

import { type Clip, generateMockClips } from './types';

interface StreamClipsProps {
  clips?: Clip[];
}

function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function _formatDate(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 86400000) return 'Today';
  if (diff < 86400000 * 2) return 'Yesterday';
  return `${Math.floor(diff / 86400000)}d ago`;
}

export function StreamClips({ clips }: StreamClipsProps) {
  const items = clips ?? generateMockClips();

  if (items.length === 0) return null;

  return (
    <section aria-label="Clips" className="space-y-3">
      <div className="flex items-center gap-2">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="text-white/50"
        >
          <polygon points="23 7 16 12 23 17 23 7" />
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
        </svg>
        <h3 className="text-sm font-semibold text-white/90">Clips</h3>
        <span className="text-[10px] text-white/30">{items.length} clips</span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((clip) => (
          <button
            key={clip.id}
            type="button"
            className="group relative aspect-video overflow-hidden rounded-xl bg-gradient-to-br from-gray-700 to-gray-800 transition-all hover:ring-2 hover:ring-degen-500/30"
          >
            {/* Play icon overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-degen-500/90 text-black shadow-lg">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <polygon points="6 3 20 12 6 21 6 3" />
                </svg>
              </div>
            </div>

            {/* Duration badge */}
            <div className="absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-medium text-white/80">
              {clip.duration}
            </div>

            {/* Info overlay at bottom */}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-6">
              <p className="truncate text-[10px] font-medium text-white/90">{clip.title}</p>
              <div className="mt-0.5 flex items-center gap-2 text-[8px] text-white/50">
                <span>{formatViews(clip.views)} views</span>
                <span>·</span>
                <span>@{clip.creatorHandle}</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
