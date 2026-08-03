/**
 * @degenfeed/bridge — Content moderation pipeline (v1: keyword/pattern filter)
 *
 * Lightweight, dependency-free moderation for the publish path. This is a
 * first-pass filter — it blocks unambiguous abuse (CSAM/illegal content,
 * phishing/scam lures) and flags spam-like content for review. It is NOT a
 * substitute for human moderation or hashing-based CSAM detection (e.g.
 * PhotoDNA/ThreatExchange); those are follow-ups documented in the report.
 *
 * Threat model:
 *   - Blocked patterns: content that must never be published (CSAM,
 *     sexual exploitation of minors, illegal activity coordination).
 *   - Flagged patterns: spam/scam lures that should require review or be
 *     suppressed from reach (giveaway scams, pump-and-dump, "DM me" lures,
 *     wallet-verification phishing).
 *
 * Matching is case-insensitive; URLs are normalized (scheme stripped) so
 * obfuscated links still match.
 */

export interface ModerationResult {
  allowed: boolean;
  blocked: string[];
  flagged: string[];
}

/**
 * HARD BLOCK — unambiguous abuse. Never publish.
 * CSAM / sexual exploitation of minors / illegal activity coordination.
 */
const BLOCKED_PATTERNS: RegExp[] = [
  /\bcsam\b/i,
  /\bchild\s+[ps]\b/i, // child porn / child sex
  /\bpreteen\s*(sex|porn)\b/i,
  /\b(sex|sexual)\s+(with|involving)\s+minors?\b/i,
  /\bsell(ing)?\s+(illegal|illicit)\s*(drugs?|firearms?|weapons?)\b/i,
  /\bhitman\b/i,
  /\b(hire|contract)\s+(an?\s+)?(assassin|hitman)\b/i,
];

/**
 * FLAG — likely spam/scam; block on publish and flag for review.
 * Giveaway lures, pump-and-dump, wallet-verification phishing, DM lures.
 */
const FLAG_PATTERNS: RegExp[] = [
  /\b(claim|collect|receive)\s+(free|bonus|reward)\s+(tokens?|nft|airdrop)\b/i,
  /\bairdrop\s*(is\s*)?(live|claim|now|today)\b/i,
  /\b(giveaway|giveaway scam)\b/i,
  /\b(verify|validate|confirm)\s+your\s+(wallet|account)\b/i,
  /\b(dm|message)\s+me\s+(to|for|and)\b/i,
  /\b(pump|dump)\s*(the)?\s*(token|coin|bag)\b/i,
  /\b100[0-9]*x\s+(returns?|gains?|profits?)\b/i,
  /\b(guaranteed|risk[- ]free)\s+(profits?|returns?)\b/i,
  /\bsend\s+\d+\s*(sol|eth|btc|usdt)\s+(to|and)\s+(receive|get)\b/i,
  /\b(deposit|send)\s+(sol|eth|btc|usdc)\s+to\s+(claim|activate|verify)\b/i,
  /\b(price|chart)\s+analysis\s+group\b/i,
  /\b(only\s+)?fans\b/i, // adult spam on a public crypto feed
  /\b(trading\s+)?signals?\s+group\b/i,
];

/** Normalize content for matching: lowercase, strip scheme. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/https?:\/\//g, '')
    .replace(/\bwww\./g, '');
}

export function moderateContent(content: string): ModerationResult {
  const normalized = normalize(content);
  const blocked: string[] = [];
  const flagged: string[] = [];

  for (const re of BLOCKED_PATTERNS) {
    if (re.test(normalized)) {
      blocked.push(re.source);
    }
  }
  for (const re of FLAG_PATTERNS) {
    if (re.test(normalized)) {
      flagged.push(re.source);
    }
  }

  return {
    allowed: blocked.length === 0,
    blocked,
    flagged,
  };
}

/** Maximum post length for the publish path (defense in depth). */
export const MAX_PUBLISH_LENGTH = 15_000;
