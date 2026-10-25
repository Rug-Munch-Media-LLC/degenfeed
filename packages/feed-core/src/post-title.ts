// ─── Post title extraction ────────────────────────────────────────────

import type { UnifiedPost } from '@degenfeed/types';

export function postTitle(post: UnifiedPost): string | null {
  for (const embed of post.embeds) {
    const meta = embed.meta as unknown as Record<string, unknown> | undefined;
    if (meta?.title && typeof meta.title === 'string' && meta.title.length > 5) {
      return meta.title;
    }
  }
  if (post.protocol === 'rss') {
    const firstLine = post.text.trim().split('\n')[0]?.trim();
    if (firstLine && firstLine.length > 5 && firstLine.length < 200) return firstLine;
    const firstSentence = post.text.trim().split(/[.!?]/)[0]?.trim();
    if (firstSentence && firstSentence.length > 5 && firstSentence.length < 200)
      return firstSentence;
  }
  return null;
}

/**
 * Extract the domain from a post's primary URL.
 */
