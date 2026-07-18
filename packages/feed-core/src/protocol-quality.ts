/**
 * @degenfeed/feed-core — Per-protocol quality scoring.
 *
 * Each protocol has different signals for "good content". This module
 * computes an additive quality score per post using protocol-native
 * signals, so protocol pages can rank by *best* content instead of
 * chronological or raw engagement.
 *
 * Rules (additive points, per protocol):
 *   Farcaster: verified +3, active/power badge +2, has replies +1,
 *              has frames +1, no $DEGEN tip spam +1          (max 8)
 *   Lens:      original (not mirror) +3, collected +2,
 *              has comments +1, known creator +1             (max 7)
 *   Bluesky:   custom domain handle +2, not reply spam +1,
 *              has media +1, followed account +1             (max 5)
 *   Nostr:     kind-1 note +1, long-form (>280 chars) +2,
 *              multi-relay +1, NIP-05 verified +2            (max 6)
 *   Mastodon:  alt text on images +2, appropriate CW +1,
 *              not a bot (>30d account) +1, known instance +1 (max 5)
 *
 * The result carries a normalized ratio (0..1) so cross-protocol
 * comparisons stay fair, plus human-readable reasons for transparency.
 */

import type { UnifiedPost } from '@degenfeed/types';

// ─── Types ──────────────────────────────────────────────────────────

export interface ProtocolQualityResult {
  /** Raw additive score. */
  score: number;
  /** Maximum achievable score for this protocol. */
  maxScore: number;
  /** score / maxScore, normalized 0..1 for cross-protocol comparison. */
  ratio: number;
  /** Human-readable signals that contributed points. */
  reasons: string[];
  /** Badge derived from the ratio: 'verified' for high-quality posts. */
  badge: 'verified' | null;
}

export interface ProtocolQualityContext {
  /** Author ids the viewer follows (bluesky "known accounts" signal). */
  followed?: Set<string>;
  /** Now in unix ms (injectable for tests). */
  now?: number;
}

/** Ratio at or above which a post earns the ⭐ Verified quality badge. */
export const QUALITY_BADGE_THRESHOLD = 0.6;

// ─── Signal constants ───────────────────────────────────────────────

/** $DEGEN tip spam: "100 $DEGEN", "$DEGEN x100", bare tip replies. */
const DEGEN_TIP_RE = /(\b\d[\d,.]*\s*x?\s*\$degen\b|\$degen\s*x?\s*\d)/i;

/** NIP-05 identifier: name@domain or bare domain (for `_@domain`). */
const NIP05_RE = /^[a-z0-9._-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$|^[a-z0-9-]+(\.[a-z0-9-]+)+$/i;

/** Well-established fediverse instances (plus our own). */
export const KNOWN_MASTODON_INSTANCES = new Set([
  'social.degenfeed.xyz',
  'mastodon.social',
  'hachyderm.io',
  'fosstodon.org',
  'infosec.exchange',
  'mstdn.social',
  'mas.to',
  'techhub.social',
  'mastodon.online',
  'chaos.social',
  'ioc.exchange',
]);

const THIRTY_DAYS_MS = 30 * 24 * 3600 * 1000;

// ─── Raw-shape helpers (defensive: providers vary) ─────────────────

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
}

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

// ─── Per-protocol scorers ───────────────────────────────────────────

function scoreFarcaster(post: UnifiedPost): { score: number; max: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  const raw = asRecord(post.raw);
  const rawAuthor = asRecord(raw?.author);

  // Verified account: +3
  const verifiedAddresses = asRecord(rawAuthor?.verified_addresses);
  const hasVerified =
    post.author.verified.length > 0 ||
    (Array.isArray(rawAuthor?.verifications) &&
      (rawAuthor?.verifications as unknown[]).length > 0) ||
    (Array.isArray(verifiedAddresses?.eth_addresses) &&
      (verifiedAddresses?.eth_addresses as unknown[]).length > 0);
  if (hasVerified) {
    score += 3;
    reasons.push('verified-account');
  }

  // Active/power badge holder: +2
  const hasPowerBadge =
    rawAuthor?.power_badge === true ||
    raw?.power_badge === true ||
    rawAuthor?.active_status === 'active';
  if (hasPowerBadge) {
    score += 2;
    reasons.push('power-badge');
  }

  // Conversation starter (has replies): +1
  if (post.metrics.replies > 0) {
    score += 1;
    reasons.push('has-replies');
  }

  // Has frames: +1
  const hasFrame =
    post.embeds.some((e) => e.kind === 'frame') ||
    (Array.isArray(raw?.frames) && (raw?.frames as unknown[]).length > 0);
  if (hasFrame) {
    score += 1;
    reasons.push('has-frame');
  }

  // No $DEGEN tip spam: +1
  if (!DEGEN_TIP_RE.test(post.text)) {
    score += 1;
    reasons.push('no-degen-spam');
  }

  return { score, max: 8, reasons };
}

function scoreLens(post: UnifiedPost): { score: number; max: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  const raw = asRecord(post.raw);
  const stats = asRecord(raw?.stats);

  // Original publication (not a mirror): +3
  const isMirror =
    raw?.__typename === 'Mirror' ||
    raw?.mirrorOf != null ||
    (typeof raw?.repostOf === 'object' && raw?.repostOf != null);
  if (!isMirror) {
    score += 3;
    reasons.push('original-publication');
  }

  // Has been collected: +2
  const collects = num(stats?.collects) + num(stats?.countOpenActions) + num(stats?.bookmarks);
  if (collects > 0) {
    score += 2;
    reasons.push('collected');
  }

  // Has comments: +1
  if (post.metrics.replies > 0) {
    score += 1;
    reasons.push('has-comments');
  }

  // Known creator (has a profile handle or followers): +1
  if (post.author.followerCount > 0 || post.author.handles.lens) {
    score += 1;
    reasons.push('known-creator');
  }

  return { score, max: 7, reasons };
}

function scoreBluesky(
  post: UnifiedPost,
  ctx: ProtocolQualityContext,
): { score: number; max: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  const handle = post.author.handles.bluesky ?? '';

  // Custom domain handle: +2
  if (handle.includes('.') && !handle.endsWith('.bsky.social')) {
    score += 2;
    reasons.push('custom-domain');
  }

  // Not reply spam (top-level post): +1
  if (!post.parentId) {
    score += 1;
    reasons.push('not-reply-spam');
  }

  // Has media (images/video): +1
  if (post.embeds.some((e) => e.kind === 'image' || e.kind === 'video')) {
    score += 1;
    reasons.push('has-media');
  }

  // Known followed account: +1
  if (ctx.followed?.has(post.author.id)) {
    score += 1;
    reasons.push('followed-account');
  }

  return { score, max: 5, reasons };
}

function scoreNostr(post: UnifiedPost): { score: number; max: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  const raw = asRecord(post.raw);

  // Kind 1 (text note): +1
  if (num(raw?.kind) === 1) {
    score += 1;
    reasons.push('kind-1');
  }

  // Long-form (>280 chars): +2
  if (post.text.trim().length > 280) {
    score += 2;
    reasons.push('long-form');
  }

  // Seen on multiple relays: +1
  if (num(raw?.__relayCount) >= 2) {
    score += 1;
    reasons.push('multi-relay');
  }

  // NIP-05 verified: +2
  const handle = post.author.handles.nostr ?? '';
  if (NIP05_RE.test(handle)) {
    score += 2;
    reasons.push('nip05-verified');
  }

  return { score, max: 6, reasons };
}

function scoreMastodon(
  post: UnifiedPost,
  ctx: ProtocolQualityContext,
): { score: number; max: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  const now = ctx.now ?? Date.now();
  const raw = asRecord(post.raw);
  // Boosts wrap the original status under `reblog`.
  const status = asRecord(raw?.reblog) ?? raw;
  const account = asRecord(status?.account) ?? asRecord(raw?.account);

  // Alt text on all images: +2
  const media = Array.isArray(status?.media_attachments)
    ? (status?.media_attachments as Array<Record<string, unknown>>)
    : [];
  const images = media.filter((m) => m.type === 'image' || m.type === 'gifv');
  if (
    images.length > 0 &&
    images.every((m) => typeof m.description === 'string' && m.description.trim().length > 0)
  ) {
    score += 2;
    reasons.push('alt-text');
  }

  // Content warning used appropriately: +1
  const spoiler = typeof status?.spoiler_text === 'string' ? status.spoiler_text : '';
  if (spoiler.trim().length > 0 || (status?.sensitive === true && spoiler.length > 0)) {
    score += 1;
    reasons.push('has-cw');
  }

  // Not a bot with an account older than 30 days: +1
  const createdAtRaw = account?.created_at;
  const accountAgeOk =
    typeof createdAtRaw === 'string'
      ? now - new Date(createdAtRaw).getTime() > THIRTY_DAYS_MS
      : true; // unknown age — don't penalize
  if (account?.bot !== true && accountAgeOk) {
    score += 1;
    reasons.push('not-bot');
  }

  // From a known instance: +1
  const handle = post.author.handles.mastodon ?? '';
  const domain = handle.includes('@') ? (handle.split('@').pop() ?? '') : '';
  if (domain && KNOWN_MASTODON_INSTANCES.has(domain.toLowerCase())) {
    score += 1;
    reasons.push('known-instance');
  }

  return { score, max: 5, reasons };
}

/** Generic fallback for protocols without bespoke rules. */
function scoreGeneric(post: UnifiedPost): { score: number; max: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  if (post.text.trim().length > 120) {
    score += 1;
    reasons.push('substantive');
  }
  if (post.metrics.replies > 0) {
    score += 1;
    reasons.push('has-replies');
  }
  if (post.author.followerCount > 0) {
    score += 1;
    reasons.push('known-author');
  }
  return { score, max: 3, reasons };
}

// ─── Entry point ────────────────────────────────────────────────────

/**
 * Computes the protocol-specific quality score for a post.
 * Cheap (regex + field sniffing only) — safe to run on every post.
 */
export function computeProtocolQuality(
  post: UnifiedPost,
  ctx: ProtocolQualityContext = {},
): ProtocolQualityResult {
  let result: { score: number; max: number; reasons: string[] };
  switch (post.protocol) {
    case 'farcaster':
      result = scoreFarcaster(post);
      break;
    case 'lens':
      result = scoreLens(post);
      break;
    case 'bluesky':
      result = scoreBluesky(post, ctx);
      break;
    case 'nostr':
      result = scoreNostr(post);
      break;
    case 'mastodon':
      result = scoreMastodon(post, ctx);
      break;
    default:
      result = scoreGeneric(post);
  }
  const ratio = result.max > 0 ? result.score / result.max : 0;
  return {
    score: result.score,
    maxScore: result.max,
    ratio,
    reasons: result.reasons,
    badge: ratio >= QUALITY_BADGE_THRESHOLD ? 'verified' : null,
  };
}
