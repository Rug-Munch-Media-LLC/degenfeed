'use client';

/**
 * @degenfeed/ui — PeerTubeEmbed
 *
 * Embeds PeerTube videos with the native PeerTube player.
 * Shows title, channel name, views, likes, and a "Watch on" link.
 * Responsive 16:9 aspect ratio. Placeholder thumbnail before play.
 *
 * Design: dark video card with overlay play button, federated video metadata.
 * Tonal reference: PeerTube's own player — functional, federated-first.
 */

import { memo, useCallback, useState } from 'react';

// ─── Types ───────────────────────────────────────────────────────────

export interface PeerTubeEmbedProps {
  /** Direct video URL or PeerTube watch URL */
  url: string;
  title?: string;
  channelName?: string;
  /** Views count */
  views?: number;
  /** Likes count */
  likes?: number;
  /** Thumbnail image URL */
  thumbnail?: string;
  /** Instance domain (e.g. "video.degenfeed.xyz") */
  instanceDomain?: string;
  /** UUID of the video on the instance */
  uuid?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────

function formatCount(n?: number): string {
  if (n == null) return '';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function extractInstanceFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^https?:\/\//, '');
  } catch {
    return 'video.degenfeed.xyz';
  }
}

function extractUuidFromUrl(url: string): string | undefined {
  // PeerTube watch URLs: /w/{uuid} or /videos/watch/{uuid}
  const watchMatch = url.match(/\/w\/([a-zA-Z0-9-]+)/);
  if (watchMatch?.[1]) return watchMatch[1];
  const legacyMatch = url.match(/\/videos\/watch\/([a-zA-Z0-9-]+)/);
  if (legacyMatch?.[1]) return legacyMatch[1];
  return undefined;
}

function buildEmbedUrl(url: string): string {
  const uuid = extractUuidFromUrl(url);
  const instance = extractInstanceFromUrl(url);
  if (uuid) {
    return `https://${instance}/videos/embed/${uuid}`;
  }
  return url;
}

// ─── Component ───────────────────────────────────────────────────────

export const PeerTubeEmbed = memo(function PeerTubeEmbed({
  url,
  title,
  channelName,
  views,
  likes,
  thumbnail,
  instanceDomain: externalDomain,
  uuid: externalUuid,
}: PeerTubeEmbedProps) {
  const [playing, setPlaying] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const instanceDomain = externalDomain ?? extractInstanceFromUrl(url);
  const uuid = externalUuid ?? extractUuidFromUrl(url);
  const embedUrl = buildEmbedUrl(url);

  const handlePlay = useCallback(() => {
    setPlaying(true);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handlePlay();
      }
    },
    [handlePlay],
  );

  // Derive thumbnail from embed URL as fallback
  const thumbnailUrl =
    thumbnail ?? (uuid ? `https://${instanceDomain}/static/thumbnails/${uuid}.jpg` : undefined);

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)]">
      {/* ── Video player area (16:9) ── */}
      <div className="relative aspect-video w-full overflow-hidden bg-[var(--color-card)]">
        {!playing ? (
          <>
            {/* Thumbnail */}
            {thumbnailUrl && !loadError ? (
              <img
                src={thumbnailUrl}
                alt={title ? `Thumbnail for ${title}` : 'Video thumbnail'}
                className="h-full w-full object-cover"
                onError={() => setLoadError(true)}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[var(--color-muted)]">
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                  className="text-gray-700"
                >
                  <rect
                    x="4"
                    y="4"
                    width="16"
                    height="16"
                    rx="3"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                  <path d="M10 9L16 12L10 15V9Z" fill="currentColor" />
                </svg>
              </div>
            )}

            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

            {/* Play button */}
            <div className="absolute inset-0 flex items-center justify-center">
              <button
                type="button"
                onClick={handlePlay}
                onKeyDown={handleKeyDown}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 text-[var(--color-fg)] backdrop-blur-sm transition-all hover:scale-110 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50"
                aria-label={title ? `Play ${title}` : 'Play video'}
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M8 5V19L19 12L8 5Z" />
                </svg>
              </button>
            </div>

            {/* Title overlay at bottom */}
            {title && (
              <div className="absolute bottom-0 left-0 right-0 px-4 pb-3">
                <p className="text-sm font-semibold text-[var(--color-fg)] drop-shadow-lg line-clamp-2">
                  {title}
                </p>
              </div>
            )}
          </>
        ) : (
          <iframe
            src={`${embedUrl}?autoplay=1&title=0&warningTitle=0`}
            className="h-full w-full"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
            title={title ?? 'PeerTube video'}
            loading="lazy"
          />
        )}
      </div>

      {/* ── Metadata row ── */}
      <div className="px-4 py-3">
        {title && !playing && (
          <p className="mb-2 text-sm font-semibold text-gray-200 line-clamp-1">{title}</p>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
          {channelName && (
            <span className="inline-flex items-center gap-1">
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="currentColor"
                aria-hidden="true"
                className="text-gray-600"
              >
                <rect x="1" y="3" width="10" height="6" rx="1.5" />
                <circle cx="6" cy="6" r="1.5" fill="#030712" />
              </svg>
              {channelName}
            </span>
          )}
          {views != null && <span className="tabular-nums">{formatCount(views)} views</span>}
          {likes != null && (
            <span className="inline-flex items-center gap-1 tabular-nums">
              <svg
                width="10"
                height="10"
                viewBox="0 0 10 10"
                fill="currentColor"
                aria-hidden="true"
                className="text-gray-600"
              >
                <path d="M5 1L9 8H1L5 1Z" />
              </svg>
              {formatCount(likes)}
            </span>
          )}

          {/* Federated instance badge */}
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-purple-900/20 px-2 py-0.5 text-[10px] text-purple-400">
            <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" aria-hidden="true">
              <circle cx="4" cy="4" r="3" />
            </svg>
            Fediverse
          </span>
        </div>
      </div>

      {/* ── "Watch on" link ── */}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center border-t border-[var(--color-border)] px-4 py-2 text-xs text-degen-500 transition-colors hover:bg-[var(--color-muted)] hover:text-degen-400"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          className="mr-1"
          aria-hidden="true"
        >
          <path
            d="M5 2H2V10H10V7M6 6L10 2M10 2H7M10 2V5"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Watch on {instanceDomain}
      </a>
    </div>
  );
});
