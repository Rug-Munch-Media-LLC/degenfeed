'use client';

/**
 * @degenfeed/web — VideoPlayer
 *
 * Universal embedded player wrapper that handles YouTube, PeerTube,
 * and direct video sources. Provides controls overlay, quality info,
 * and fullscreen support.
 */

import { useCallback, useRef, useState } from 'react';
import { VideoSourceBadge } from './VideoSourceBadge';

interface VideoPlayerProps {
  title: string;
  embedUrl?: string;
  videoUrl: string;
  source: 'youtube' | 'peertube' | 'shorts' | 'livestream';
  poster?: string;
  autoplay?: boolean;
  onError?: () => void;
  className?: string;
}

export function VideoPlayer({
  title,
  embedUrl,
  videoUrl,
  source,
  poster,
  autoplay = true,
  onError,
  className = '',
}: VideoPlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loadError, setLoadError] = useState(false);

  const getEmbedSrc = useCallback(() => {
    if (embedUrl) return embedUrl;

    // Build embed URLs from video URLs if embed URL not provided
    if (source === 'youtube') {
      const match = videoUrl.match(
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/,
      );
      if (match) {
        return `https://www.youtube.com/embed/${match[1]}?autoplay=${autoplay ? '1' : '0'}&rel=0`;
      }
    }
    if (source === 'peertube') {
      const match = videoUrl.match(/\/w\/([a-zA-Z0-9-]+)/);
      if (match) {
        const instance = new URL(videoUrl).hostname;
        return `https://${instance}/videos/embed/${match[1]}?autoplay=${autoplay ? '1' : '0'}`;
      }
    }
    return videoUrl;
  }, [embedUrl, videoUrl, source, autoplay]);

  const handleError = useCallback(() => {
    setLoadError(true);
    onError?.();
  }, [onError]);

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
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <p className="text-sm text-[var(--color-muted)]">Could not load video</p>
          <a
            href={videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-xs text-degen-500 hover:text-degen-400"
          >
            Open in{' '}
            {source === 'youtube' ? 'YouTube' : source === 'peertube' ? 'PeerTube' : 'new tab'}{' '}
            &rarr;
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative aspect-video overflow-hidden rounded-xl bg-black ${className}`}>
      {/* Source badge */}
      <div className="absolute left-3 top-3 z-10">
        <VideoSourceBadge source={source} size="md" />
      </div>

      {/* Embedded iframe */}
      <iframe
        ref={iframeRef}
        src={getEmbedSrc()}
        title={title}
        className="h-full w-full"
        allow={`autoplay${source === 'youtube' ? '; encrypted-media' : ''}; fullscreen; picture-in-picture`}
        allowFullScreen
        onError={handleError}
        sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
        loading="lazy"
      />

      {/* Fallback link if iframe doesn't load */}
      <a
        href={videoUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-3 right-3 z-10 rounded-lg bg-black/60 px-3 py-1.5 text-[11px] font-medium text-white/80 backdrop-blur-sm hover:bg-black/80 hover:text-white transition-colors"
      >
        Open original
      </a>
    </div>
  );
}
