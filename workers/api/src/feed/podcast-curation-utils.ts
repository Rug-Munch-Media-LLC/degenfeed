/**
 * @degenfeed/api-worker — Podcast Curation Utilities
 */

import { AI_PODCASTS } from './podcast-curation-data-ai';
import { CRYPTO_PODCASTS } from './podcast-curation-data-crypto';
import { TECH_PODCASTS } from './podcast-curation-data-tech';
import type { CuratedPodcast } from './podcast-curation-types';

export const ALL_CURATED_PODCASTS: CuratedPodcast[] = [
  ...CRYPTO_PODCASTS,
  ...TECH_PODCASTS,
  ...AI_PODCASTS,
];

export const CURATED_PODCASTS_BY_CATEGORY: Record<string, CuratedPodcast[]> = {
  crypto: CRYPTO_PODCASTS,
  tech: TECH_PODCASTS,
  ai: AI_PODCASTS,
};

export function getCuratedPodcastById(id: string): CuratedPodcast | undefined {
  return ALL_CURATED_PODCASTS.find((p) => p.id === id);
}

export function getCuratedPodcastsByCategory(category: string): CuratedPodcast[] {
  return CURATED_PODCASTS_BY_CATEGORY[category] ?? [];
}

export function getCuratedPodcastStats(): Record<string, number> {
  return {
    total: ALL_CURATED_PODCASTS.length,
    crypto: CRYPTO_PODCASTS.length,
    tech: TECH_PODCASTS.length,
    ai: AI_PODCASTS.length,
  };
}
