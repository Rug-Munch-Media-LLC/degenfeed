'use client';

/**
 * @degenfeed/ui — PeerTubeEmbed
 *
 * Enhanced PeerTube video embed — fetches video details from the PeerTube
 * instance API and renders the native VideoPlayer with the direct .mp4 URL
 * instead of a third-party iframe embed.
 *
 * Falls back to iframe embed if API fetch fails (e.g. blocked by CORS).
 *
 * Shows title, channel name, views, likes, and a "Watch on" link.
 * Design: dark video card with neon-green accents, federated metadata.
 */

import { fetchPeerTubeVideo, parsePeerTubeUrl } from '@degenfeed/utils';
import { memo, useEffect, useState } from 'react';
import { VideoPlayer } from './VideoPlayer';

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
    return new URL(url).hostname;
  } catch {
    return 'video.degenfeed.xyz';
  }
}

// ─── Component ───────────────────────────────────────────────────────

export const PeerTubeEmbed = memo(function PeerTubeEmbed({
  url,
  title: propTitle,
  channelName: propChannelName,
  views: propViews,
  likes: propLikes,
  thumbnail: propThumbnail,
  instanceDomain: externalDomain,
  uuid: externalUuid,
}: PeerTubeEmbedProps) {
  const instanceDomain = externalDomain ?? extractInstanceFromUrl(url);
  const uuid = externalUuid ?? parsePeerTubeUrl(url)?.uuid;

  // ── PeerTube API state ──
  const [videoData, setVideoData] = useState<{
    directUrl: string;
    name: string;
    channel: string;
    views: number;
    likes: number;
    thumbnail: string;
  } | null>(null);
  const [apiError, setApiError] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!instanceDomain || !uuid) {
      setFetching(false);
      setApiError(true);
      return;
    }

    let cancelled = false;
    setFetching(true);
    setApiError(false);

    fetchPeerTubeVideo(instanceDomain, uuid)
      .then((data) => {
        if (cancelled) return;
        if (data && data.files.length > 0) {
          // Pick the highest quality file (last in the sorted array is highest res)
          const files = data.files;
          const bestFile = files[files.length - 1]?.fileUrl ?? files[0]?.fileUrl;
          setVideoData({
            directUrl: bestFile ?? url,
            name: data.name,
            channel: data.channel.displayName,
            views: data.views,
            likes: data.likes,
            thumbnail: data.thumbnailPath,
          });
        } else {
          // No files returned — fallback
          setApiError(true);
        }
      })
      .catch(() => {
        if (!cancelled) setApiError(true);
      })
      .finally(() => {
        if (!cancelled) setFetching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [instanceDomain, uuid, url]);

  // ── Derived values ──
  const displayTitle = videoData?.name ?? propTitle ?? 'Video';
  const displayChannel = videoData?.channel ?? propChannelName;
  const displayViews = videoData?.views ?? propViews;
  const displayLikes = videoData?.likes ?? propLikes;
  const thumbnailUrl = videoData?.thumbnail ?? propThumbnail;

  // ── Build embed URL for iframe fallback ──
  const embedUrl = uuid ? `https://${instanceDomain}/videos/embed/${uuid}` : url;

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)]">
      {/* ── Video player area ── */}
      {!apiError && videoData?.directUrl ? (
        <VideoPlayer
          src={videoData.directUrl}
          poster={thumbnailUrl}
          title={displayTitle}
          platform="direct"
          aspectRatio="16:9"
          showMetadata={false}
          channelName={displayChannel}
          views={displayViews}
          likes={displayLikes}
        />
      ) : apiError && uuid ? (
        /* ── Fallback: Iframe embed ── */
        <div className="relative aspect-video w-full overflow-hidden bg-[var(--color-card)]">
          <iframe
            src={`${embedUrl}?autoplay=0&title=0&warningTitle=0`}
            className="h-full w-full"
            allow="fullscreen; picture-in-picture"
            allowFullScreen
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
            title={displayTitle}
            loading="lazy"
          />
        </div>
      ) : fetching ? (
        /* ── Loading skeleton ── */
        <div className="aspect-video w-full bg-[var(--color-card)] flex items-center justify-center">
          <div
            className="h-8 w-8 rounded-full border-2 border-white/10 border-t-degen-400 animate-spin"
            role="status"
            aria-label="Loading video"
          />
        </div>
      ) : (
        /* ── Error state ── */
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex aspect-video w-full items-center justify-center bg-[var(--color-muted)] text-gray-500 hover:text-degen-400 transition-colors"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <div className="text-center">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              className="mx-auto mb-2"
              aria-hidden="true"
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
            <p className="text-xs">Watch on PeerTube</p>
          </div>
        </a>
      )}

      {/* ── Metadata row ── */}
      <div className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
          {displayChannel && (
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
              {displayChannel}
            </span>
          )}
          {displayViews != null && (
            <span className="tabular-nums">{formatCount(displayViews)} views</span>
          )}
          {displayLikes != null && (
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
              {formatCount(displayLikes)}
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
