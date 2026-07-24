import type { ScoredRssPost } from './types';

/**
 * Title/text similarity using Jaccard index on normalized word sets.
 */
function jaccardTitleSimilarity(a: string, b: string): number {
  const normA = a
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean);
  const normB = b
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean);
  const setA = new Set(normA);
  const setB = new Set(normB);
  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

/**
 * Deduplicate RSS posts with tier-aware strategy:
 * - Same URL → keep highest-tier source
 * - Same title (Jaccard > 0.7) → keep highest-tier source
 * - Similar content (>70% Jaccard on full text) → keep earliest published
 */
export function deduplicateRssPosts(scored: ScoredRssPost[]): ScoredRssPost[] {
  // Sort by tier (best first) AND createdAt (earliest first for content dedup)
  const byTier = [...scored].sort(
    (a, b) => a.config.tier - b.config.tier || a.post.createdAt - b.post.createdAt,
  );

  const seenUrls = new Set<string>();
  const seenTitleFingerprints: { fingerprint: string; index: number }[] = [];
  const seenContent: { words: Set<string>; index: number }[] = [];
  const result: ScoredRssPost[] = [];

  for (const entry of byTier) {
    const p = entry.post;

    // ── URL dedup ──
    const url = p.embeds.find((e) => e.kind === 'link')?.url;
    if (url) {
      const normUrl = url.toLowerCase().replace(/\/+$/, '');
      if (seenUrls.has(normUrl)) continue;
      seenUrls.add(normUrl);
    }

    // ── Title Jaccard dedup (threshold: 0.7) ──
    const titleText = p.text.slice(0, 120).toLowerCase().trim();
    if (titleText.length > 15) {
      let dup = false;
      for (const existing of seenTitleFingerprints) {
        if (jaccardTitleSimilarity(titleText, existing.fingerprint) >= 0.7) {
          dup = true;
          break;
        }
      }
      if (dup) continue;
      seenTitleFingerprints.push({ fingerprint: titleText, index: result.length });
    }

    // ── Content Jaccard dedup (>70% similarity, keep earliest) ──
    const words = new Set(
      p.text
        .toLowerCase()
        .replace(/https?:\/\/\S+/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 3),
    );
    if (words.size >= 5) {
      let contentDup = false;
      for (const existing of seenContent) {
        const intersection = new Set([...words].filter((x) => existing.words.has(x)));
        const union = new Set([...words, ...existing.words]);
        const similarity = intersection.size / union.size;
        if (similarity >= 0.7) {
          contentDup = true;
          break;
        }
      }
      if (contentDup) continue;
      seenContent.push({ words, index: result.length });
    }

    result.push(entry);
  }

  return result;
}
