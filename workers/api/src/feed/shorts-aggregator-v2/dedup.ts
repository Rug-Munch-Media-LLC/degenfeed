/**
 * @degenfeed/api-worker — Shorts Deduplication
 *
 * Deduplicates shorts across all sources by content hash.
 * When duplicates exist, keeps the one with higher quality score,
 * merges engagement data, and tracks cross-platform availability.
 */

import type { AggregatedShort, ExtendedSource } from './types';
import { SOURCE_META } from './types';

/**
 * Compute a deterministic dedup hash from the short's content.
 * Uses URL path + title normalized as fallback.
 */
function computeDedupHash(short: AggregatedShort): string {
  try {
    const url = new URL(short.videoUrl);
    // Normalize: hostname + pathname (no trailing slash, lowercase)
    const pathKey = url.hostname + url.pathname.replace(/\/$/, '').toLowerCase();
    return pathKey;
  } catch {
    // Fallback: normalized title + creator
    const normalizedTitle = short.title
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 40);
    const normalizedCreator = short.creatorName.toLowerCase().replace(/[^a-z0-9]/g, '');
    return `${normalizedCreator}:${normalizedTitle}`;
  }
}

/**
 * Deduplicate shorts across all sources by content hash.
 * When duplicates exist, keep the one with higher quality score,
 * merge engagement data, and track cross-platform availability.
 *
 * The resulting short's `alsoAvailableOn` field lists all other
 * platforms where the same content was found, with links.
 */
export function deduplicate(shorts: AggregatedShort[]): AggregatedShort[] {
  const seen = new Map<string, AggregatedShort>();
  // Track all sources for each content hash
  const sourceMap = new Map<string, Map<ExtendedSource, string>>();

  for (const short of shorts) {
    const hash = computeDedupHash(short);
    const existing = seen.get(hash);

    // Track source → URL mapping for cross-platform availability
    if (!sourceMap.has(hash)) {
      sourceMap.set(hash, new Map());
    }
    const sources = sourceMap.get(hash)!;
    if (!sources.has(short.source)) {
      sources.set(short.source, short.sourceUrl);
    }

    if (!existing) {
      seen.set(hash, short);
      continue;
    }

    // Merge: keep higher quality, merge engagement
    const merged: AggregatedShort = {
      ...(short.qualityScore >= existing.qualityScore ? short : existing),
      views: Math.max(existing.views, short.views),
      likes: Math.max(existing.likes, short.likes),
      qualityScore: Math.max(existing.qualityScore, short.qualityScore),
      engagementRate: Math.max(existing.engagementRate, short.engagementRate),
      tags: [...new Set([...existing.tags, ...short.tags])],
      categories: [...new Set([...existing.categories, ...short.categories])],
    };

    seen.set(hash, merged);
  }

  // Build cross-platform availability lists
  const result = Array.from(seen.values());
  for (const short of result) {
    const sources = sourceMap.get(short.contentHash);
    if (sources && sources.size > 1) {
      // Exclude the current primary source, list all others
      const others = Array.from(sources.entries())
        .filter(([src]) => src !== short.source)
        .map(([src, url]) => ({
          source: src,
          label: SOURCE_META[src]?.label || src,
          url,
        }));
      if (others.length > 0) {
        short.alsoAvailableOn = others;
      }
    }
  }

  return result;
}
