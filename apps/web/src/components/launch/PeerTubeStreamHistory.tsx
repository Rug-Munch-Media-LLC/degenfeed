'use client';

import { useState, useEffect } from 'react';
import { usePeerTubeStream, type StreamHistoryItem } from '../../hooks/usePeerTubeStream';

/* ─── Types ──────────────────────────────────────────── */

interface PeerTubeStreamHistoryProps {
  tokenAddress: string;
  tokenSymbol?: string;
  limit?: number;
}

/* ─── Helpers ────────────────────────────────────────── */

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

/* ─── Main Component ────────────────────────────────── */

export default function PeerTubeStreamHistory({
  tokenAddress,
  tokenSymbol,
  limit = 10,
}: PeerTubeStreamHistoryProps) {
  const { fetchHistory } = usePeerTubeStream(tokenAddress, tokenSymbol);
  const [streams, setStreams] = useState<StreamHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!tokenSymbol) {
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchHistory(limit)
      .then((items) => {
        setStreams(items);
        setTotal(items.length);
      })
      .catch(() => {
        setStreams([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [tokenAddress, tokenSymbol, limit, fetchHistory]);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton h-20 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (streams.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--color-border)] px-4 py-8">
        <div className="text-3xl opacity-30">📼</div>
        <p className="mt-2 text-sm text-[var(--color-muted)]">No past streams yet</p>
        <p className="text-xs text-[var(--color-muted)]">
          Completed PeerTube streams appear here as VOD recordings
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--color-fg)]">
          📼 Past Streams
        </h3>
        {total > limit && (
          <span className="text-[10px] text-[var(--color-muted)]">
            Showing {streams.length} of {total}
          </span>
        )}
      </div>

      {streams.map((s) => (
        <a
          key={s.id}
          href={s.embedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-3 transition-colors hover:border-degen-500/30 hover:bg-degen-500/5"
        >
          {/* Thumbnail */}
          <div className="relative h-16 w-28 flex-shrink-0 overflow-hidden rounded-md bg-[var(--color-overlay)]">
            {s.thumbnailUrl ? (
              <img
                src={s.thumbnailUrl}
                alt={s.title}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xl opacity-30">
                📹
              </div>
            )}
            {s.duration > 0 && (
              <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 py-0.5 text-[10px] font-medium text-white">
                {formatDuration(s.duration)}
              </span>
            )}
          </div>

          {/* Info */}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[var(--color-fg)] group-hover:text-degen-400 transition-colors">
              {s.title}
            </p>
            <div className="mt-1 flex items-center gap-2 text-[10px] text-[var(--color-muted)]">
              <span>{formatDate(s.publishedAt)}</span>
              <span>·</span>
              <span>{s.views} views</span>
              <span>·</span>
              <span className="flex items-center gap-1">
                🌐 PeerTube
              </span>
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}
