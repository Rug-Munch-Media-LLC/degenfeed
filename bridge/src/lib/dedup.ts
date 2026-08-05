/**
 * Cross-protocol deduplication for the master feed.
 *
 * The same content is routinely cross-posted: an article, video or link shows
 * up on Nostr, Farcaster, Bluesky, Mastodon, Threads, RSS, Lemmy, YouTube and
 * the rest within minutes. `deduplicateFeed` collapses those copies into one
 * canonical post and tags the losers with `crossPostOf: <canonical id>` so
 * callers can explain why a post was hidden or render the cross-post trail.
 *
 * Two grouping signals, applied in order:
 *   1. Normalized text — first 100 chars, lowercased, URLs and @mentions
 *      stripped (bridged copies of the same text differ only in protocol
 *      noise like link shorteners or mention handles).
 *   2. Embed URLs — the same canonical link indicates the same piece of
 *      content even when the caption differs or is missing entirely.
 *
 * Within each duplicate group the canonical copy is the one with the highest
 * engagement/quality score; ties go to the most recent post. The returned
 * array preserves the input order of the surviving canonical posts so the
 * caller decides final ordering (usually newest-first).
 */

import type { UnifiedPost } from '../server/types';

/** Minimum fingerprint length before text grouping is trusted. */
const MIN_TEXT_KEY_LENGTH = 24;
/** Longest prefix used for text grouping (spec: first 100 chars). */
const TEXT_KEY_LENGTH = 100;

/**
 * Normalize post text for grouping: lowercase, strip URLs and @mentions,
 * drop punctuation, collapse whitespace, cap at the first 100 chars.
 */
export function normalizeDedupText(text: string): string {
  return (text || '')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/@[\w.-]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, TEXT_KEY_LENGTH);
}

/**
 * Normalize an embed/link URL for cross-protocol comparison.
 * Strips protocol, www., trailing slashes and common tracking params so the
 * same article/video linked from Nostr/Farcaster/Bluesky matches.
 */
export function urlKey(url: string): string {
  let u = (url || '').trim();
  try {
    const parsed = new URL(u);
    u = (parsed.hostname || '').replace(/^www\./, '') + parsed.pathname;
  } catch {
    // Unparseable — strip protocol-ish prefixes and tracking params manually.
    u = u.replace(/^[a-z]+:\/\//i, '').replace(/^www\./, '');
  }
  u = u
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '')
    .toLowerCase();
  return u || '';
}

/**
 * Engagement/quality score used to pick the canonical copy of a duplicate
 * group. Combines likes, reposts, replies, quotes and views; posts with no
 * metrics score on text richness so real content beats empty shells.
 */
export function engagementScore(post: UnifiedPost): number {
  const m = post.metrics || ({} as UnifiedPost['metrics']);
  const likes = Number(m.likes) || 0;
  const reposts = Number(m.reposts) || 0;
  const replies = Number(m.replies) || 0;
  const quotes = Number(m.quotes) || 0;
  const views = Number(m.views) || 0;
  const score = likes + reposts * 2 + replies * 1.5 + quotes * 1.5 + views / 1000;
  if (score > 0) return score;
  // No engagement data — prefer posts with real text over bare links.
  const textLen = (post.text || '').length;
  return textLen > 0 ? Math.min(textLen / 100, 5) : 0;
}

/**
 * Collapse cross-protocol duplicates into a single feed.
 *
 * Groups by normalized text first, then by embed URL. For every group the
 * highest-engagement (tie: newest) post survives; the losing copies get
 * `crossPostOf` set to the survivor's id and are dropped from the result.
 */
export function deduplicateFeed(posts: readonly UnifiedPost[]): UnifiedPost[] {
  const groups = new Map<string, UnifiedPost[]>();
  const order: string[] = [];

  /** Group key for a post — text fingerprint, else first embed URL. */
  const keyFor = (p: UnifiedPost): string | null => {
    const textKey = normalizeDedupText(p.text);
    if (textKey.length >= MIN_TEXT_KEY_LENGTH) return `t:${textKey}`;
    const urls = (p.embeds || []).map((e) => urlKey(e.url)).filter(Boolean);
    if (urls.length > 0) return `u:${urls[0]}`;
    return textKey.length > 0 ? `t:${textKey}` : null;
  };

  for (const p of posts) {
    const key = keyFor(p);
    if (!key) continue;
    let arr = groups.get(key);
    if (!arr) {
      arr = [];
      groups.set(key, arr);
      order.push(key);
    }
    arr.push(p);
  }

  const result: UnifiedPost[] = [];
  for (const key of order) {
    const arr = groups.get(key);
    if (!arr || arr.length === 0) continue;
    // Canonical copy = best engagement, tie-break newest.
    const sorted = [...arr].sort((a, b) => {
      const d = engagementScore(b) - engagementScore(a);
      if (d !== 0) return d;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
    const canonical = sorted[0];
    if (!canonical) continue;
    result.push(canonical);
    for (const dup of sorted.slice(1)) {
      (dup as UnifiedPost & { crossPostOf?: string }).crossPostOf = canonical.id;
    }
  }

  return result;
}
