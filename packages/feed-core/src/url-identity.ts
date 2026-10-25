// ─── URL identity for dedup ───────────────────────────────────────────

import type { UnifiedPost } from '@degenfeed/types';
import { NON_ALPHA_RE, TICKER_RE, URL_RE } from './text-similarity';

export function extractCanonicalUrl(post: UnifiedPost): string | null {
  // First check embeds for explicit URLs
  const linkEmbeds = post.embeds.filter((e) => e.kind === 'link');
  for (const embed of linkEmbeds) {
    if (embed.url && embed.url.length > 5) {
      return normalizeUrlForDedup(embed.url);
    }
  }

  // Then extract first substantial URL from text
  const urls = post.text.match(/https?:\/\/[^\s<>"']+/gi);
  if (urls && urls.length > 0) {
    // Filter out social media URLs (those are the post itself, not a shared article)
    const socialDomains = ['twitter.com', 'x.com', 'bsky.app', 'warpcast.com', 'nostr.', 'naddr'];
    const articleUrl = urls.find((u) => !socialDomains.some((d) => u.includes(d)));
    if (articleUrl) return normalizeUrlForDedup(articleUrl);
  }

  return null;
}

export function primaryUrl(post: UnifiedPost): string | null {
  const urls = post.text.match(URL_RE);
  if (urls && urls.length > 0) return normalizeUrlForDedup(urls[0]);
  const embed = post.embeds.find(
    (e) => e.kind === 'link' || e.kind === 'image' || e.kind === 'video',
  );
  return embed ? normalizeUrlForDedup(embed.url) : null;
}

export function normalizeUrlForDedup(url: string): string {
  try {
    const u = new URL(url.toLowerCase());
    if (u.pathname.startsWith('/@') || u.pathname.includes('/users/')) {
      const parts = u.pathname.split('/');
      const lastTwo = parts.filter(Boolean).slice(-2).join('/');
      const statusId = u.searchParams.get('status') || parts[parts.length - 1];
      return `ap:${lastTwo}:${statusId || ''}`;
    }
    return url.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

export function tickerSnapshot(text: string): string {
  const tickers = new Set(text.match(TICKER_RE) ?? []);
  const sorted = [...tickers].sort().join(',');
  const firstSentence = text
    .replace(URL_RE, '')
    .replace(/[.!?].*/, '')
    .replace(NON_ALPHA_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
  return sorted ? `${sorted}|${firstSentence}` : firstSentence;
}
