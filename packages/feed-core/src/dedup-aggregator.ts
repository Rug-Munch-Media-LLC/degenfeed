// ─── Aggregator dedup pass ──────────────────────────────────────────────
// Single responsibility: prefer the original source over a Redlib/Lemmy mirror.
import type { UnifiedPost } from '@degenfeed/types';
import { isFromAggregator } from './cross-post';
import { markCrossPosted } from './dedup-state';
import { extractCanonicalUrl, normalizeUrlForDedup } from './url-identity';

export function isAggregatorDuplicate(p: UnifiedPost, out: UnifiedPost[]): boolean {
  if (!isFromAggregator(p)) return false;
  const curl = extractCanonicalUrl(p);
  if (!curl) return false;
  const normal = normalizeUrlForDedup(curl);
  for (const existing of out) {
    const existingUrl = extractCanonicalUrl(existing);
    if (existingUrl && normalizeUrlForDedup(existingUrl) === normal) {
      markCrossPosted(existing, p.protocol);
      return true;
    }
  }
  return false;
}
