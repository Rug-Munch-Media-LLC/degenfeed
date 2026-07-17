/**
 * moderation — Auto-moderation configuration and pattern matching.
 *
 * Configurable thresholds for auto-flag and auto-reject,
 * scam keyword list, and spam pattern regex list.
 * Used by the feed pipeline and the moderation API.
 */

// ─── Thresholds ───────────────────────────────────────────────────────

export interface ModerationThresholds {
  /** spamScore >= this → auto-flag for manual review */
  autoFlagScore: number;
  /** spamScore >= this → auto-reject (don't include in feed) */
  autoRejectScore: number;
  /** Number of unique reporter addresses needed to auto-hide a post */
  autoHideReportCount: number;
  /** Minimum unique reporters from different IPs/wallets for auto-hide */
  autoHideMinReporters: number;
  /** Reports within this window (ms) count toward auto-hide */
  autoHideWindowMs: number;
}

export const DEFAULT_THRESHOLDS: ModerationThresholds = {
  autoFlagScore: 0.8,
  autoRejectScore: 0.9,
  autoHideReportCount: 5,
  autoHideMinReporters: 3,
  autoHideWindowMs: 24 * 60 * 60 * 1000, // 24 hours
};

// ─── Scam Keywords ────────────────────────────────────────────────────

export const SCAM_KEYWORDS: string[] = [
  // Giveaway scams
  'giveaway',
  'free eth',
  'free btc',
  'free sol',
  'airdrop claim',
  'double your',
  'send me',
  'deposit earn',
  // Fake support
  'metamask support',
  'ledger support',
  'validate wallet',
  'sync wallet',
  'verify wallet',
  'confirm wallet',
  'connect wallet',
  // Phishing
  'claim token',
  'claim airdrop',
  'claim reward',
  'approve contract',
  'sign this',
  'sign message',
  // Pump groups
  'pump group',
  'pump and dump',
  'signals group',
  'whale group',
  'insider group',
  'vip group',
  // Rug indicators
  'presale',
  'fair launch',
  'stealth launch',
  'liquidity locked',
  'ownership renounced',
];

// ─── Spam Pattern Regexes ─────────────────────────────────────────────

export const SPAM_PATTERN_REGEXES: RegExp[] = [
  // Repeated identical content posted across protocols
  /^[\s\S]*\b(posted|shared|cross.?post)\b[\s\S]*$/i,
  // Excessive @mentions (>5)
  /(@[a-zA-Z0-9_]+\s*){6,}/,
  // Excessive hashtags (>8)
  /(#[a-zA-Z0-9_]+\s*){9,}/,
  // URL-only with affiliate/tracking params
  /https?:\/\/[^\s]*\?(ref|ref_id|affiliate|utm_source|utm_medium|utm_campaign)=[^\s]+/i,
  // Known scam domain patterns
  /https?:\/\/(?:[a-z0-9-]+\.)*(?:airdrop|claim|free|giveaway|bonus|rewards?)-(?:eth|btc|sol|nft|token)\.[a-z]{2,}/i,
  // NFT mint spam
  /\b(mint\s+(now|your|free)|limited\s+(edition|mint|supply)|whitelist\s+(mint|spot|access))\b.*\b(get|join|click|claim)\b/i,
  // Fake celebrity endorsement
  /\b(elon|musk|satoshi|cz_binance|vitalik|shytoshi)\b.*\b(giveaway|airdrop|send|donate)\b/i,
  // Price prediction spam
  /\b(to\s*the\s*moon|moon\s*(soon|today)|100x|1000x|10000x)\b/i,
  // Multi-level marketing
  /\b(referral|invite\s+code|sign\s+up\s+now|join\s+my\s+team|earn\s+(passive|residual))\b/i,
  // Self-promotion / engagement bait
  /\b(like\s+and\s+share|follow\s+for|retweet\s+to|tag\s+a\s+friend|upvote\s+if|comment\s+below)\b/i,
];

// ─── Helpers ──────────────────────────────────────────────────────────

export interface ModerationCheckResult {
  reject: boolean;
  flag: boolean;
  reasons: string[];
}

/**
 * Run all auto-moderation checks against a text string.
 * Returns whether the content should be rejected or flagged for review,
 * along with the matching reasons.
 */
export function checkText(text: string): ModerationCheckResult {
  const lower = text.toLowerCase();
  const reasons: string[] = [];
  let reject = false;
  let flag = false;

  // Check scam keywords
  for (const keyword of SCAM_KEYWORDS) {
    if (lower.includes(keyword)) {
      // Only count scam keywords if they appear in a scammy context
      const idx = lower.indexOf(keyword);
      const contextStart = Math.max(0, idx - 40);
      const contextEnd = Math.min(lower.length, idx + keyword.length + 40);
      const context = lower.slice(contextStart, contextEnd);
      // Likely scam: keyword + call to action
      if (/\b(get|claim|send|click|join|donate|invest|buy|sell)\b/.test(context)) {
        reasons.push(`scam-keyword:${keyword}`);
        reject = true;
      } else {
        reasons.push(`scam-keyword-soft:${keyword}`);
        flag = true;
      }
    }
  }

  // Check spam patterns
  for (const re of SPAM_PATTERN_REGEXES) {
    if (re.test(text)) {
      const match = text.match(re);
      const label = match
        ? `spam-pattern:${match[0]?.slice(0, 30).toLowerCase().replace(/[^a-z0-9]/g, '-')}`
        : 'spam-pattern';
      reasons.push(label);
      flag = true;
    }
  }

  return { reject, flag, reasons };
}

/**
 * Check if a user is banned. Reads from the bans KV store.
 * Stub for dependency injection — the actual KV read is done in the worker.
 */
export function isUserBanned(
  userId: string,
  bannedUsers: Set<string>,
): boolean {
  return bannedUsers.has(userId) || bannedUsers.has(userId.toLowerCase());
}
