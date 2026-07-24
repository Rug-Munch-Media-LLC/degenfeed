'use client';

import { useEffect, useState } from 'react';
import { useIsMobile } from '../../hooks/useMobileResponsive';
import { type StreamHistoryItem, usePeerTubeStream } from '../../hooks/usePeerTubeStream';

/* === Types ============================================ */

interface PeerTubeStreamHistoryProps {
  tokenAddress: string;
  tokenSymbol?: string;
  limit?: number;
}

/* === Helpers ========================================== */

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

/* === Main Component ================================== */

export default function PeerTubeStreamHistory({
  tokenAddress,
  tokenSymbol,
  limit = 10,
}: PeerTubeStreamHistoryProps) {
  const isMobile = useIsMobile();
  const { fetchHistory } = usePeerTubeStream(tokenAddress, tokenSymbol);
  const [streams, setStreams] = useState<StreamHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!tokenSymbol) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetchHistory(limit)
      .then((items) => {
        setStreams(items);
        setTotal(items.length);
      })
      .catch((err) => {
        setStreams([]);
        setError(err instanceof Error ? err.message : 'Failed to load streams');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [tokenSymbol, limit, fetchHistory]);

  // Loading skeleton — mobile friendly
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: isMobile ? 2 : 3 }).map((_, i) => (
          <div key={i} className="skeleton h-16 sm:h-20 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-center">
        <p className="text-xs text-red-400">{error}</p>
      </div>
    );
  }

  // Empty state — mobile friendly
  if (streams.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--color-border)] px-4 py-6 sm:py-8">
        <div className="text-2xl sm:text-3xl opacity-30">📼</div>
        <p className="mt-2 text-xs sm:text-sm text-[var(--color-muted)]">No past streams yet</p>
        <p className="text-[10px] sm:text-xs text-[var(--color-muted)]">
          Completed PeerTube streams appear here as VOD recordings
        </p>
      </div>
    );
  }

  const responsiveLimit = isMobile ? Math.min(limit, 5) : limit;
  const displayStreams = streams.slice(0, responsiveLimit);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--color-fg)]">📼 Past Streams</h3>
        {total > responsiveLimit && (
          <span className="text-[10px] text-[var(--color-muted)]">
            Showing {displayStreams.length} of {total}
          </span>
        )}
      </div>

      {displayStreams.map((s) => (
        <a
          key={s.id}
          href={s.embedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-2.5 sm:p-3 transition-colors hover:border-degen-500/30 hover:bg-degen-500/5"
          style={{ minHeight: 48 }}
        >
          {/* Thumbnail */}
          <div className="relative h-14 w-24 sm:h-16 sm:w-28 flex-shrink-0 overflow-hidden rounded-md bg-[var(--color-overlay)]">
            {s.thumbnailUrl ? (
              <img
                src={s.thumbnailUrl}
                alt={s.title}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-lg sm:text-xl opacity-30">
                📹
              </div>
            )}
            {s.duration > 0 && (
              <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 py-0.5 text-[9px] sm:text-[10px] font-medium text-white">
                {formatDuration(s.duration)}
              </span>
            )}
          </div>

          {/* Info */}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs sm:text-sm font-medium text-[var(--color-fg)] group-hover:text-degen-400 transition-colors">
              {s.title}
            </p>
            <div className="mt-0.5 sm:mt-1 flex flex-wrap items-center gap-1 text-[9px] sm:text-[10px] text-[var(--color-muted)]">
              <span>{formatDate(s.publishedAt)}</span>
              <span>·</span>
              <span>{s.views} views</span>
              <span>·</span>
              <span className="flex items-center gap-1">🌐 PeerTube</span>
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}
