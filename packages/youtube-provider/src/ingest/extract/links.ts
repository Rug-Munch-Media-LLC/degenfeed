/** Outbound link extraction (description + transcript). No fetching happens here. */
import type { DetectedLink } from '../types';

const URL_RE = /https?:\/\/[^\s<>"'`)\]]+/g;
const TRAILING = /[.,;:!?]+$/;

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** Distinct links ordered by first appearance; malformed URLs are dropped. */
export function extractLinks(text: string): DetectedLink[] {
  const seen = new Map<string, string>();
  for (const match of text.matchAll(URL_RE)) {
    const url = (match[0] ?? '').replace(TRAILING, '');
    if (!url || seen.has(url)) continue;
    const host = hostOf(url);
    if (!host) continue;
    seen.set(url, host);
  }
  return [...seen.entries()].map(([url, host]) => ({ url, host }));
}
