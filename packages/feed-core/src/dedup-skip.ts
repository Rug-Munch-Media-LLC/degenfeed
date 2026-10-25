// ─── Exact-duplicate pass ───────────────────────────────────────────────
// Single responsibility: reject a post whose identity/content was already kept.
import type { UnifiedPost } from '@degenfeed/types';
import type { PostSignals, SeenSets } from './dedup-state';
import { markCrossPosted } from './dedup-state';
import { extractCanonicalUrl } from './url-identity';

export function isExactDuplicate(
  p: UnifiedPost,
  s: PostSignals,
  seen: SeenSets,
  out: UnifiedPost[],
): boolean {
  if (seen.id.has(p.id)) return true;
  if (s.fp && seen.fingerprint.has(s.fp)) return true;
  if (s.norm.length > 15 && seen.normalized.has(s.norm)) return true;
  if (s.purl && seen.url.has(s.purl)) return true;

  // Same article shared through different protocols: merge, don't duplicate.
  if (s.curl && seen.canonicalUrl.has(s.curl)) {
    const matched = out.find((o) => s.curl !== null && extractCanonicalUrl(o) === s.curl);
    if (matched) markCrossPosted(matched, p.protocol);
    return true;
  }

  if (s.prefix.length > 12 && seen.prefix.has(s.prefix)) return true;

  if (p.text.trim().length <= 80) {
    const exact = p.text.trim().toLowerCase();
    if (exact.length > 0 && seen.shortExact.has(exact)) return true;
    if (exact.length > 0) seen.shortExact.add(exact);
  }
  if (s.fp && seen.authorWindow.has(s.windowKey)) return true;
  if (s.qid && seen.quoted.has(s.qid)) return true;
  if (s.ts.length > 3 && seen.ticker.has(s.ts)) return true;
  if (s.eid && seen.embed.has(s.eid)) return true;
  if (s.imgFp && seen.imageFp.has(s.imgFp)) return true;
  if (s.phash && seen.perceptualHash.has(s.phash)) return true;
  return false;
}
