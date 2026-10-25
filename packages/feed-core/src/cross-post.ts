// ─── Cross-post + aggregator detection ────────────────────────────────

import type { UnifiedPost } from '@degenfeed/types';

export const CROSS_POST_PATTERNS = [
  /^cross.?post(?:ed)?:?/i,
  /^also (?:posted|shared|published) (?:on|to):?/i,
  /^re.?post(?:ed)? (?:from|via):?/i,
  /^syndicated (?:from|to):?/i,
  /^mirror(?:ed)? (?:from|to):?/i,
  /^\[cross.?post\]/i,
  /^📢/i,
];

export function isCrossPost(text: string): boolean {
  const trimmed = text.trim();
  return CROSS_POST_PATTERNS.some((p) => p.test(trimmed));
}

/**
 * Detect if a post originates from a known aggregator or
 * republishing source (not the original content).
 */
export const AGGREGATOR_DOMAINS = [
  'reddit.com',
  'redlib.', // Redlib instances
  'lemmy', // Lemmy instances
  'news.google.com',
  'news.ycombinator.com',
  'medium.com',
  'substack.com',
  'ghost.org',
];

export function isFromAggregator(post: UnifiedPost): boolean {
  // Check if the post content references an aggregator
  const urls = post.text.match(/https?:\/\/[^\s<>"']+/gi) ?? [];
  for (const url of urls) {
    try {
      const u = new URL(url);
      if (AGGREGATOR_DOMAINS.some((d) => u.hostname.includes(d))) return true;
    } catch {
      // ignore bad URLs
    }
  }
  // Check embeds for aggregator signals
  for (const embed of post.embeds) {
    try {
      const u = new URL(embed.url);
      if (AGGREGATOR_DOMAINS.some((d) => u.hostname.includes(d))) return true;
    } catch {
      // ignore
    }
  }
  return false;
}

/**
 * Extract the canonical article URL from a post.
 * Handles Medium, Substack, Reddit, and other platforms
 * that may have trackable or redirect URLs.
 */
