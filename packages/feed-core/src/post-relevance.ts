// ─── Post relevance gate ──────────────────────────────────────────────
// Single responsibility: decide whether a unified post belongs in the feed.

import type { UnifiedPost } from '@degenfeed/types';
import { detectNiches } from './relevance';
import { CRYPTO_RELEVANCE_TERMS } from './relevance-terms';

function gatherRelevanceText(post: UnifiedPost): string {
  const parts: string[] = [post.text, post.html ?? '', post.author.displayName, post.author.bio];
  for (const n of post.niches) parts.push(n);
  for (const e of post.embeds) {
    parts.push(e.url);
    const meta = e.meta;
    if (meta) {
      if (typeof meta.title === 'string') parts.push(meta.title);
      if (typeof meta.description === 'string') parts.push(meta.description);
    }
  }
  return parts.join(' ').toLowerCase();
}

export function isRelevantPost(post: UnifiedPost): boolean {
  const computedNiches =
    post.niches.length > 0
      ? post.niches
      : detectNiches(
          `${post.text} ${post.html ?? ''} ${post.author.displayName} ${post.author.bio}`,
        );

  const text = gatherRelevanceText({ ...post, niches: computedNiches });

  if (computedNiches.length > 0) {
    const hasCoreSignal =
      /\b(crypto|bitcoin|btc|ethereum|eth|solana|sol|defi|nft|web3|blockchain|altcoin|stablecoin|l2|rollup|etf|macro|regulation|security|memecoin|ai|onchain|token)\b/.test(
        text,
      );
    if (hasCoreSignal) return true;
  }

  if (/\$[A-Z]{2,5}\b/.test(text)) return true;
  if (
    /#[a-zA-Z0-9_]+/.test(text) &&
    /\b(crypto|bitcoin|ethereum|solana|defi|nft|web3|blockchain)\b/.test(text)
  ) {
    return true;
  }
  for (const term of CRYPTO_RELEVANCE_TERMS) {
    if (text.includes(term)) return true;
  }
  return false;
}
