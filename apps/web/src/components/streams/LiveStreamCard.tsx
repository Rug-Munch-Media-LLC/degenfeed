'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { LiveStream } from './useLiveStreams';

/* === Helpers ================================================== */

function formatViewers(n: number): string {
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatDuration(startedAt: number): string {
  const minutes = Math.floor((Date.now() - startedAt) / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

/* === Stream type config ======================================= */

const STREAM_TYPE_CONFIG: Record<
  string,
  { label: string; emoji: string; color: string; bgClass: string }
> = {
  solo: {
    label: 'Solo',
    emoji: '🎥',
    color: '#6366f1',
    bgClass: 'bg-indigo-500/15 text-indigo-400',
  },
  spaces: {
    label: 'Spaces',
    emoji: '🎙️',
    color: '#14b8a6',
    bgClass: 'bg-teal-500/15 text-teal-400',
  },
  collab: {
    label: 'Collab',
    emoji: '👥',
    color: '#f59e0b',
    bgClass: 'bg-amber-500/15 text-amber-400',
  },
  launch: {
    label: 'Launch',
    emoji: '🪙',
    color: '#ec4899',
    bgClass: 'bg-pink-500/15 text-pink-400',
  },
};

/* === Thumbnail placeholder by type ============================ */

function StreamThumbnail({ stream }: { stream: LiveStream }) {
  const config = STREAM_TYPE_CONFIG[stream.streamType] ?? STREAM_TYPE_CONFIG.solo;

  // Gradient backgrounds per type
  const gradients: Record<string, string> = {
    solo: 'from-indigo-600/40 via-purple-600/20 to-indigo-800/40',
    spaces: 'from-teal-600/40 via-emerald-600/20 to-teal-800/40',
    collab: 'from-amber-600/40 via-orange-600/20 to-amber-800/40',
    launch: 'from-pink-600/40 via-rose-600/20 to-fuchsia-800/40',
  };

  return (
    <div
      className={`relative aspect-video w-full overflow-hidden bg-gradient-to-br ${gradients[stream.streamType] ?? gradients.solo}`}
    >
      {/* Noise texture overlay */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Stream type icon */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-4xl opacity-40" aria-hidden="true">
          {config.emoji}
        </span>
      </div>

      {/* LIVE badge */}
      <div className="absolute left-2 top-2 z-10 flex items-center gap-1.5 rounded-md bg-red-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-lg">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
        </span>
        LIVE
      </div>

      {/* Duration */}
      <div className="absolute bottom-2 right-2 z-10 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-sm">
        {formatDuration(stream.startedAt)}
      </div>

      {/* Type badge */}
      <div
        className={`absolute right-2 top-2 z-10 rounded-md px-1.5 py-0.5 text-[9px] font-semibold ${config.bgClass} backdrop-blur-sm`}
      >
        {config.emoji} {config.label}
      </div>
    </div>
  );
}

/* === Mini bonding curve bar =================================== */

function BondingCurveBar({ progress }: { progress: number }) {
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-[var(--color-muted)]">Bonding curve</span>
        <span className="font-semibold text-degen-400">{progress}%</span>
      </div>
      <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-[var(--color-overlay)]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-degen-500 to-emerald-400 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

/* === Main Card ================================================ */

interface LiveStreamCardProps {
  stream: LiveStream;
  featured?: boolean;
  onPlay?: (stream: LiveStream) => void;
}

export function LiveStreamCard({ stream, featured = false, onPlay }: LiveStreamCardProps) {
  return (
    <article
      className={`group relative overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] transition-all hover:border-degen-500/30 hover:shadow-[0_0_24px_var(--color-accent-glow)] ${
        featured ? 'ring-1 ring-degen-500/20' : ''
      }`}
    >
      {/* Thumbnail / thumbnail area */}
      <Link
        href={`/live/${stream.id}`}
        className="block"
        onClick={(e) => {
          if (onPlay) {
            e.preventDefault();
            onPlay(stream);
          }
        }}
      >
        {stream.thumbnailUrl ? (
          <div className="relative aspect-video w-full overflow-hidden">
            <Image
              src={stream.thumbnailUrl}
              alt={`${stream.title} thumbnail`}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
            {/* Gradient overlay for text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          </div>
        ) : (
          <StreamThumbnail stream={stream} />
        )}
      </Link>

      {/* Info section */}
      <div className="p-3">
        {/* Title */}
        <Link
          href={`/live/${stream.id}`}
          className="block"
          onClick={(e) => {
            if (onPlay) {
              e.preventDefault();
              onPlay(stream);
            }
          }}
        >
          <h3 className="truncate text-sm font-semibold text-[var(--color-fg)] transition-colors group-hover:text-degen-400">
            {stream.title}
          </h3>
        </Link>

        {/* Creator row */}
        <div className="mt-1.5 flex items-center gap-2">
          <div className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-degen-500/30 to-purple-500/30 text-[8px] font-bold text-degen-400">
            {stream.creatorAvatar ? (
              <Image
                src={stream.creatorAvatar}
                alt={stream.creatorHandle}
                width={20}
                height={20}
                className="h-5 w-5 rounded-full object-cover"
              />
            ) : (
              stream.creatorHandle[0]?.toUpperCase() || '?'
            )}
          </div>
          <span className="truncate text-xs text-[var(--color-muted)]">
            @{stream.creatorHandle}
          </span>

          {/* Viewer count */}
          <span className="ml-auto flex shrink-0 items-center gap-1 text-[10px] tabular-nums text-[var(--color-muted)]">
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
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            {formatViewers(stream.viewerCount)}
          </span>
        </div>

        {/* Bonding curve for launches */}
        {stream.streamType === 'launch' && stream.bondingCurveProgress !== undefined && (
          <BondingCurveBar progress={stream.bondingCurveProgress} />
        )}

        {/* Tags */}
        {stream.tags && stream.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {stream.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-[var(--color-overlay)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--color-muted)]"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
