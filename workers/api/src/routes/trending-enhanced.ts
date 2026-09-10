/**
 * /api/trending/enhanced — Mastodon-inspired enhanced trending
 *
 * Wraps the existing trending scraper with:
 *   1. Language-aware filtering via query param
 *   2. Content warning auto-detection
 *   3. Instance-aware diversity ranking
 *   4. Continuous score normalization across platforms
 *
 * Query params:
 *   - language (string): filter to specific language (e.g., 'en', 'es', 'zh')
 *   - maxPerInstance (number, default 3): max items from same instance
 *   - annotateCW (boolean, default true): auto-detect and annotate CWs
 *   - limit (number, default 50): max items
 *   - platforms (string, comma-separated): filter to specific platforms
 *
 * Returns enhanced TrendingItem[] with CW annotations and language info.
 */

import { type Env, jsonResponse, noCacheJsonResponse } from '../index';
import {
  type DetectedLanguage,
  detectItemLanguage,
  enhanceTrendingPipeline,
} from '../lib/competitive-analysis/trending-enhancer';
import { TRENDING_CACHE_KEY, type TrendingData, type TrendingItem } from './trending-scraper';

// ─── Route handler ─────────────────────────────────────────────────────

export async function handleTrendingEnhanced(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const language = url.searchParams.get('language') || '';
  const maxPerInstance = Math.min(Number(url.searchParams.get('maxPerInstance')) || 3, 10);
  const annotateCW = url.searchParams.get('annotateCW') !== 'false'; // default true
  const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 100);
  const platformFilter = url.searchParams.get('platforms')?.split(',').filter(Boolean) ?? [];

  // Load trending data from cache
  let data: TrendingData | null = null;
  try {
    const cached = await env.CACHE?.get(TRENDING_CACHE_KEY);
    if (cached) {
      data = JSON.parse(cached) as TrendingData;
    }
  } catch {
    /* ignore */
  }

  if (!data) {
    return jsonResponse({ error: 'Trending data not available yet. Try again later.' }, 503);
  }

  // Merge all items
  const allItems: TrendingItem[] = [];
  for (const [platform, platformData] of Object.entries(data.platforms)) {
    if (platformFilter.length > 0 && !platformFilter.includes(platform)) continue;
    allItems.push(...platformData.items);
  }

  // Sort by score descending
  allItems.sort((a, b) => b.score - a.score);

  // Apply language filter
  let allowedLanguages: DetectedLanguage[] = [];
  if (language) {
    allowedLanguages = language.split(',').map((l) => l.trim()) as DetectedLanguage[];
  }

  // Run the enhancement pipeline
  const enhanced = enhanceTrendingPipeline(allItems, {
    allowedLanguages,
    maxPerInstance,
    annotateCW,
  });

  // Apply limit
  const page = enhanced.slice(0, limit);

  // Add language info to each item for UI display
  const enriched = page.map((item) => ({
    ...item,
    detectedLanguage: detectItemLanguage(item),
  }));

  return noCacheJsonResponse({
    data: enriched,
    meta: {
      total: allItems.length,
      filtered: enhanced.length,
      limit,
      language,
      fetchedAt: data.timestamp,
    },
  });
}
