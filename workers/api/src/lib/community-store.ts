/**
 * @degenfeed/api-worker — Community data layer for creator token engagement
 *
 * KV-backed store for token comments, streams, milestones, badges, and
 * online presence. Designed for the DegenFeed bonding curve phase and
 * permanent community hubs.
 *
 * KV key patterns:
 *   comment:{tokenAddress}:{timestamp}:{id}
 *   stream:{tokenAddress}:active
 *   milestones:{tokenAddress}
 *   badge:{tokenAddress}:{wallet}
 *   online:{tokenAddress}:{wallet}        (TTL 60s heartbeat)
 *   comment:rate:{wallet}                 (TTL 60s — 5/min rate limit)
 *   buyer:stats:{tokenAddress}:{wallet}
 */

import type { Env } from '../index';

// ─── Types ────────────────────────────────────────────────────────────

export interface TokenComment {
  id: string;
  tokenAddress: string;
  author: string;
  authorHandle?: string;
  authorAvatar?: string;
  text: string;
  parentId?: string; // For threaded replies
  holderAmount: string;
  isHolder: boolean;
  isCreator: boolean;
  timestamp: number;
  badges: string[]; // 'early_bird', 'top_100', 'whale', 'og', 'creator', 'superfan'
}

export interface TokenStream {
  id: string;
  tokenAddress: string;
  tokenSymbol: string;
  creator: string;
  title: string;
  streamType: 'video' | 'audio' | 'spaces';
  streamUrl: string;
  minHoldRequirement: number;
  viewerCount: number;
  startedAt: number;
  isActive: boolean;
}

export interface TokenMilestone {
  id: string;
  tokenAddress: string;
  type: 'holders' | 'volume' | 'price' | 'graduation' | 'days_alive';
  threshold: string;
  reached: boolean;
  reachedAt?: number;
  reward?: string; // "Unlocks HD streaming"
}

export interface UserBadge {
  id: string;
  tokenAddress: string;
  type:
    | 'early_bird'
    | 'top_100'
    | 'first_buyer'
    | 'whale'
    | 'og'
    | 'superfan'
    | 'streamer'
    | 'creator';
  label: string;
  description: string;
  earnedAt: number;
}

export interface BuyerStats {
  buyOrder: number; // What number buyer they were (1 = first)
  totalBought: string;
  totalComments: number;
  firstBuyAt: number;
}

// ─── KV helpers ────────────────────────────────────────────────────────

function key(...parts: string[]): string {
  return parts.join(':');
}

function getStore(env: Env): KVNamespace {
  if (!env.CONTENT_STORE) throw new Error('CONTENT_STORE KV namespace not bound');
  return env.CONTENT_STORE;
}

// ─── Rate limits ──────────────────────────────────────────────────────

export async function checkCommentRateLimit(
  env: Env,
  wallet: string,
): Promise<boolean> {
  try {
    const rateKey = key('comment', 'rate', wallet.toLowerCase());
    const raw = await getStore(env).get(rateKey);
    const count = raw ? (JSON.parse(raw) as number) : 0;
    if (count >= 5) return false;
    await getStore(env).put(rateKey, JSON.stringify(count + 1), {
      expirationTtl: 60,
    });
    return true;
  } catch (err) {
    console.error('[community-store] Comment rate limit check failed:', err);
    return false; // Fail closed — deny on error
  }
}

export async function checkPublishRateLimit(
  env: Env,
  wallet: string,
): Promise<boolean> {
  try {
    const rateKey = key('publish', 'rate', wallet.toLowerCase());
    const raw = await getStore(env).get(rateKey);
    const count = raw ? (JSON.parse(raw) as number) : 0;
    if (count >= 30) return false;
    await getStore(env).put(rateKey, JSON.stringify(count + 1), {
      expirationTtl: 60,
    });
    return true;
  } catch (err) {
    console.error('[community-store] Publish rate limit check failed:', err);
    return false; // Fail closed — deny on error
  }
}

export async function checkStreamStartRateLimit(
  env: Env,
  wallet: string,
): Promise<boolean> {
  try {
    const rateKey = key('stream', 'rate', wallet.toLowerCase());
    const raw = await getStore(env).get(rateKey);
    const count = raw ? (JSON.parse(raw) as number) : 0;
    if (count >= 5) return false;
    await getStore(env).put(rateKey, JSON.stringify(count + 1), {
      expirationTtl: 3600,
    });
    return true;
  } catch (err) {
    console.error('[community-store] Stream rate limit check failed:', err);
    return false; // Fail closed — deny on error
  }
}

export async function checkIdentityLinkRateLimit(
  env: Env,
  wallet: string,
): Promise<boolean> {
  try {
    const rateKey = key('identity', 'rate', wallet.toLowerCase());
    const raw = await getStore(env).get(rateKey);
    const count = raw ? (JSON.parse(raw) as number) : 0;
    if (count >= 10) return false;
    await getStore(env).put(rateKey, JSON.stringify(count + 1), {
      expirationTtl: 3600,
    });
    return true;
  } catch (err) {
    console.error('[community-store] Identity rate limit check failed:', err);
    return false; // Fail closed — deny on error
  }
}

// ─── Comments ──────────────────────────────────────────────────────────

export async function getTokenComments(
  env: Env,
  tokenAddress: string,
  cursor?: string,
  limit = 50,
): Promise<{ comments: TokenComment[]; nextCursor?: string; total: number }> {
  try {
    const prefix = key('comment', tokenAddress);
    const list = await getStore(env).list({
      prefix,
      limit: limit + 1,
      cursor,
    });

    const rawComments: (TokenComment | null)[] = await Promise.all(
      list.keys.slice(0, limit).map(async (k) => {
        const data = await getStore(env).get(k.name);
        return data ? (JSON.parse(data) as TokenComment) : null;
      }),
    );

    const comments = rawComments.filter(Boolean) as TokenComment[];
    const enriched = await enrichWithAuthorHandles(env, comments);
    const hasMore = list.keys.length > limit;

    return {
      comments: enriched,
      nextCursor: hasMore ? (list as unknown as { cursor: string }).cursor : undefined,
      total: enriched.length,
    };
  } catch (err) {
    console.error('[community-store] getTokenComments failed:', err);
    return { comments: [], total: 0 };
  }
}

export async function addComment(
  env: Env,
  comment: Omit<TokenComment, 'id' | 'badges'>,
): Promise<TokenComment> {
  const id = crypto.randomUUID();
  const badges = await calculateBadges(env, comment.tokenAddress, comment.author, comment);

  const full: TokenComment = { ...comment, id, badges };
  const commentKey = key('comment', comment.tokenAddress, String(comment.timestamp), id);

  await getStore(env).put(commentKey, JSON.stringify(full), {
    expirationTtl: comment.isHolder ? 86400 * 365 : 86400 * 7, // 1yr for holders, 7d for non-holders
  });

  // Update buyer stats comment count
  await incrementBuyerCommentCount(env, comment.tokenAddress, comment.author);

  return full;
}

// ─── Badges ────────────────────────────────────────────────────────────

async function calculateBadges(
  env: Env,
  tokenAddress: string,
  wallet: string,
  comment: Pick<TokenComment, 'holderAmount' | 'isCreator'>,
): Promise<string[]> {
  const badges: string[] = [];
  try {
    const stats = await getBuyerStats(env, tokenAddress, wallet);

    if (stats.buyOrder <= 100) badges.push('early_bird');
    if (stats.buyOrder <= 10) badges.push('og');
    if (stats.buyOrder === 1) badges.push('first_buyer');
    if (Number(comment.holderAmount) > 1_000_000) badges.push('whale');
    if (comment.isCreator) badges.push('creator');
    if (stats.totalComments > 50) badges.push('superfan');
  } catch (err) {
    console.error('[community-store] Badge calculation failed:', err);
  }
  return badges;
}

export async function getUserBadges(
  env: Env,
  tokenAddress: string,
  wallet: string,
): Promise<UserBadge[]> {
  try {
    const badgeKey = key('badge', tokenAddress, wallet.toLowerCase());
    const raw = await getStore(env).get(badgeKey);
    return raw ? (JSON.parse(raw) as UserBadge[]) : [];
  } catch (err) {
    console.error('[community-store] getUserBadges failed:', err);
    return [];
  }
}

export async function awardBadge(
  env: Env,
  tokenAddress: string,
  wallet: string,
  badge: UserBadge,
): Promise<void> {
  const existing = await getUserBadges(env, tokenAddress, wallet);
  const already = existing.some((b) => b.type === badge.type);
  if (already) return;

  existing.push(badge);
  const badgeKey = key('badge', tokenAddress, wallet.toLowerCase());
  await getStore(env).put(badgeKey, JSON.stringify(existing), {
    expirationTtl: 86400 * 365, // 1 year
  });
}

// ─── Buyer stats ───────────────────────────────────────────────────────

export async function getBuyerStats(
  env: Env,
  tokenAddress: string,
  wallet: string,
): Promise<BuyerStats> {
  const statsKey = key('buyer', 'stats', tokenAddress, wallet.toLowerCase());
  try {
    const raw = await getStore(env).get(statsKey);
    if (raw) return JSON.parse(raw) as BuyerStats;
  } catch {
    // Fall through to defaults
  }
  return { buyOrder: 9999, totalBought: '0', totalComments: 0, firstBuyAt: 0 };
}

async function incrementBuyerCommentCount(
  env: Env,
  tokenAddress: string,
  wallet: string,
): Promise<void> {
  try {
    const statsKey = key('buyer', 'stats', tokenAddress, wallet.toLowerCase());
    const raw = await getStore(env).get(statsKey);
    const stats: BuyerStats = raw
      ? (JSON.parse(raw) as BuyerStats)
      : { buyOrder: 9999, totalBought: '0', totalComments: 0, firstBuyAt: 0 };
    stats.totalComments += 1;
    await getStore(env).put(statsKey, JSON.stringify(stats), {
      expirationTtl: 86400 * 365,
    });
  } catch {
    // Non-critical, ignore
  }
}

// ─── Streams ───────────────────────────────────────────────────────────

export async function getActiveStream(
  env: Env,
  tokenAddress: string,
): Promise<TokenStream | null> {
  try {
    const streamKey = key('stream', tokenAddress, 'active');
    const raw = await getStore(env).get(streamKey);
    if (!raw) return null;
    const stream = JSON.parse(raw) as TokenStream;
    if (!stream.isActive) return null;
    return stream;
  } catch (err) {
    console.error('[community-store] getActiveStream failed:', err);
    return null;
  }
}

export async function createLiveStream(
  env: Env,
  stream: Omit<TokenStream, 'id' | 'streamUrl' | 'isActive' | 'viewerCount'> & {
    streamUrl?: string;
  },
): Promise<TokenStream> {
  const id = crypto.randomUUID();
  const full: TokenStream = {
    id,
    tokenAddress: stream.tokenAddress,
    tokenSymbol: stream.tokenSymbol,
    creator: stream.creator,
    title: stream.title,
    streamType: stream.streamType,
    streamUrl:
      stream.streamUrl ||
      `https://livepeer.studio/play/${id}`,
    minHoldRequirement: stream.minHoldRequirement,
    viewerCount: 0,
    startedAt: stream.startedAt,
    isActive: true,
  };

  const streamKey = key('stream', stream.tokenAddress, 'active');
  await getStore(env).put(streamKey, JSON.stringify(full), {
    expirationTtl: 86400, // 24h stream TTL
  });

  return full;
}

export async function endStream(
  env: Env,
  tokenAddress: string,
): Promise<void> {
  const streamKey = key('stream', tokenAddress, 'active');
  const raw = await getStore(env).get(streamKey);
  if (raw) {
    const stream = JSON.parse(raw) as TokenStream;
    stream.isActive = false;
    // Keep for 7 days as historical record
    await getStore(env).put(streamKey, JSON.stringify(stream), {
      expirationTtl: 86400 * 7,
    });
  }
}

export async function incrementViewerCount(
  env: Env,
  tokenAddress: string,
): Promise<number> {
  const stream = await getActiveStream(env, tokenAddress);
  if (!stream) return 0;
  stream.viewerCount += 1;
  const streamKey = key('stream', tokenAddress, 'active');
  await getStore(env).put(streamKey, JSON.stringify(stream), {
    expirationTtl: 86400,
  });
  return stream.viewerCount;
}

// ─── Online presence (heartbeat) ───────────────────────────────────────

export async function updateOnlineHeartbeat(
  env: Env,
  tokenAddress: string,
  wallet?: string,
): Promise<void> {
  if (!wallet) return;
  try {
    const onlineKey = key('online', tokenAddress, wallet.toLowerCase());
    await getStore(env).put(onlineKey, String(Date.now()), {
      expirationTtl: 60, // 60s TTL — auto-cleanup when user leaves
    });
  } catch (err) {
    console.error('[community-store] Heartbeat failed:', err);
  }
}

export async function getOnlineCount(
  env: Env,
  tokenAddress: string,
): Promise<number> {
  try {
    const prefix = key('online', tokenAddress);
    const list = await getStore(env).list({ prefix });
    return list.keys.length;
  } catch (err) {
    console.error('[community-store] getOnlineCount failed:', err);
    return 0;
  }
}

// ─── Recent buy count ──────────────────────────────────────────────────

export async function getRecentBuyCount(
  env: Env,
  tokenAddress: string,
  windowSeconds = 3600,
): Promise<number> {
  try {
    const prefix = key('buy', 'recent', tokenAddress);
    const list = await getStore(env).list({ prefix });
    return list.keys.length;
  } catch (err) {
    console.error('[community-store] getRecentBuyCount failed:', err);
    return 0;
  }
}

// ─── Milestones ────────────────────────────────────────────────────────

export async function getMilestones(
  env: Env,
  tokenAddress: string,
): Promise<TokenMilestone[]> {
  try {
    const milestoneKey = key('milestones', tokenAddress);
    const raw = await getStore(env).get(milestoneKey);
    return raw ? (JSON.parse(raw) as TokenMilestone[]) : [];
  } catch (err) {
    console.error('[community-store] getMilestones failed:', err);
    return [];
  }
}

export async function setMilestones(
  env: Env,
  tokenAddress: string,
  milestones: TokenMilestone[],
): Promise<void> {
  const milestoneKey = key('milestones', tokenAddress);
  await getStore(env).put(milestoneKey, JSON.stringify(milestones), {
    expirationTtl: 86400 * 365, // 1 year
  });
}

export async function checkAndAwardMilestones(
  env: Env,
  tokenAddress: string,
  stats: { holders: number; volume: number; price: number; daysAlive: number },
): Promise<TokenMilestone[]> {
  const milestones = await getMilestones(env, tokenAddress);

  const milestoneDefs: Array<{
    type: TokenMilestone['type'];
    threshold: string;
    reward: string;
    condition: number;
  }> = [
    { type: 'holders', threshold: '10', reward: 'Early badge unlocked', condition: 10 },
    { type: 'holders', threshold: '50', reward: 'Trending status', condition: 50 },
    { type: 'holders', threshold: '100', reward: 'Creator stream unlocked', condition: 100 },
    { type: 'holders', threshold: '500', reward: 'HD streaming + recording', condition: 500 },
    { type: 'holders', threshold: '1000', reward: 'Custom token page theme', condition: 1000 },
    { type: 'volume', threshold: '1', reward: 'First ETH raised!', condition: 1 },
    { type: 'volume', threshold: '10', reward: 'Diamond hands badge', condition: 10 },
    { type: 'volume', threshold: '50', reward: 'Graduation eligible', condition: 50 },
    { type: 'days_alive', threshold: '7', reward: 'Week one survivor badge', condition: 7 },
    { type: 'days_alive', threshold: '30', reward: 'OG status unlocked', condition: 30 },
  ];

  const newlyReached: TokenMilestone[] = [];

  for (const def of milestoneDefs) {
    const existing = milestones.find(
      (m) => m.type === def.type && m.threshold === def.threshold,
    );
    if (existing?.reached) continue;

    const currentValue =
      def.type === 'holders'
        ? stats.holders
        : def.type === 'volume'
          ? stats.volume
          : stats.daysAlive;

    const thresholdNum = Number(def.threshold);
    if (currentValue >= thresholdNum) {
      const ms: TokenMilestone = {
        id: crypto.randomUUID(),
        tokenAddress,
        type: def.type,
        threshold: def.threshold,
        reached: true,
        reachedAt: Date.now(),
        reward: def.reward,
      };
      milestones.push(ms);
      newlyReached.push(ms);
    }
  }

  await setMilestones(env, tokenAddress, milestones);
  return newlyReached;
}

// ─── Holder leaderboard ────────────────────────────────────────────────

export interface HolderEntry {
  wallet: string;
  amount: string;
  percentage: number;
  usdValue: number;
  badges: string[];
  isCreator: boolean;
}

export async function getHolderLeaderboard(
  env: Env,
  tokenAddress: string,
  limit = 10,
): Promise<HolderEntry[]> {
  try {
    const prefix = key('holder', tokenAddress);
    const list = await getStore(env).list({ prefix, limit: limit + 10 });

    const entries: HolderEntry[] = [];
    for (const k of list.keys) {
      const raw = await getStore(env).get(k.name);
      if (raw) {
        try {
          entries.push(JSON.parse(raw) as HolderEntry);
        } catch {
          // skip corrupt entries
        }
      }
    }

    // Sort by amount descending
    entries.sort((a, b) => Number(b.amount) - Number(a.amount));
    return entries.slice(0, limit);
  } catch (err) {
    console.error('[community-store] getHolderLeaderboard failed:', err);
    return [];
  }
}

// ─── Author enrichment ─────────────────────────────────────────────────

async function enrichWithAuthorHandles(
  _env: Env,
  comments: TokenComment[],
): Promise<TokenComment[]> {
  // In a production system, this would look up ENS/BNS/UD names or
  // cached identity profiles. For now, we return comments as-is since
  // the frontend can resolve handles from wallet addresses.
  return comments;
}
