/**
 * @degenfeed/api-worker — Shorts Quality Scoring
 *
 * Computes quality scores for all aggregated shorts.
 * Factors: resolution proxy (duration), engagement, source reputation,
 * content freshness, has thumbnail.
 */

import type { AggregatedShort } from './types';

/**
 * Compute quality scores for all shorts.
 * Returns a new array with updated qualityScore values (0–1).
 */
export function scoreQuality(shorts: AggregatedShort[]): AggregatedShort[] {
  return shorts.map((s) => {
    let score = 0.3; // base score

    // Duration sweet spot: 15-60s is ideal for shorts
    if (s.duration >= 15 && s.duration <= 60) score += 0.15;
    else if (s.duration < 10) score -= 0.1;

    // Has meaningful title
    if (s.title && s.title.length > 5) score += 0.1;

    // Has thumbnail
    if (s.thumbnailUrl?.startsWith('http')) score += 0.1;

    // Engagement signal
    if (s.views > 0) {
      const likeRatio = s.likes / Math.max(s.views, 1);
      score += Math.min(likeRatio * 5, 0.2);
      if (s.views > 10000) score += 0.1;
      else if (s.views > 1000) score += 0.05;
    }

    // Has creator info
    if (s.creatorName && s.creatorName !== 'unknown') score += 0.05;
    if (s.creatorAvatar) score += 0.05;

    // Has tags/categories
    if (s.tags.length > 0) score += 0.05;
    if (s.categories.length > 0) score += 0.05;

    // Freshness bonus (published within last 7 days)
    const ageMs = Date.now() - s.publishedAt;
    const ageDays = ageMs / 86400000;
    if (ageDays < 1) score += 0.15;
    else if (ageDays < 3) score += 0.1;
    else if (ageDays < 7) score += 0.05;

    // Loops priority boost: our platform content gets +0.15
    if (s.source === 'loops') score += 0.15;

    // PeerTube self-hosted gets small boost
    if (s.source === 'peertube') score += 0.05;

    // Zora marketplace-active shorts get boost
    if (s.zoraMarketplaceActive) score += 0.05;

    // Nostr/Lens/Bluesky get small discovery boost
    if (s.source === 'nostr') score += 0.03;
    if (s.source === 'lens') score += 0.03;
    if (s.source === 'bluesky') score += 0.03;

    return { ...s, qualityScore: Math.min(Math.max(score, 0), 1) };
  });
}
