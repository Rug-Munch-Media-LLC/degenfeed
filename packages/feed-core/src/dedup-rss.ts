// ─── RSS-origin dedup pass ──────────────────────────────────────────────
// Single responsibility: collapse the same article arriving from several feeds.
import type { UnifiedPost } from '@degenfeed/types';
import type { SeenSets } from './dedup-state';
import { markCrossPosted } from './dedup-state';
import { extractDomain } from './post-domain';
import { postTitle } from './post-title';

function rssKeyFor(post: UnifiedPost): string | null {
  const title = postTitle(post);
  const domain = extractDomain(post);
  if (!title || !domain) return null;
  return `rss:${domain}:${title.toLowerCase().slice(0, 80)}`;
}

export function isRssOriginDuplicate(p: UnifiedPost, seen: SeenSets, out: UnifiedPost[]): boolean {
  if (p.protocol !== 'rss') return false;
  const key = rssKeyFor(p);
  if (!key) return false;
  if (seen.rssOrigin.has(key)) {
    const existing = out.find((o) => rssKeyFor(o) === key);
    if (existing) {
      markCrossPosted(existing, p.protocol);
      // Keep the version with more content (likely the original).
      if ((p.text?.length ?? 0) > (existing.text?.length ?? 0)) {
        const idx = out.indexOf(existing);
        if (idx !== -1) out[idx] = p;
      }
    }
    return true;
  }
  seen.rssOrigin.add(key);
  return false;
}
