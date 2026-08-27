'use client';



interface StreamVODsProps {
  vods?: VOD[];
}

function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 86400000) return 'Today';
  if (diff < 86400000 * 2) return 'Yesterday';
  if (diff < 86400000 * 7) return `${Math.floor(diff / 86400000)} days ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function StreamVODs({ vods }: StreamVODsProps) {
  const items = vods ?? [];

  if (items.length === 0) return null;

  return (
    <section aria-label="Past broadcasts" className="space-y-3">
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
        <h3 className="text-sm font-semibold text-white/90">Past Broadcasts</h3>
        <span className="text-[10px] text-white/30">{items.length} VODs</span>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {items.map((vod) => (
          <button
            key={vod.id}
            type="button"
            className="group flex gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-left transition-all hover:border-degen-500/20 hover:bg-white/10"
          >
            {/* Thumbnail placeholder */}
            <div className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-gray-700 to-gray-800">
              <div className="absolute inset-0 flex items-center justify-center">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="white"
                  opacity="0.3"
                  aria-hidden="true"
                >
                  <polygon points="6 3 20 12 6 21 6 3" />
                </svg>
              </div>
              <div className="absolute bottom-1 right-1 rounded bg-black/70 px-1 py-0.5 text-[8px] font-medium text-white/80">
                {vod.duration}
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-white/80 group-hover:text-white">
                {vod.title}
              </p>
              <p className="mt-0.5 text-[10px] text-white/40">{formatViews(vod.views)} views</p>
              <p className="text-[10px] text-white/30">{formatDate(vod.createdAt)}</p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
