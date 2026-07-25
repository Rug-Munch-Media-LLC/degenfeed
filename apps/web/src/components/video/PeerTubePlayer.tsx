'use client';

/**
 * @degenfeed/web — PeerTubePlayer
 *
 * Embed the PeerTube player with custom controls overlay.
 * Supports both regular videos and live streams.
 * Features:
 *   - PeerTube iframe embed with autoplay
 *   - Theater mode toggle
 *   - Live indicator badge
 *   - Related videos sidebar
 *   - Chat embed for live streams
 */

import { useCallback, useRef, useState } from 'react';
import { VideoSourceBadge } from './VideoSourceBadge';

interface PeerTubePlayerProps {
  /** Video UUID or shortUUID. */
  videoId: string;
  /** Video title for SEO/a11y. */
  title: string;
  /** Instance URL. Defaults to https://video.degenfeed.xyz */
  instanceUrl?: string;
  /** Is this a live stream? */
  isLive?: boolean;
  /** Autoplay on mount. */
  autoplay?: boolean;
  /** Start time in seconds. */
  startAt?: number;
  /** Show related videos sidebar. */
  showRelated?: boolean;
  /** Related videos list. */
  relatedVideos?: Array<{
    id: string;
    title: string;
    thumbnailUrl: string | null;
    duration: number;
    channel: string;
    views: number;
  }>;
  /** Callback when video ends. */
  onEnded?: () => void;
  /** Additional class names. */
  className?: string;
}

export function PeerTubePlayer({
  videoId,
  title,
  instanceUrl = 'https://video.degenfeed.xyz',
  isLive = false,
  autoplay = true,
  startAt,
  showRelated = false,
  relatedVideos = [],
  onEnded,
  className = '',
}: PeerTubePlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [theaterMode, setTheaterMode] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const instance = instanceUrl.replace(/\/$/, '');
  const embedBase = `${instance}/videos/embed`;
  const embedSrc = `${embedBase}/${videoId}?autoplay=${autoplay ? '1' : '0'}${startAt ? `&start=${startAt}` : ''}&controls=1&title=0&warningTitles=0`;

  const handleError = useCallback(() => {
    setLoadError(true);
    onEnded?.();
  }, [onEnded]);

  const toggleTheaterMode = useCallback(() => {
    setTheaterMode((prev) => !prev);
  }, []);

  if (loadError) {
    return (
      <div
        className={`flex aspect-video items-center justify-center rounded-xl bg-[var(--color-card)] ${className}`}
      >
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-red-400"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <p className="text-sm font-medium text-[var(--color-muted)]">Failed to load video</p>
          <p className="mt-1 text-xs text-[var(--color-muted)]/60">
            The video may have been removed or the instance is unreachable
          </p>
          <button
            type="button"
            onClick={() => window.open(`${instance}/videos/watch/${videoId}`, '_blank')}
            className="mt-3 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90"
          >
            Open on PeerTube
          </button>
        </div>
      </div>
    );
  }

  const playerElement = (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
      {/* Live badge */}
      {isLive && (
        <div className="absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-lg">
          <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
          LIVE
        </div>
      )}

      {/* Source badge */}
      <div className="absolute right-3 top-3 z-10">
        <VideoSourceBadge source="peertube" />
      </div>

      {/* PeerTube iframe embed */}
      <iframe
        ref={iframeRef}
        src={embedSrc}
        title={title}
        className="h-full w-full"
        allowFullScreen
        allow="autoplay; encrypted-media; fullscreen"
        sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
        onError={handleError}
        loading="lazy"
        style={{ border: 0 }}
      />
    </div>
  );

  const controlsElement = (
    <div className="mt-2 flex items-center gap-2">
      {/* Theater mode toggle */}
      <button
        type="button"
        onClick={toggleTheaterMode}
        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors ${
          theaterMode
            ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
            : 'bg-[var(--color-card)] text-[var(--color-muted)] hover:text-[var(--color-fg)]'
        }`}
        title={theaterMode ? 'Exit theater mode' : 'Theater mode'}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          {theaterMode ? (
            <>
              <polyline points="4 14 10 14 10 20" />
              <polyline points="20 10 14 10 14 4" />
              <line x1="14" y1="10" x2="21" y2="3" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </>
          ) : (
            <>
              <polyline points="4 14 10 14 10 20" />
              <polyline points="20 10 14 10 14 4" />
              <line x1="14" y1="10" x2="21" y2="3" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </>
          )}
        </svg>
        {theaterMode ? 'Exit Theater' : 'Theater'}
      </button>

      {/* Open in PeerTube */}
      <a
        href={`${instance}/videos/watch/${videoId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 rounded-lg bg-[var(--color-card)] px-3 py-1.5 text-[11px] font-medium text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
        Open
      </a>
    </div>
  );

  const relatedElement = showRelated && relatedVideos.length > 0 && (
    <div className="mt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--color-fg)]">Related Videos</h3>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-[11px] text-[var(--color-accent)] hover:underline"
        >
          {expanded ? 'Show less' : `Show all (${relatedVideos.length})`}
        </button>
      </div>
      <div className={`mt-2 space-y-2 ${expanded ? '' : 'max-h-80 overflow-hidden'}`}>
        {relatedVideos.slice(0, expanded ? relatedVideos.length : 5).map((video) => (
          <a
            key={video.id}
            href={`/video/peertube?id=${video.id}`}
            className="group flex gap-3 rounded-lg p-2 transition-colors hover:bg-[var(--color-card)]"
          >
            <div className="relative aspect-video w-40 flex-shrink-0 overflow-hidden rounded-lg bg-[var(--color-card)]">
              {video.thumbnailUrl ? (
                <img
                  src={video.thumbnailUrl}
                  alt={video.title}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-[var(--color-muted)]">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polygon points="23 7 16 12 23 17 23 7" />
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                  </svg>
                </div>
              )}
              {video.duration > 0 && (
                <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-medium text-white">
                  {Math.floor(video.duration / 60)}:{String(video.duration % 60).padStart(2, '0')}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-xs font-medium text-[var(--color-fg)] group-hover:text-[var(--color-accent)] transition-colors">
                {video.title}
              </p>
              <p className="mt-1 text-[11px] text-[var(--color-muted)]">{video.channel}</p>
              {video.views > 0 && (
                <p className="text-[11px] text-[var(--color-muted)]">
                  {video.views.toLocaleString()} views
                </p>
              )}
            </div>
          </a>
        ))}
      </div>
    </div>
  );

  return (
    <div
      className={`${className} ${theaterMode ? 'fixed inset-0 z-50 flex flex-col bg-black' : ''}`}
    >
      {/* Close button for theater mode */}
      {theaterMode && (
        <div className="flex items-center justify-between px-4 py-2">
          <h2 className="truncate text-sm font-medium text-white">{title}</h2>
          <button
            type="button"
            onClick={toggleTheaterMode}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      <div className={theaterMode ? 'flex-1' : ''}>
        {/* Player */}
        {playerElement}
        {!theaterMode && controlsElement}

        {/* Description */}
        <div className="mt-3">
          <h1 className="text-lg font-semibold text-[var(--color-fg)]">{title}</h1>
        </div>
      </div>

      {/* Related videos */}
      {!theaterMode && relatedElement}
    </div>
  );
}
