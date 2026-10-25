// ─── Post enrichment ──────────────────────────────────────────────────

import type { UnifiedPost } from '@degenfeed/types';
import { detectNiches } from './relevance';

export function enrichPostNiches(post: UnifiedPost): UnifiedPost {
  const textParts = [post.text, post.html ?? '', post.author.displayName, post.author.bio];
  for (const e of post.embeds) {
    if (e.url) textParts.push(e.url);
    if (e.meta?.title) textParts.push(String(e.meta.title));
    if (e.meta?.description) textParts.push(String(e.meta.description));
  }
  const allText = textParts.join(' ');
  post.niches = [...new Set([...post.niches, ...detectNiches(allText)])];
  return post;
}

export function detectContentType(
  post: UnifiedPost,
): 'article' | 'video' | 'image' | 'thread' | 'link' | 'text' {
  const hasVideo = post.embeds.some((e) => e.kind === 'video');
  if (hasVideo) return 'video';
  const hasImage = post.embeds.some((e) => e.kind === 'image');
  if (hasImage) return 'image';
  const textLen = post.text.trim().length;
  if (textLen > 500 && post.embeds.length === 0) return 'article';
  if (post.embeds.some((e) => e.kind === 'link') && textLen < 100) return 'link';
  if (post.parentId && post.rootId) return 'thread';
  if (textLen > 200 && post.embeds.some((e) => e.kind === 'link')) return 'article';
  return 'text';
}
