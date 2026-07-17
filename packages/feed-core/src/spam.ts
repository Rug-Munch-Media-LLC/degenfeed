/**
 * spam — Advanced spam detection with continuous scoring.
 *
 * Exports `spamScore` (0-1, where 1 = definitely spam) and backward-
 * compatible `isSpamPost` using a configurable threshold.
 *
 * New checks:
 *   - Repeated identical content (within a feed window)
 *   - Excessive hashtag ratio (>50% hashtags)
 *   - Link-only posts with no substantive text
 *   - New accounts (<24h) with high post frequency
 *   - Known scam / giveaway / "send 1 get 2" patterns
 */

import type { UnifiedPost } from '@degenfeed/types';

// ─── Spam pattern constants ──────────────────────────────────────────

const SPAM_PATTERNS: RegExp[] = [
  /\b(make money|earn \$\d+|work from home|double your|guaranteed profit|100x guarantee)\b/gi,
  /\b(click here|link in bio|dm me|message me|join my vip|pump group|signals group)\b/gi,
  /\b(casino|lottery|gift card|free crypto|free bitcoin|airdrop scam|claim now)\b/gi,
  /\b(viagra|cialis|escort|onlyfans)\b/gi,
  /🚀{4,}|💰{4,}|🔥{4,}|🌙{4,}/g,
];

/** Additional crypto/web3-specific scam patterns. */
const SCAM_PATTERNS: RegExp[] = [
  /\b(giveaway|giveaway)\b.*\b(eth|btc|sol|usdt|crypto)\b/i,
  /\b(free\s+(eth|btc|sol|nft|crypto))\b.*\b(claim|send|click|join)\b/i,
  /\b(send\s+\d+\s*(eth|btc|sol|usdt)\s+(to|get|receive)\s+\d+)\b/i,
  /\b(airdrop|claim\s+(now|your))\b.*\b(eth|btc|sol|token)\b/i,
  /\b(limited\s+(time|supply|offer)|act\s+(now|fast)|don'?t\s+miss)\b.*\b(eth|btc|sol|crypto|token)\b/i,
  /\b(double\s+(your|the)\s+(eth|btc|crypto|money|investment))\b/i,
  /\b(deposit\s+\d+.*(get|earn|make)\s+\d+)\b/i,
  /\b(rekt|rug\s*pull|honeypot).*\b(补偿|refund|recover|claim)\b/i,
];

const REPEATED_CHAR_RE = /(.)\1{8,}/;

// ─── Public context / result types ───────────────────────────────────

export interface SpamContext {
  /** Recent posts in the same feed batch, for duplicate detection. */
  recentPosts?: UnifiedPost[];
  /** Account age in milliseconds (creation time → now). */
  accountAgeMs?: number;
  /** Number of posts by this author in the current window. */
  authorPostCount?: number;
}

export interface SpamResult {
  score: number;
  signals: string[];
}

export type SpamTier = 'clean' | 'borderline' | 'spam' | 'definite';

// ─── Core: continuous spam score ─────────────────────────────────────

/**
 * Compute a continuous spam score (0.0 = clean, 1.0 = definite spam).
 * Accepts an optional context object for window-wide checks (duplicate
 * content, author frequency).
 */
export function spamScore(post: UnifiedPost, context?: SpamContext): SpamResult {
  const signals: string[] = [];
  let score = 0;
  const text = post.text.trim();

  // ── Length / gibberish ────────────────────────────────────────────
  if (text.length < 12) {
    score += 0.25;
    signals.push('too-short');
  }

  if (/^[0-9a-f]{64}$/i.test(text)) {
    score += 0.7;
    signals.push('hex-only');
  }

  if (/^\s*(test|testing|hello world|asdf|qwerty|lorem ipsum)\s*$/i.test(text)) {
    score += 0.6;
    signals.push('gibberish');
  }

  if (/^[\s\p{Emoji}\p{Extended_Pictographic}]+$/u.test(text)) {
    score += 0.4;
    signals.push('emoji-only');
  }

  // ── Repeated characters ───────────────────────────────────────────
  if (REPEATED_CHAR_RE.test(text)) {
    score += 0.35;
    signals.push('repeated-chars');
  }

  // ── All-caps (screaming) ──────────────────────────────────────────
  const upperRatio = (text.match(/[A-Z]/g) ?? []).length / Math.max(text.length, 1);
  if (text.length >= 20 && upperRatio > 0.7) {
    score += 0.3;
    signals.push('all-caps');
  }

  // ── Classic spam pattern hits ─────────────────────────────────────
  const lower = text.toLowerCase();
  let spamHits = 0;
  for (const re of SPAM_PATTERNS) {
    re.lastIndex = 0;
    if (re.test(lower)) spamHits++;
  }
  if (spamHits > 0) {
    score += Math.min(spamHits * 0.25, 0.6);
    signals.push(`spam-patterns:${spamHits}`);
  }

  // ── Crypto scam patterns ──────────────────────────────────────────
  let scamHits = 0;
  for (const re of SCAM_PATTERNS) {
    re.lastIndex = 0;
    if (re.test(lower)) scamHits++;
  }
  if (scamHits > 0) {
    score += Math.min(scamHits * 0.3, 0.7);
    signals.push(`scam-patterns:${scamHits}`);
  }

  // ── Too many URLs ─────────────────────────────────────────────────
  const urlCount = (text.match(/https?:\/\//g) ?? []).length;
  if (urlCount >= 4) {
    score += 0.4;
    signals.push('excessive-urls');
  }

  // ── Excessive hashtag ratio (>50%) ────────────────────────────────
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const hashtags = text.match(/#[a-zA-Z0-9_]+/g) ?? [];
  const hashtagRatio = hashtags.length / Math.max(words.length, 1);
  if (hashtagRatio > 0.5 && words.length > 3) {
    score += 0.35;
    signals.push('hashtag-heavy');
  }

  // ── Link-only posts (no substantive text) ─────────────────────────
  const urlFree = text.replace(/https?:\/\/\S+/g, '').trim();
  if (urlFree.length < 10 && urlCount > 0 && text.length > 20) {
    score += 0.3;
    signals.push('link-only');
  }
  if (urlFree.length === 0 && urlCount > 0) {
    score += 0.4;
    signals.push('bare-link');
  }

  // ── Repeated identical content in the same feed window ────────────
  if (context?.recentPosts && context.recentPosts.length > 0) {
    const dupes = context.recentPosts.filter(
      (p) => p.id !== post.id && p.text.trim() === text,
    );
    if (dupes.length > 0) {
      score += Math.min(dupes.length * 0.25, 0.7);
      signals.push(`duplicate-content:${dupes.length}`);
    }
  }

  // ── New accounts posting at high frequency ────────────────────────
  if (
    context?.accountAgeMs !== undefined &&
    context.accountAgeMs < 24 * 60 * 60 * 1000 &&
    (context?.authorPostCount ?? 0) > 5
  ) {
    score += 0.4;
    signals.push('new-account-high-frequency');
  }

  return { score: Math.min(Math.max(score, 0), 1), signals };
}

// ─── Tier / threshold helpers ────────────────────────────────────────

/**
 * Classify a post into a spam tier. Uses the continuous `spamScore`
 * under the hood. Useful for UI badges.
 */
export function spamTier(post: UnifiedPost, context?: SpamContext): SpamTier {
  const { score } = spamScore(post, context);
  if (score >= 0.8) return 'definite';
  if (score >= 0.55) return 'spam';
  if (score >= 0.3) return 'borderline';
  return 'clean';
}

// ─── Legacy boolean check ────────────────────────────────────────────

/**
 * Legacy `isSpamPost` — returns true when `spamScore >= 0.55`.
 * Prefer `spamScore` for nuanced filtering (e.g., show borderline
 * content at reduced rank).
 */
export function isSpamPost(post: UnifiedPost): boolean {
  return spamScore(post).score >= 0.55;
}

// ─── Content quality score (0-1, higher = better) ────────────────────

/**
 * Content quality score (0-1, higher = better).
 * Used by the ranking engine as a content-quality multiplier.
 * Inverse of spamScore — a post with high spam gets low quality.
 */
export function contentQualityScore(text: string): number {
  if (!text) return 0.5;
  const trimmed = text.trim();
  const words = trimmed.split(/\s+/).filter((w) => w.length > 0);

  if (words.length === 1 && (words[0]?.length ?? 0) < 20) return 0.3;

  const emojiCount = (trimmed.match(/[\p{Emoji}\p{Extended_Pictographic}]/gu) ?? []).length;
  const emojiRatio = emojiCount / Math.max(trimmed.length, 1);
  if (emojiRatio > 0.3) return 0.2;

  const capsRatio = (trimmed.match(/[A-Z]/g) ?? []).length / Math.max(trimmed.length, 1);
  if (capsRatio > 0.8 && trimmed.length > 15) return 0.3;

  const hashtagRatio1 =
    (trimmed.match(/#[a-zA-Z0-9_]+/g) ?? []).length / Math.max(words.length, 1);
  if (hashtagRatio1 > 0.5 && words.length > 3) return 0.4;

  const urlFree = trimmed.replace(/https?:\/\/\S+/g, '').trim();
  if (urlFree.length < 10 && trimmed.length > 20) return 0.4;

  return 1.0;
}
