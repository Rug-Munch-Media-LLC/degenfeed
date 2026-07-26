/**
 * @degenfeed/api-worker — Video Aggregator Utilities
 *
 * Cache helpers, scoring, category inference, XML helpers.
 */

import type { Env } from '../types';

const CACHE_PREFIX = 'video:agg:';
const CACHE_TTL = 300;

export function cacheKey(suffix: string): string {
  return `${CACHE_PREFIX}${suffix}`;
}

export async function getCachedJson<T>(env: Env, key: string): Promise<T | null> {
  try {
    const raw = await env.CACHE?.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function setCachedJson(env: Env, key: string, data: unknown): Promise<void> {
  try {
    await env.CACHE?.put(key, JSON.stringify(data), { expirationTtl: CACHE_TTL });
  } catch {
    /* non-critical */
  }
}

// ─── Scoring ─────────────────────────────────────────────

export function computeScore(views: number, publishedMs: number): number {
  const ageHours = Math.max(1, (Date.now() - publishedMs) / 3600000);
  const viewsPerHour = views / ageHours;
  return Math.min(viewsPerHour / 10, 100);
}

// ─── Category Inference ──────────────────────────────────

const CATEGORY_MAP: Array<[string, string]> = [
  ['crypto', 'crypto'],
  ['bitcoin', 'crypto'],
  ['ethereum', 'crypto'],
  ['defi', 'crypto'],
  ['blockchain', 'crypto'],
  ['nft', 'crypto'],
  ['trading', 'crypto'],
  ['gaming', 'gaming'],
  ['gameplay', 'gaming'],
  ['esports', 'gaming'],
  ['music', 'music'],
  ['song', 'music'],
  ['album', 'music'],
  ['news', 'news'],
  ['politics', 'news'],
  ['breaking', 'news'],
  ['sport', 'sports'],
  ['football', 'sports'],
  ['basketball', 'sports'],
  ['soccer', 'sports'],
  ['tech', 'tech'],
  ['programming', 'tech'],
  ['software', 'tech'],
  ['ai', 'tech'],
  ['tutorial', 'education'],
  ['learn', 'education'],
  ['course', 'education'],
  ['science', 'science'],
  ['research', 'science'],
  ['comedy', 'comedy'],
  ['funny', 'comedy'],
  ['entertainment', 'entertainment'],
  ['talk', 'talk'],
  ['podcast', 'talk'],
  ['interview', 'talk'],
  ['art', 'art'],
  ['digital art', 'art'],
  ['design', 'art'],
  ['irl', 'irl'],
  ['vlog', 'irl'],
  ['lifestyle', 'irl'],
];

export function inferCategory(title: string, description: string): string {
  const text = `${title} ${description}`.toLowerCase();
  for (const [keyword, cat] of CATEGORY_MAP) {
    if (text.includes(keyword)) return cat;
  }
  return 'entertainment';
}

// ─── XML Helpers ─────────────────────────────────────────

export function extractXmlTag(xml: string, tag: string): string {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`<${escaped}[^>]*>([\\s\\S]*?)</${escaped}>`, 'i');
  const m = re.exec(xml);
  return m?.[1]?.trim() ?? '';
}

export function extractXmlAttr(xml: string, tag: string, attr: string): string {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`<${escaped}[^>]*${attr}\\s*=\\s*["']([^"']*)["']`, 'i');
  const m = re.exec(xml);
  return m?.[1] ?? '';
}

export function decodeXml(str: string): string {
  return str
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(Number.parseInt(h, 16)))
    .trim();
}
