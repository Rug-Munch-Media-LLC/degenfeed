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
import { checkPremiumStatus } from '../premium';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import type { Env } from '../types';

// ─── Constants ──────────────────────────────────────────────────────

const MEILISEARCH_URL = 'https://search.degenfeed.xyz';
const ANALYTICS_CACHE_TTL = 120; // 2 minutes for freshness
const GTS_INSTANCE = 'https://social.degenfeed.xyz';
const FARCASTER_DEFAULT_HUB = 'http://127.0.0.1:2281';
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
    last10: {
      amount: string;
      currency: string;
      protocol: string;
      createdAt: number;
    }[];
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
  premium: {
    tier: string;
    csvExport: boolean;
    lookbackDays: number;
  };
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
    return {
      followers: account.followers_count ?? 0,
      statuses: account.statuses_count ?? 0,
    };
  } catch {
    return null;
  }
}

async function fetchFarcasterProfile(
  fid: number,
  _hubUrl?: string,
): Promise<{
  followers: number;
  displayName: string;
  username: string;
} | null> {
  // Primary: Hubble for user data
  const hubUrl = 'http://127.0.0.1:2281';
  try {
    const res = await fetch(`${hubUrl}/v1/userDataByFid?fid=${fid}`, {
      headers: {
        accept: 'application/json',
        'user-agent': 'DegenFeed/0.1',
      },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const messages = (await res.json()) as {
        messages?: Array<{ data: { userDataBody: { type: string; value: string } } }>;
      };
      let username = '';
      let displayName = '';
      for (const msg of messages?.messages ?? []) {
        const body = msg.data?.userDataBody;
        if (!body) continue;
        if (body.type === 'USER_DATA_TYPE_USERNAME') username = body.value;
        else if (body.type === 'USER_DATA_TYPE_DISPLAY') displayName = body.value;
      }
      return {
        followers: 0, // Hubble doesn't expose follower counts directly
        displayName: displayName || username || '',
        username: username || '',
      };
    }
  } catch {
    // fallback
  }

  // Fallback: read from hub directly
  try {
    const hubUrl = FARCASTER_DEFAULT_HUB;
    const res = await fetch(`${hubUrl}/v1/userDataByFid?fid=${fid}`, {
      headers: { accept: 'application/json', 'user-agent': 'DegenFeed/0.1' },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = (await res.json()) as {
        messages?: Array<{
          data: { userDataBody: { type: string; value: string } };
        }>;
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
      headers: {
        'content-type': 'application/json',
        'user-agent': 'DegenFeed/0.1',
      },
      body: JSON.stringify({
        query,
        variables: { request: { forProfileId: profileId } },
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: {
        profile?: {
          handle?: { localName?: string };
          stats?: { followers?: number };
        };
      };
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
    const profile = (await res.json()) as {
      followersCount?: number;
      postsCount?: number;
    };
    return {
      followers: profile.followersCount ?? 0,
      posts: profile.postsCount ?? 0,
    };
  } catch {
    return null;
  }
}

async function fetchNostrProfile(pubkey: string): Promise<{ followers: number } | null> {
  // nostr.band expects hex pubkey — convert npub if needed
  let hexKey = pubkey;
  if (pubkey.startsWith('npub1')) {
    try {
      // Dynamic import for npub decode
      const mod = await import('@degenfeed/nostr-sdk');
      const decoded = mod.npubDecode(pubkey);
      if (decoded && typeof decoded === 'string') hexKey = decoded;
    } catch {
      // If decode fails, try the npub directly (nostr.band may handle it)
    }
  }

  try {
    const res = await fetch(`https://api.nostr.band/v0/profile/${hexKey}`, {
      headers: { accept: 'application/json', 'user-agent': 'DegenFeed/0.1' },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = (await res.json()) as {
        profiles?: Record<string, { content?: string; follower_count?: number }>;
      };
      const profile = data?.profiles?.[hexKey];
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

async function searchMeiliPosts(
  authorQueries: string[],
  protocols: string[],
  apiKey?: string,
): Promise<MeiliHit[]> {
  if (authorQueries.length === 0) return [];

  try {
    const allProtocols = protocols.map((p) => JSON.stringify(p)).join(', ');
    const queries = authorQueries.map((q) => q.trim()).filter(Boolean);
    if (queries.length === 0) return [];

    const primaryQuery = queries[0];
    const headers: Record<string, string> = {
      'content-type': 'application/json',
    };
    if (apiKey) headers.authorization = `Bearer ${apiKey}`;

    const body: Record<string, unknown> = {
      q: primaryQuery,
      limit: 100,
      filter: `protocol IN [${allProtocols}]`,
      attributesToSearchOn: ['authorDisplayName', 'text'],
    };

    const res = await fetch(`${MEILISEARCH_URL}/indexes/posts/search`, {
      method: 'POST',
      headers,
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
    result.push({
      protocol: 'nostr',
      pubkey: identity.nostr.npub,
      handle: identity.nostr.npub,
    });
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
      instance: identity.mastodon.instance || GTS_INSTANCE,
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
    return jsonResponse({ error: 'wallet required' }, 400);
  }

  // ── Premium tier determines lookback window ──────────────────────
  // Free users:   7-day lookback
  // Pro+:         90-day lookback with CSV export flag
  const premium = await checkPremiumStatus(wallet, env);
  const isPremium = !!premium;
  const LOOKBACK_DAYS = isPremium ? 90 : 7;
  const LOOKBACK_MS = LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
  const csvExport = isPremium;

  const cacheKey = `analytics:${wallet}`;
  const refreshLockKey = `analytics:refresh:${wallet}`;

  // ── 0. Refresh cooldown check ─────────────────────────────────
  // If a refresh is already in progress (started <5min ago), return cached data
  if (forceRefresh) {
    try {
      const inProgress = await env.CACHE?.get(refreshLockKey);
      if (inProgress) {
        // Refresh already in progress — return cached data if available
        const cached = await env.CACHE?.get(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached) as AnalyticsResponse;
          return noCacheJsonResponse(parsed);
        }
      }
    } catch {
      /* ignore lock errors */
    }
  }

  // Set refresh lock (5-minute cooldown)
  if (forceRefresh) {
    try {
      await env.CACHE?.put(refreshLockKey, '1', { expirationTtl: 300 });
    } catch {
      /* lock storage failure */
    }
  }

  // Check cache for non-forced-refresh requests
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
    connectedProtocols.length > 0
      ? await searchMeiliPosts(searchQueries, connectedNames, env.MEILI_SEARCH_KEY)
      : [];

  // Aggregate by day (lookback window) and weekday
  const now = Date.now();
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
    if (createdAt && createdAt > now - LOOKBACK_MS) {
      const isoKey = new Date(createdAt).toISOString().slice(0, 10);
      dayBuckets[isoKey] = (dayBuckets[isoKey] || 0) + 1;

      const dow = new Date(createdAt).getDay();
      weekdayBuckets[dow] = (weekdayBuckets[dow] || 0) + 1;
    }
  }

  // Build day arrays for lookback window
  const dayData: number[] = [];
  const dayLabelOutput: string[] = [];
  for (let i = LOOKBACK_DAYS - 1; i >= 0; i--) {
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
  const tipData = await aggregateTips(env, wallet, LOOKBACK_MS);
  const { tips, topTipPosts } = tipData;

  // ── 5. Load growth history from KV cache (or generate) ──────
  const growthData = await loadGrowthHistory(env, wallet, totalFollowers, LOOKBACK_DAYS);

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
    premium: {
      tier: premium?.tier ?? 'free',
      csvExport,
      lookbackDays: LOOKBACK_DAYS,
    },
  };

  // Cache for 2 minutes
  try {
    await env.CACHE?.put(cacheKey, JSON.stringify(response), {
      expirationTtl: ANALYTICS_CACHE_TTL,
    });
  } catch {
    /* cache unavailable */
  }

  // ── 9. Write daily growth snapshot ─────────────────────────
  void writeDailyGrowthSnapshot(env, wallet, totalFollowers, tips.totalUsd, meiliPosts.length);

  // Attach premium header when feature is gated
  const resp = noCacheJsonResponse(response);
  if (!isPremium) {
    const headers = new Headers(resp.headers);
    headers.set('X-Premium-Required', 'Pro');
    return new Response(resp.body, {
      status: resp.status,
      statusText: resp.statusText,
      headers,
    });
  }
  return resp;
}

// ─── Tip aggregation from KV notifications ────────────────────────

async function aggregateTips(
  env: Env,
  wallet: string,
  lookbackMs: number,
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
    last10: {
      amount: string;
      currency: string;
      protocol: string;
      createdAt: number;
    }[];
  };
  topTipPosts: TopPost[];
}> {
  const now = Date.now();

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

    // Daily buckets (lookback window only)
    if (tip.createdAt > now - lookbackMs) {
      const dayKey = new Date(tip.createdAt).toISOString().slice(0, 10);
      dailyBuckets[dayKey] = (dailyBuckets[dayKey] ?? 0) + usdValue;
    }

    // Tippers
    const tipperName = tip.actorName || tip.actorHandle || 'Anonymous';
    tippers[tipperName] = (tippers[tipperName] ?? 0) + usdValue;
  }

  // Build daily tip history (lookback window)
  const tipDays = Math.floor(lookbackMs / (24 * 60 * 60 * 1000));
  const historyLabels: string[] = [];
  const history30d: number[] = [];
  for (let i = tipDays - 1; i >= 0; i--) {
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
    .map(([name, total]) => ({
      name,
      totalUsd: Math.round(total * 100) / 100,
    }));

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
  lookbackDays: number,
): Promise<{ growth: number[]; labels: string[] }> {
  const labels = generateDateLabels(lookbackDays - 1);
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

  // Append today's total and trim to lookback window
  history.push(totalFollowers);
  if (history.length > lookbackDays) {
    history = history.slice(-lookbackDays);
  }

  // Backfill if needed — ensure we have exactly lookbackDays entries
  while (history.length < lookbackDays) {
    if (history.length === 0) {
      history.push(totalFollowers > 0 ? totalFollowers : 0);
    } else {
      history.push(history[history.length - 1] ?? totalFollowers);
    }
  }

  // Persist with TTL matching lookback (min 30, max 90 days)
  const ttlDays = Math.max(30, Math.min(lookbackDays, 90));
  try {
    await env.CACHE?.put(growthKey, JSON.stringify(history), {
      expirationTtl: 86400 * ttlDays,
    });
  } catch {
    /* KV operation failed -- non-critical, continue */
  }

  // Use last lookbackDays labels (most recent)
  const recentLabels = labels.slice(-lookbackDays);
  const recentGrowth = history.slice(-lookbackDays);

  return { growth: recentGrowth, labels: recentLabels };
}

// ─── Daily growth snapshot ────────────────────────────────────────

/**
 * Writes today's follower/tip/post snapshot to KV for historical tracking.
 * Stored under `analytics:growth:{wallet}:{YYYY-MM-DD}` with 90-day TTL.
 * Also maintains a list of snapshot dates under `analytics:growth:{wallet}:days`.
 */
async function writeDailyGrowthSnapshot(
  env: Env,
  wallet: string,
  followers: number,
  tipsUsd: number,
  posts: number,
): Promise<void> {
  if (!env.CACHE) return;
  const today = new Date().toISOString().slice(0, 10);

  try {
    // Write daily snapshot with 90-day retention
    await env.CACHE.put(
      `analytics:growth:${wallet}:${today}`,
      JSON.stringify({ followers, tipsUsd, posts, date: today }),
      { expirationTtl: 86400 * 90 },
    );

    // Append to the date index (list of snapshot dates)
    const daysKey = `analytics:growth:${wallet}:days`;
    const raw = await env.CACHE.get(daysKey);
    const days: string[] = raw ? (JSON.parse(raw) as string[]) : [];
    if (!days.includes(today)) {
      days.push(today);
      // Keep only last 90 days
      const trimmed = days.slice(-90);
      await env.CACHE.put(daysKey, JSON.stringify(trimmed), {
        expirationTtl: 86400 * 90,
      });
    }
  } catch {
    /* snapshot write failure is non-fatal */
  }
}
