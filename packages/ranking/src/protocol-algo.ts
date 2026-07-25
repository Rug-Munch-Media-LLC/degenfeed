/**
 * @degenfeed/ranking — Protocol-Level Algorithm
 *
 * Each protocol feed gets its own scoring with protocol-specific signals:
 * - Nostr: Relay quality, zap count, NIP-05 verified
 * - Farcaster: FID age, follower count, frame engagement
 * - Bluesky: DID age, post quality, community reputation
 * - Mastodon: Instance reputation, boost count, favorite ratio
 * - PeerTube: Video quality, channel subscribers, federation status
 *
 * These scores are additive multipliers applied AFTER the base unified score.
 */

import type { Protocol, UnifiedPost } from '@degenfeed/types';

// ─── Types ──────────────────────────────────────────────────────────────

export interface ProtocolAlgoResult {
  /** Combined protocol multiplier (0-5 range) */
  multiplier: number;
  /** Individual factor scores for transparency */
  factors: Record<string, number>;
  /** Human-readable reasons */
  reasons: string[];
}

export interface NostrSignals {
  /** Average relay quality score 0-1 */
  relayQuality: number;
  /** Total zap amount in sats */
  zapTotal: number;
  /** Number of zaps received */
  zapCount: number;
  /** Whether the author has a NIP-05 identifier */
  nip05Verified: boolean;
  /** NIP-05 domain quality (known-good domain) */
  nip05DomainQuality?: number;
}

export interface FarcasterSignals {
  /** FID age in days */
  fidAgeDays: number;
  /** Follower count */
  followerCount: number;
  /** Whether the author has a verified Farcaster account */
  isVerified: boolean;
  /** Frame engagement rate (clicks/interactions per view) */
  frameEngagementRate?: number;
  /** Power badge user */
  isPowerUser?: boolean;
}

export interface BlueskySignals {
  /** DID age in days */
  didAgeDays: number;
  /** Post quality score from Bluesky's own signals 0-1 */
  postQuality: number;
  /** Community reputation (labeler-based) 0-1 */
  communityReputation: number;
  /** Whether the author is in follow lists / starter packs */
  listedInStarterPacks?: number;
}

export interface MastodonSignals {
  /** Instance reputation 0-1 */
  instanceReputation: number;
  /** Boost count for this post */
  boostCount: number;
  /** Favorites-to-boosts ratio */
  favoriteBoostRatio: number;
  /** Whether the instance is well-moderated */
  isWellModerated: boolean;
  /** Instance user count (log scale) */
  instanceUserCount?: number;
}

export interface PeerTubeSignals {
  /** Video resolution (height in px) */
  videoResolution: number;
  /** Channel subscriber count */
  channelSubscribers: number;
  /** Whether the channel is federated to other instances */
  isFederated: boolean;
  /** Video duration in seconds */
  duration: number;
  /** Average engagement rate for channel */
  channelEngagementRate?: number;
}

export interface ProtocolScoringContext {
  nostr?: Partial<NostrSignals>;
  farcaster?: Partial<FarcasterSignals>;
  bluesky?: Partial<BlueskySignals>;
  mastodon?: Partial<MastodonSignals>;
  peertube?: Partial<PeerTubeSignals>;
}

// ─── Nostr scorer ──────────────────────────────────────────────────────

function scoreNostr(signals: Partial<NostrSignals>): ProtocolAlgoResult {
  const factors: Record<string, number> = {};
  const reasons: string[] = [];
  let multiplier = 1.0;

  // 1. NIP-05 verification
  const nip05 = signals.nip05Verified ?? false;
  const nip05DomainQuality = signals.nip05DomainQuality ?? 0.5;
  factors.nip05 = nip05 ? 0.15 + nip05DomainQuality * 0.15 : 0;
  if (nip05) {
    multiplier += factors.nip05;
    reasons.push('NIP-05 verified');
  }

  // 2. Zap count (log-scaled)
  const zapTotal = signals.zapTotal ?? 0;
  const zapCount = signals.zapCount ?? 0;
  const zapScore = Math.min(0.5, Math.log(1 + zapTotal) / 20 + Math.log(1 + zapCount) / 10);
  factors.zaps = zapScore;
  if (zapScore > 0.1) {
    multiplier += zapScore;
    reasons.push(`zapped ${zapTotal}sats`);
  }

  // 3. Relay quality
  const relayQuality = signals.relayQuality ?? 0.5;
  factors.relayQuality = relayQuality * 0.2;
  multiplier += factors.relayQuality;
  if (relayQuality > 0.7) reasons.push('high-quality relays');

  return { multiplier: Math.max(0.5, Math.min(3, multiplier)), factors, reasons };
}

// ─── Farcaster scorer ──────────────────────────────────────────────────

function scoreFarcaster(signals: Partial<FarcasterSignals>): ProtocolAlgoResult {
  const factors: Record<string, number> = {};
  const reasons: string[] = [];
  let multiplier = 1.0;

  // 1. FID age (older = more established)
  const fidAge = signals.fidAgeDays ?? 0;
  const fidAgeScore = Math.min(0.25, fidAge / 1200); // Cap at ~3.3 years
  factors.fidAge = fidAgeScore;
  if (fidAgeScore > 0.1) {
    multiplier += fidAgeScore;
    reasons.push(`established FID (${Math.round(fidAge)}d old)`);
  }

  // 2. Follower count (log scale)
  const followers = signals.followerCount ?? 0;
  const followerScore = Math.min(0.3, Math.log(1 + followers) / 40);
  factors.followers = followerScore;
  if (followerScore > 0.05) {
    multiplier += followerScore;
    if (followers > 1000) reasons.push('popular on Farcaster');
  }

  // 3. Frame engagement
  const frameEng = signals.frameEngagementRate ?? 0;
  factors.frameEngagement = frameEng * 0.15;
  multiplier += factors.frameEngagement;
  if (frameEng > 0.1) reasons.push('high frame engagement');

  // 4. Power user
  if (signals.isPowerUser) {
    factors.isPowerUser = 0.15;
    multiplier += 0.15;
    reasons.push('Farcaster power user');
  }

  return { multiplier: Math.max(0.5, Math.min(3, multiplier)), factors, reasons };
}

// ─── Bluesky scorer ────────────────────────────────────────────────────

function scoreBluesky(signals: Partial<BlueskySignals>): ProtocolAlgoResult {
  const factors: Record<string, number> = {};
  const reasons: string[] = [];
  let multiplier = 1.0;

  // 1. DID age (older = more established)
  const didAge = signals.didAgeDays ?? 0;
  const didAgeScore = Math.min(0.2, didAge / 900);
  factors.didAge = didAgeScore;
  if (didAgeScore > 0.1) {
    multiplier += didAgeScore;
    reasons.push(`established Bluesky account`);
  }

  // 2. Post quality (Bluesky's own moderation/quality signals)
  const postQuality = signals.postQuality ?? 0.5;
  const postQualityScore = (postQuality - 0.5) * 0.3;
  factors.postQuality = Math.max(-0.15, Math.min(0.15, postQualityScore));
  multiplier += factors.postQuality;
  if (postQuality > 0.7) reasons.push('high quality post');
  if (postQuality < 0.3) reasons.push('low quality signal');

  // 3. Community reputation
  const rep = signals.communityReputation ?? 0.5;
  const repScore = (rep - 0.5) * 0.2;
  factors.communityReputation = Math.max(-0.1, Math.min(0.1, repScore));
  multiplier += factors.communityReputation;
  if (rep > 0.7) reasons.push('good community reputation');

  // 4. Starter pack presence
  const listedIn = signals.listedInStarterPacks ?? 0;
  if (listedIn > 5) {
    factors.starterPackPresence = 0.15;
    multiplier += 0.15;
    reasons.push('curated in starter packs');
  } else if (listedIn > 0) {
    factors.starterPackPresence = 0.05;
    multiplier += 0.05;
  }

  return { multiplier: Math.max(0.5, Math.min(3, multiplier)), factors, reasons };
}

// ─── Mastodon scorer ───────────────────────────────────────────────────

function scoreMastodon(signals: Partial<MastodonSignals>): ProtocolAlgoResult {
  const factors: Record<string, number> = {};
  const reasons: string[] = [];
  let multiplier = 1.0;

  // 1. Instance reputation (0-1)
  const instanceRep = signals.instanceReputation ?? 0.5;
  const instScore = (instanceRep - 0.5) * 0.3;
  factors.instanceReputation = Math.max(-0.15, Math.min(0.15, instScore));
  multiplier += factors.instanceReputation;
  if (instanceRep > 0.7) reasons.push('well-moderated instance');
  if (instanceRep < 0.3) reasons.push('low reputation instance');

  // 2. Boost count (log scale)
  const boosts = signals.boostCount ?? 0;
  const boostScore = Math.min(0.25, Math.log(1 + boosts) / 20);
  factors.boosts = boostScore;
  if (boostScore > 0.1) {
    multiplier += boostScore;
    reasons.push(`boosted ${boosts} times`);
  }

  // 3. Favorite-to-boost ratio (high = quality content)
  const ratio = signals.favoriteBoostRatio ?? 1;
  const ratioScore = Math.min(0.15, Math.log(1 + ratio) / 15);
  factors.favBoostRatio = ratioScore;
  if (ratioScore > 0.05) {
    multiplier += ratioScore;
    if (ratio > 3) reasons.push('high favorite ratio');
  }

  // 4. Instance size signal
  const instanceUsers = signals.instanceUserCount ?? 0;
  if (instanceUsers > 10000) {
    factors.instanceSize = 0.05;
    multiplier += 0.05;
  }

  return { multiplier: Math.max(0.5, Math.min(3, multiplier)), factors, reasons };
}

// ─── PeerTube scorer ───────────────────────────────────────────────────

function scorePeerTube(signals: Partial<PeerTubeSignals>): ProtocolAlgoResult {
  const factors: Record<string, number> = {};
  const reasons: string[] = [];
  let multiplier = 1.0;

  // 1. Video resolution
  const res = signals.videoResolution ?? 720;
  const resScore = res >= 2160 ? 0.25 : res >= 1440 ? 0.2 : res >= 1080 ? 0.15 : 0.05;
  factors.resolution = resScore;
  multiplier += resScore;
  if (res >= 1080) reasons.push('HD video');

  // 2. Channel subscribers (log scale)
  const subs = signals.channelSubscribers ?? 0;
  const subScore = Math.min(0.2, Math.log(1 + subs) / 40);
  factors.subscribers = subScore;
  if (subScore > 0.05) multiplier += subScore;

  // 3. Federation status
  if (signals.isFederated) {
    factors.isFederated = 0.15;
    multiplier += 0.15;
    reasons.push('federated content');
  }

  // 4. Channel engagement
  const channelEng = signals.channelEngagementRate ?? 0.5;
  const engScore = (channelEng - 0.5) * 0.2;
  factors.channelEngagement = Math.max(-0.1, Math.min(0.1, engScore));
  multiplier += factors.channelEngagement;

  // 5. Duration sweet spot
  const duration = signals.duration ?? 300;
  if (duration >= 180 && duration <= 1200) {
    factors.duration = 0.1;
    multiplier += 0.1;
    reasons.push('sweet spot video length');
  } else if (duration < 30) {
    factors.duration = -0.05;
    multiplier -= 0.05;
  }

  return { multiplier: Math.max(0.3, Math.min(3, multiplier)), factors, reasons };
}

// ─── Main dispatcher ───────────────────────────────────────────────────

/**
 * Score a post using protocol-specific signals.
 * Returns a multiplier applied after the base unified score.
 */
export function scoreProtocolAlgo(
  post: UnifiedPost,
  context: ProtocolScoringContext,
): ProtocolAlgoResult {
  const protocol = post.protocol;

  switch (protocol) {
    case 'nostr':
      return scoreNostr(context.nostr ?? {});
    case 'farcaster':
      return scoreFarcaster(context.farcaster ?? {});
    case 'bluesky':
    case 'atproto':
      return scoreBluesky(context.bluesky ?? {});
    case 'mastodon':
    case 'pleroma':
    case 'misskey':
      return scoreMastodon(context.mastodon ?? {});
    case 'peertube':
    case 'owncast':
      return scorePeerTube(context.peertube ?? {});

    // Protocols without specific scorers get neutral multiplier
    default:
      // Apply a simple tier-based multiplier from protocol quality
      return {
        multiplier: getProtocolDefaultMultiplier(protocol),
        factors: { default: 1.0 },
        reasons: [],
      };
  }
}

/**
 * Default multiplier for protocols without specific scorers.
 * Based on platform tier and trustworthiness.
 */
function getProtocolDefaultMultiplier(protocol: Protocol | string): number {
  const high = new Set(['lens', 'pixelfed', 'youtube', 'rss', 'mirror', 'paragraph']);
  const medium = new Set([
    'lemmy',
    'kbin',
    'tildes',
    'threads',
    'zora',
    'snapshot',
    'hive',
    'diaspora',
    'friendica',
  ]);
  const low = new Set(['twitter', 'telegram', 'discord', 'email', 'webhook', 'google', 'github']);

  if (high.has(protocol)) return 1.1;
  if (medium.has(protocol)) return 1.0;
  if (low.has(protocol)) return 0.9;
  return 1.0;
}

// ─── Protocol scoring helpers ──────────────────────────────────────────

/**
 * Extract protocol-specific signals from a UnifiedPost metadata.
 * This allows the protocol algo to work without external context when
 * signals are embedded in the post's raw metadata.
 */
export function extractProtocolSignalsFromPost(post: UnifiedPost): Partial<ProtocolScoringContext> {
  const context: ProtocolScoringContext = {};
  const raw = post.raw as Record<string, unknown> | null;

  if (!raw) return context;

  switch (post.protocol) {
    case 'nostr': {
      const tags = raw.tags as string[][] | undefined;
      const zaps = raw.zaps as Array<unknown> | undefined;
      context.nostr = {
        nip05Verified: (raw.nip05 as string) !== undefined,
        relayQuality: (raw.relayScore as number) ?? 0.5,
        zapTotal: (raw.zapTotal as number) ?? 0,
        zapCount: (raw.zapCount as number) ?? (zaps?.length ?? 0),
      };
      break;
    }
    case 'farcaster': {
      context.farcaster = {
        fidAgeDays: (raw.fidAge as number) ?? 0,
        followerCount: post.author.followerCount ?? 0,
        isVerified: post.author.verified.length > 0,
        frameEngagementRate: (raw.frameEngagement as number) ?? 0,
        isPowerUser: (raw.isPowerUser as boolean) ?? false,
      };
      break;
    }
    case 'bluesky':
    case 'atproto': {
      context.bluesky = {
        didAgeDays: (raw.didAge as number) ?? 0,
        postQuality: (raw.labelerScore as number) ?? 0.5,
        communityReputation: (raw.reputation as number) ?? 0.5,
        listedInStarterPacks: (raw.starterPackCount as number) ?? 0,
      };
      break;
    }
    case 'mastodon': {
      context.mastodon = {
        instanceReputation: (raw.instanceReputation as number) ?? 0.5,
        boostCount: post.metrics.reposts,
        favoriteBoostRatio: post.metrics.reposts > 0
          ? post.metrics.likes / post.metrics.reposts
          : post.metrics.likes,
        isWellModerated: (raw.wellModerated as boolean) ?? true,
        instanceUserCount: (raw.instanceUsers as number) ?? 0,
      };
      break;
    }
    case 'peertube': {
      context.peertube = {
        videoResolution: (raw.resolution as number) ?? 720,
        channelSubscribers: (raw.channelSubscribers as number) ?? 0,
        isFederated: (raw.isFederated as boolean) ?? true,
        duration: (raw.duration as number) ?? 300,
        channelEngagementRate: (raw.engagementRate as number) ?? 0.5,
      };
      break;
    }
  }

  return context;
}
