// ─── Content fingerprints ─────────────────────────────────────────────

import type { UnifiedPost } from '@degenfeed/types';
import { normalizeStripped, URL_RE } from './text-similarity';

export function embedFingerprint(post: UnifiedPost): string | null {
  if (post.text.trim().length > 20) return null;
  const media = post.embeds.filter((e) => e.kind === 'image' || e.kind === 'video');
  if (media.length === 0) return null;
  return `embed:${media
    .map((e) => e.url)
    .sort()
    .join('|')}`;
}

export function imageFingerprint(post: UnifiedPost): string | null {
  const images = post.embeds.filter((e) => e.kind === 'image');
  if (images.length === 0) return null;
  const normalized = images
    .map((e) => {
      try {
        const u = new URL(e.url.replace(/\/$/, ''));
        u.search = '';
        return `${u.hostname}${u.pathname}`;
      } catch {
        return e.url;
      }
    })
    .sort()
    .join('|');
  return `img:${normalized}`;
}

export function authorKey(post: UnifiedPost): string {
  const displayName = post.author.displayName.toLowerCase().trim();
  const id = post.author.id.toLowerCase();
  return `${id}|${displayName}`;
}

export function extractQuotedId(post: UnifiedPost): string | null {
  if (post.html && /<\s*blockquote/i.test(post.html)) {
    const urls = post.html.match(URL_RE);
    return urls ? `quoted:${urls.join(',')}` : null;
  }
  if (/\bRT\s+@/i.test(post.text) || /\bvia\s+@/i.test(post.text) || /^RT\b/i.test(post.text)) {
    const urls = post.text.match(URL_RE);
    if (urls && urls.length > 0) return `quoted:${urls.join(',')}`;
    const stripped = normalizeStripped(post.text).slice(0, 80);
    return stripped ? `quote:text:${stripped}` : null;
  }
  return null;
}

export function contentFingerprint(post: UnifiedPost): string {
  const words = normalizeStripped(post.text)
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 12);
  if (words.length > 0) return words.join(' ');
  const link = post.embeds.find(
    (e) => e.kind === 'link' || e.kind === 'image' || e.kind === 'video',
  );
  return link ? `link:${link.url}` : '';
}

export const JACCARD_THRESHOLD = 0.7;
export const MIN_TEXT_LENGTH = 20;
