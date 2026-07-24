/**
 * @degenfeed/web — Bluesky Media View Helpers
 */

import type { UnifiedPost } from '@degenfeed/types';
import type { MediaItem } from './bluesky-media-types';

// ─── Time Formatting ─────────────────────────────────────────────

export function timeAgo(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ─── Media Extraction ───────────────────────────────────────────

export function extractMedia(post: UnifiedPost): MediaItem[] {
  const images = post.embeds
    .filter((e) => e.kind === 'image')
    .map((e) => ({
      url: e.url,
      thumb: (e.meta?.thumb as string) || undefined,
      alt: (e.meta?.alt as string) || '',
      width: e.meta?.width as number | undefined,
      height: e.meta?.height as number | undefined,
      aspectRatio: e.meta?.aspectRatio as number | undefined,
    }));

  if (images.length === 0) {
    const linkEmbeds = post.embeds.filter((e) => e.kind === 'link' && e.meta?.thumb);
    for (const e of linkEmbeds) {
      images.push({
        url: e.meta?.thumb as string,
        thumb: e.meta?.thumb as string | undefined,
        alt: (e.meta?.title as string) || 'Link preview',
        width: undefined,
        height: undefined,
        aspectRatio: 1.91,
      });
    }
  }

  return images;
}

export function isVideoPost(post: UnifiedPost): boolean {
  return (
    post.contentType === 'video' ||
    post.embeds.some(
      (e) =>
        e.kind === 'link' &&
        (e.meta?.thumb ||
          /youtube|youtu\.be|vimeo|twitch/i.test(e.url) ||
          /\.(mp4|webm|mov)$/i.test(e.url)),
    )
  );
}

export function getExternalUrl(post: UnifiedPost): string | null {
  const link = post.embeds.find((e) => e.kind === 'link' && e.url);
  return link?.url || null;
}
