// ─── Core relevance signals ───────────────────────────────────────────
// Single responsibility: score and niche-tag a piece of text.

import type { Embed } from '@degenfeed/types';
import { BOOST_TERMS } from './boost-terms';
import { NICHE_KEYWORDS } from './niche-keywords';

export interface SignalScores {
  recency: number;
  platform: number;
  engagement: number;
  relevance: number;
  quality: number;
  diversity: number;
  total: number;
}

export function keywordRelevance(text: string): number {
  const lower = text.toLowerCase();
  let hits = 0;
  for (const term of BOOST_TERMS) {
    if (lower.includes(term)) hits++;
  }
  return Math.min(1 + hits * 0.15, 2.0);
}

export function extractEmbeds(text: string, native: unknown[] = []): Embed[] {
  const urlRe = /https?:\/\/[^\s<>"']+/gi;
  const urls = text.match(urlRe) ?? [];
  const linkEmbeds: Embed[] = urls.map((u) => ({ kind: 'link', url: u }));
  const passed = native as Embed[];
  return [...linkEmbeds, ...passed];
}

export function detectNiches(text: string): string[] {
  const t = text.toLowerCase();
  const found = new Set<string>();
  for (const [niche, words] of Object.entries(NICHE_KEYWORDS)) {
    if (words.some((w) => t.includes(w))) found.add(niche);
  }
  return Array.from(found);
}
