/**
 * @degenfeed/api-worker — Creator Analytics
 *
 * GET /api/analytics?wallet=0x...
 *
 * Aggregates real data across ALL connected protocols for a unified
 * creator dashboard. Data sources:
 *   - KV identities        → linked protocol accounts
 *   - Protocol APIs        → follower counts per platform
 *   - MeiliSearch          → post engagement metrics by author
 *   - KV notifications     → tip history aggregated by wallet
 *   - KV analytics cache   → historical snapshots for growth computation
 */

import type { CrossProtocolIdentity } from '@degenfeed/utils';
import { identityKey } from '@degenfeed/utils';
import { type Env, noCacheJsonResponse } from '../index';

// ─── Constants ──────────────────────────────────────────────────────

const MEILISEARCH_URL = 'https://search.degenfeed.xyz';
const ANALYTICS_CACHE_TTL = 120; // 2 minutes for freshness
const MASTODON_INSTANCE = 'https://social.degenfeed.xyz';
const FARCASTER_DEFAULT_HUB = 'https://hub.farcaster.standardcrypto.vc:2281';
const LENS_DEFAULT_API = 'https://api-v2.lens.dev/graphql';
const BSKY_PUBLIC_API = 'https://public.api.bsky.app';

const ALL_PROTOCOLS = ['nostr', 'farcaster', 'lens', 'bluesky', 'mastodon'] as const;

// ─── Types ──────────────────────────────────────────────────────────

interface AnalyticsResponse {
  followers: {
    total: number;
    byProtocol: Record<string, number>;
    growth30d: number[];
    growthLabels: string[];
  };
  posts: {
    total: number;
    byDay: number[];
    dayLabels: string[];
    byWeekday: number[];
    weekdayLabels: string[];
    totalTopLevel: number;
    totalReplies: number;
  };
  tips: {
    totalUsd: number;
    byCurrency: Record<string, number>;
    byProtocol: Record<string, number>;
    history30d: number[];
    historyLabels: string[];
    totalDegen: number;
    totalEth: number;
    totalSol: number;
    totalBtc: number;
    topTippers: { name: string; totalUsd: number }[];
    last10: { amount: string; currency: string; protocol: string; createdAt: number }[];
  };
  engagement: {
    rate: number;
    totalLikes: number;
    totalReposts: number;
    totalReplies: number;
    byProtocol: Record<string, { likes: number; reposts: number; replies: number }>;
  };
  topPosts: TopPost[];
  topTipPosts: TopPost[];
  audience: {
    byProtocol: Record<string, number>;
    byInstance: Record<string, number>;
    locations: Record<string, number>;
    byCommunity: { name: string; count: number }[];
  };
  protocols: {
    connected: string[];
    missing: string[];
  };
  lastUpdated: number;
  isMock: boolean;
}

interface TopPost {
  id: string;
  protocol: string;
  content: string;
  likes: number;
  reposts: number;
  replies: number;
  tips: number;
  tipsUsd: number;
  createdAt: string;
}

// ─── MeiliSearch shapes ────────────────────────────────────────────

interface MeiliHit {
  id: string;
  originalId?: string;
  protocol: string;
  text: string;
  authorDisplayName: string;
  authorAvatarUrl: string | null;
  createdAt: number;
  likes: number;
  reposts: number;
  replies: number;
  quotes: number;
}

interface MeiliResponse {
  hits: MeiliHit[];
  total: number;
}

// ─── Notification shape (for tip aggregation) ──────────────────────

interface TipNotification {
  id: string;
  type: string;
  protocol: string;
  sourceProtocol?: string;
  actorName: string;
  actorHandle: string;
  amount?: string;
  currency?: string;
  createdAt: number;
  read: boolean;
}

// ─── Helper: date labels ───────────────────────────────────────────

function dateLabel(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function generateDateLabels(days: number): string[] {
  const labels: string[] = [];
  for (let i = days; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    labels.push(dateLabel(d));
  }
  return labels;
}

// ─── Protocol API helpers (follower counts, profile stats) ─────────

async function fetchMastodonFollowers(
  handle: string,
  instance: string,
): Promise<{ followers: number; statuses: number } | null> {
  try {
    const res = await fetch(
      `${instance}/api/v1/accounts/lookup?acct=${encodeURIComponent(handle)}`,
      {
        headers: { accept: 'application/json', 'user-agent': 'DegenFeed/0.1' },
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!res.ok) return null;
    const account = (await res.json()) as {
      followers_count: number;
      statuses_count: number;
    };
    return { followers: account.followers_count ?? 0, statuses: account.statuses_count ?? 0 };
  } catch {
    return null;
  }
}

async function fetchFarcasterProfile(
  fid: number,
): Promise<{ followers: number; displayName: string; username: string } | null> {
  // Use the public API for follower counts (Neynar compatible)
  try {
    const res = await fetch(`https://api.farcaster.xyz/v2/user?fid=${fid}`, {
      headers: { accept: 'application/json', 'user-agent': 'DegenFeed/0.1' },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = (await res.json()) as {
        user?: { username?: string; displayName?: string; followerCount?: number };
      };
      if (data?.user) {
        return {
          followers: data.user.followerCount ?? 0,
          displayName: data.user.displayName ?? data.user.username ?? '',
          username: data.user.username ?? '',
        };
      }
    }
  } catch {
    // fallback
  }

  // Fallback: Hub for user data, but Hub doesn't expose follower counts directly
  try {
    const hubUrl = FARCASTER_DEFAULT_HUB;
    const res = await fetch(`${hubUrl}/v1/userDataByFid?fid=${fid}`, {
      headers: { accept: 'application/json', 'user-agent': 'DegenFeed/0.1' },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = (await res.json()) as {
        messages?: Array<{ data: { userDataBody: { type: string; value: string } } }>;
      };
      let username = `fid:${fid}`;
      for (const msg of data.messages ?? []) {
        const body = msg.data?.userDataBody;
        if (body?.type === 'USER_DATA_TYPE_USERNAME') username = body.value;
      }
      return { followers: 0, displayName: username, username }; // follower count unavailable from Hub
    }
  } catch {
    // ignore
  }
  return null;
}

async function fetchLensProfile(
  profileId: string,
): Promise<{ followers: number; handle: string } | null> {
  try {
    const query = `query Profile($request: ProfileRequest!) {
      profile(request: $request) {
        handle { localName }
        stats { followers }
      }
    }`;
    const res = await fetch(LENS_DEFAULT_API, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': 'DegenFeed/0.1' },
      body: JSON.stringify({ query, variables: { request: { forProfileId: profileId } } }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: { profile?: { handle?: { localName?: string }; stats?: { followers?: number } } };
    };
    const profile = json?.data?.profile;
    if (!profile) return null;
    return {
      followers: profile.stats?.followers ?? 0,
      handle: profile.handle?.localName ?? profileId,
    };
  } catch {
    return null;
  }
}

async function fetchBlueskyProfile(
  handle: string,
): Promise<{ followers: number; posts: number } | null> {
  try {
    const res = await fetch(
      `${BSKY_PUBLIC_API}/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(handle)}`,
      {
        headers: { accept: 'application/json', 'user-agent': 'DegenFeed/0.1' },
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!res.ok) return null;
    const profile = (await res.json()) as { followersCount?: number; postsCount?: number };
    return { followers: profile.followersCount ?? 0, posts: profile.postsCount ?? 0 };
  } catch {
    return null;
  }
}

async function fetchNostrProfile(pubkey: string): Promise<{ followers: number } | null> {
  try {
    const res = await fetch(`https://api.nostr.band/v0/profile/${pubkey}`, {
      headers: { accept: 'application/json', 'user-agent': 'DegenFeed/0.1' },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = (await res.json()) as {
        profiles?: Record<string, { content?: string; follower_count?: number }>;
      };
      const profile = data?.profiles?.[pubkey];
      if (profile?.follower_count !== undefined) {
        return { followers: profile.follower_count };
      }
    }
  } catch {
    // ignore
  }
  return null;
}

// ─── MeiliSearch queries ──────────────────────────────────────────

async function searchMeiliPosts(authorQueries: string[], protocols: string[]): Promise<MeiliHit[]> {
  if (authorQueries.length === 0) return [];

  try {
    const allProtocols = protocols.map((p) => JSON.stringify(p)).join(', ');
    const queries = authorQueries.map((q) => q.trim()).filter(Boolean);
    if (queries.length === 0) return [];

    const primaryQuery = queries[0];
    const body: Record<string, unknown> = {
      q: primaryQuery,
      limit: 100,
      filter: `protocol IN [${allProtocols}]`,
      attributesToSearchOn: ['authorDisplayName', 'text'],
    };

    const res = await fetch(`${MEILISEARCH_URL}/indexes/posts/search`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as MeiliResponse;
    return data.hits ?? [];
  } catch {
    return [];
  }
}

// ─── Follower count fetch per protocol ────────────────────────────

interface ProtocolIdentity {
  protocol: string;
  handle?: string;
  pubkey?: string;
  fid?: number;
  profileId?: string;
  did?: string;
  instance?: string;
}

function extractProtocolIdentities(identity: CrossProtocolIdentity): ProtocolIdentity[] {
  const result: ProtocolIdentity[] = [];
  if (identity.nostr?.npub) {
    result.push({ protocol: 'nostr', pubkey: identity.nostr.npub, handle: identity.nostr.npub });
  }
  if (identity.farcaster?.fid) {
    result.push({
      protocol: 'farcaster',
      fid: identity.farcaster.fid,
      handle: identity.farcaster.username,
    });
  }
  if (identity.lens?.profileId) {
    result.push({
      protocol: 'lens',
      profileId: identity.lens.profileId,
      handle: identity.lens.handle,
    });
  }
  if (identity.bluesky?.handle) {
    result.push({
      protocol: 'bluesky',
      handle: identity.bluesky.handle,
      did: identity.bluesky.did,
    });
  }
  if (identity.mastodon?.handle) {
    result.push({
      protocol: 'mastodon',
      handle: identity.mastodon.handle,
      instance: identity.mastodon.instance || MASTODON_INSTANCE,
    });
  }
  return result;
}

function extractSearchQueries(protocols: ProtocolIdentity[]): string[] {
  const queries: string[] = [];
  for (const p of protocols) {
    if (p.handle) queries.push(p.handle);
    if (p.protocol === 'nostr' && p.pubkey) queries.push(p.pubkey);
    if (p.protocol === 'farcaster' && p.fid) queries.push(`fid:${p.fid}`);
  }
  return queries;
}

// ─── Main handler ─────────────────────────────────────────────────

export async function handleAnalytics(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const wallet = url.searchParams.get('wallet')?.toLowerCase();
  const forceRefresh = url.searchParams.get('refresh') === 'true';

  if (!wallet) {
    return new Response(JSON.stringify({ error: 'wallet required' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  // Check cache for non-forced-refresh requests
  const cacheKey = `analytics:${wallet}`;
  if (!forceRefresh) {
    try {
      const cached = await env.CACHE?.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as AnalyticsResponse;
        return noCacheJsonResponse(parsed);
      }
    } catch {
      /* cache miss — compute fresh */
    }
  }

  // ── 1. Resolve linked identities from KV ──────────────────────
  let identity: CrossProtocolIdentity | null = null;
  try {
    const raw = await env.IDENTITIES?.get(identityKey(wallet));
    if (raw) identity = JSON.parse(raw) as CrossProtocolIdentity;
  } catch {
    /* no identity record */
  }

  const connectedProtocols = identity ? extractProtocolIdentities(identity) : [];
  const connectedNames = connectedProtocols.map((p) => p.protocol);
  const missingProtocols = ALL_PROTOCOLS.filter((p) => !connectedNames.includes(p));

  // ── 2. Fetch follower counts from each protocol API ───────────
  const followersByProtocol: Record<string, number> = {};
  const protocolFetchPromises: Promise<void>[] = [];

  for (const p of connectedProtocols) {
    switch (p.protocol) {
      case 'mastodon':
        if (p.handle && p.instance) {
          protocolFetchPromises.push(
            fetchMastodonFollowers(p.handle, p.instance).then((r) => {
              if (r) followersByProtocol.mastodon = r.followers;
            }),
          );
        }
        break;
      case 'farcaster':
        if (p.fid) {
          protocolFetchPromises.push(
            fetchFarcasterProfile(p.fid).then((r) => {
              if (r) followersByProtocol.farcaster = r.followers;
            }),
          );
        }
        break;
      case 'lens':
        if (p.profileId) {
          protocolFetchPromises.push(
            fetchLensProfile(p.profileId).then((r) => {
              if (r) followersByProtocol.lens = r.followers;
            }),
          );
        }
        break;
      case 'bluesky':
        if (p.handle) {
          protocolFetchPromises.push(
            fetchBlueskyProfile(p.handle).then((r) => {
              if (r) followersByProtocol.bluesky = r.followers;
            }),
          );
        }
        break;
      case 'nostr':
        if (p.pubkey) {
          protocolFetchPromises.push(
            fetchNostrProfile(p.pubkey).then((r) => {
              if (r) followersByProtocol.nostr = r.followers;
            }),
          );
        }
        break;
    }
  }

  await Promise.allSettled(protocolFetchPromises);

  const totalFollowers = Object.values(followersByProtocol).reduce((s, v) => s + v, 0);

  // ── 3. Query MeiliSearch for post engagement ─────────────────
  const searchQueries = extractSearchQueries(connectedProtocols);
  const meiliPosts =
    connectedProtocols.length > 0 ? await searchMeiliPosts(searchQueries, connectedNames) : [];

  // Aggregate by day (last 30 days) and weekday
  const now = Date.now();
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const dayBuckets: Record<string, number> = {};
  const weekdayBuckets = [0, 0, 0, 0, 0, 0, 0]; // Sun=0...Sat=6

  let totalLikes = 0;
  let totalReposts = 0;
  let totalReplies = 0;
  const engagementByProtocol: Record<string, { likes: number; reposts: number; replies: number }> =
    {};

  for (const post of meiliPosts) {
    totalLikes += post.likes ?? 0;
    totalReposts += post.reposts ?? 0;
    totalReplies += post.replies ?? 0;

    const proto = post.protocol || 'unknown';
    if (!engagementByProtocol[proto]) {
      engagementByProtocol[proto] = { likes: 0, reposts: 0, replies: 0 };
    }
    engagementByProtocol[proto].likes += post.likes ?? 0;
    engagementByProtocol[proto].reposts += post.reposts ?? 0;
    engagementByProtocol[proto].replies += post.replies ?? 0;

    // Day bucketing
    const createdAt = post.createdAt;
    if (createdAt && createdAt > now - THIRTY_DAYS_MS) {
      const isoKey = new Date(createdAt).toISOString().slice(0, 10);
      dayBuckets[isoKey] = (dayBuckets[isoKey] || 0) + 1;

      const dow = new Date(createdAt).getDay();
      weekdayBuckets[dow] = (weekdayBuckets[dow] || 0) + 1;
    }
  }

  // Build day arrays for last 30 days
  const dayData: number[] = [];
  const dayLabelOutput: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const isoKey = d.toISOString().slice(0, 10);
    dayData.push(dayBuckets[isoKey] || 0);
    dayLabelOutput.push(dateLabel(d));
  }

  // Top posts by engagement
  const sortedByEngagement = [...meiliPosts]
    .sort((a, b) => (b.likes ?? 0) + (b.reposts ?? 0) * 2 - ((a.likes ?? 0) + (a.reposts ?? 0) * 2))
    .slice(0, 10);

  const topPosts: TopPost[] = sortedByEngagement.map((p) => ({
    id: p.originalId ?? p.id,
    protocol: p.protocol,
    content: p.text?.slice(0, 200) ?? '',
    likes: p.likes ?? 0,
    reposts: p.reposts ?? 0,
    replies: p.replies ?? 0,
    tips: 0,
    tipsUsd: 0,
    createdAt: new Date(p.createdAt).toISOString(),
  }));

  // ── 4. Aggregate tip data from KV notifications ──────────────
  const tipData = await aggregateTips(env, wallet);
  const { tips, topTipPosts } = tipData;

  // ── 5. Load growth history from KV cache (or generate) ──────
  const growthData = await loadGrowthHistory(env, wallet, totalFollowers);

  // ── 6. Engagement rate ──────────────────────────────────────
  const totalEngagements = totalLikes + totalReposts + totalReplies;
  const engagementRate =
    totalFollowers > 0 ? totalEngagements / (totalFollowers * Math.max(meiliPosts.length, 1)) : 0;

  // ── 7. Build audience data ──────────────────────────────────
  const audienceByProtocol: Record<string, number> = {};
  for (const [proto, count] of Object.entries(followersByProtocol)) {
    if (count > 0) audienceByProtocol[proto] = count;
  }

  // ── 8. Assemble response ────────────────────────────────────
  const response: AnalyticsResponse = {
    followers: {
      total: totalFollowers,
      byProtocol: followersByProtocol,
      growth30d: growthData.growth,
      growthLabels: growthData.labels,
    },
    posts: {
      total: meiliPosts.length,
      byDay: dayData,
      dayLabels: dayLabelOutput,
      byWeekday: weekdayBuckets,
      weekdayLabels: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      totalTopLevel: 0,
      totalReplies: 0,
    },
    tips: {
      totalUsd: tips.totalUsd,
      byCurrency: tips.byCurrency,
      byProtocol: tips.byProtocol,
      history30d: tips.history30d,
      historyLabels: tips.historyLabels,
      totalDegen: tips.totalDegen,
      totalEth: tips.totalEth,
      totalSol: tips.totalSol,
      totalBtc: tips.totalBtc,
      topTippers: tips.topTippers,
      last10: tips.last10,
    },
    engagement: {
      rate: Math.min(engagementRate, 1),
      totalLikes,
      totalReposts,
      totalReplies,
      byProtocol: engagementByProtocol,
    },
    topPosts,
    topTipPosts,
    audience: {
      byProtocol: audienceByProtocol,
      byInstance: {},
      locations: {},
      byCommunity: [],
    },
    protocols: {
      connected: connectedNames.length > 0 ? connectedNames : [],
      missing: missingProtocols,
    },
    lastUpdated: Date.now(),
    isMock: connectedProtocols.length === 0,
  };

  // Cache for 2 minutes
  try {
    await env.CACHE?.put(cacheKey, JSON.stringify(response), {
      expirationTtl: ANALYTICS_CACHE_TTL,
    });
  } catch {
    /* cache unavailable */
  }

  return noCacheJsonResponse(response);
}

// ─── Tip aggregation from KV notifications ────────────────────────

async function aggregateTips(
  env: Env,
  wallet: string,
): Promise<{
  tips: {
    totalUsd: number;
    byCurrency: Record<string, number>;
    byProtocol: Record<string, number>;
    history30d: number[];
    historyLabels: string[];
    totalDegen: number;
    totalEth: number;
    totalSol: number;
    totalBtc: number;
    topTippers: { name: string; totalUsd: number }[];
    last10: { amount: string; currency: string; protocol: string; createdAt: number }[];
  };
  topTipPosts: TopPost[];
}> {
  const now = Date.now();
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

  // Fetch tip notifications from KV
  const notifications: TipNotification[] = [];
  try {
    const raw = await env.CACHE?.get(`notifications:${wallet}`);
    if (raw) {
      const parsed = JSON.parse(raw) as TipNotification[];
      notifications.push(...parsed.filter((n) => n.type === 'tip'));
    }
  } catch {
    /* no notifications */
  }

  // Also check lowercased key
  try {
    const raw = await env.CACHE?.get(`notifications:${wallet.toLowerCase()}`);
    if (raw) {
      const parsed = JSON.parse(raw) as TipNotification[];
      notifications.push(...parsed.filter((n) => n.type === 'tip'));
    }
  } catch {
    /* no fallback notifications */
  }

  // Deduplicate by id
  const seen = new Set<string>();
  const uniqueTips = notifications.filter((n) => {
    if (seen.has(n.id)) return false;
    seen.add(n.id);
    return true;
  });

  // Last 10 raw tips
  const last10 = uniqueTips
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 10)
    .map((n) => ({
      amount: n.amount ?? '0',
      currency: n.currency ?? 'unknown',
      protocol: n.sourceProtocol ?? n.protocol ?? 'unknown',
      createdAt: n.createdAt,
    }));

  // Aggregate by currency, protocol, and daily buckets
  const byCurrency: Record<string, number> = {};
  const byProtocol: Record<string, number> = {};
  const dailyBuckets: Record<string, number> = {};
  const tippers: Record<string, number> = {};

  // Simple USD conversion approximations
  const usdRates: Record<string, number> = {
    eth: 3200,
    ETH: 3200,
    sol: 140,
    SOL: 140,
    btc: 62000,
    BTC: 62000,
    usdc: 1,
    USDC: 1,
    degen: 0.005,
    DEGEN: 0.005,
    base: 3200,
    matic: 0.5,
    MATIC: 0.5,
    unknown: 1,
  };

  let totalUsd = 0;
  let totalDegen = 0;
  let totalEth = 0;
  let totalSol = 0;
  let totalBtc = 0;

  for (const tip of uniqueTips) {
    const rawAmount = Number.parseFloat(tip.amount ?? '0');
    const currency = (tip.currency ?? 'unknown').toLowerCase();

    byCurrency[currency] = (byCurrency[currency] ?? 0) + rawAmount;

    if (currency === 'degen' || tip.currency === 'DEGEN') totalDegen += rawAmount;
    if (currency === 'eth' || tip.currency === 'ETH') totalEth += rawAmount;
    if (currency === 'sol' || tip.currency === 'SOL') totalSol += rawAmount;
    if (currency === 'btc' || tip.currency === 'BTC') totalBtc += rawAmount;

    const rate = usdRates[tip.currency ?? ''] ?? usdRates[currency] ?? 1;
    const usdValue = rawAmount * rate;
    totalUsd += usdValue;

    const proto = tip.sourceProtocol ?? tip.protocol ?? 'unknown';
    byProtocol[proto] = (byProtocol[proto] ?? 0) + usdValue;

    // Daily buckets (last 30 days only)
    if (tip.createdAt > now - THIRTY_DAYS) {
      const dayKey = new Date(tip.createdAt).toISOString().slice(0, 10);
      dailyBuckets[dayKey] = (dailyBuckets[dayKey] ?? 0) + usdValue;
    }

    // Tippers
    const tipperName = tip.actorName || tip.actorHandle || 'Anonymous';
    tippers[tipperName] = (tippers[tipperName] ?? 0) + usdValue;
  }

  // Build daily tip history (30 days)
  const historyLabels: string[] = [];
  const history30d: number[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const isoKey = d.toISOString().slice(0, 10);
    historyLabels.push(dateLabel(d));
    history30d.push(dailyBuckets[isoKey] || 0);
  }

  // Top tippers
  const topTippers = Object.entries(tippers)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([name, total]) => ({ name, totalUsd: Math.round(total * 100) / 100 }));

  return {
    tips: {
      totalUsd: Math.round(totalUsd * 100) / 100,
      byCurrency,
      byProtocol,
      history30d,
      historyLabels,
      totalDegen: Math.round(totalDegen * 100) / 100,
      totalEth: Math.round(totalEth * 10000) / 10000,
      totalSol: Math.round(totalSol * 100) / 100,
      totalBtc,
      topTippers,
      last10,
    },
    topTipPosts: [],
  };
}

// ─── Growth history ────────────────────────────────────────────────

async function loadGrowthHistory(
  env: Env,
  wallet: string,
  totalFollowers: number,
): Promise<{ growth: number[]; labels: string[] }> {
  const labels = generateDateLabels(29);
  const growthKey = `analytics:growth:${wallet}`;

  // Load existing history from KV
  let history: number[] = [];
  try {
    const raw = await env.CACHE?.get(growthKey);
    if (raw) {
      history = JSON.parse(raw) as number[];
    }
  } catch {
    /* no history */
  }

  // Append today's total and trim to 30 entries
  history.push(totalFollowers);
  if (history.length > 30) {
    history = history.slice(-30);
  }

  // Backfill if needed — ensure we have exactly 30 entries
  while (history.length < 30) {
    if (history.length === 0) {
      history.push(totalFollowers > 0 ? totalFollowers : 0);
    } else {
      history.push(history[history.length - 1] ?? totalFollowers);
    }
  }

  // Persist
  try {
    await env.CACHE?.put(growthKey, JSON.stringify(history), { expirationTtl: 86400 * 30 });
  } catch {
    /* ignore */
  }

  // Use the last 30 labels (most recent)
  const recentLabels = labels.slice(-30);
  const recentGrowth = history.slice(-30);

  return { growth: recentGrowth, labels: recentLabels };
}
