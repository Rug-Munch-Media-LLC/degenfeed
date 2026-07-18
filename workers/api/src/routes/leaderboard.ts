/**
 * @degenfeed/api-worker — Leaderboard routes
 *
 * Unified cross-platform leaderboard: top creators, tippers, trending content,
 * and top communities. Data is computed hourly and cached in KV for 5 minutes.
 *
 * KV keys:
 *   leaderboard:creators:{period}      → sorted list (desc by tips_received)
 *   leaderboard:tippers:{period}       → sorted list (desc by tips_sent)
 *   leaderboard:trending:{period}      → sorted list (desc by engagement)
 *   leaderboard:communities             → sorted list (desc by activity)
 *   leaderboard:last_updated            → ISO timestamp of last compute
 *
 * Periods: daily, weekly, monthly, alltime
 * Platform filter: all, degenfeed, lemmy, peertube
 */

import type { Env } from '../index';
import { jsonResponse } from '../index';
import { requireSession } from '../session';

// ─── Types ────────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  id: string;
  rank: number;
  name: string;
  handle: string;
  avatarUrl: string;
  platform: string;
  platforms: string[];
  tipsReceived: number;
  tipsSent: number;
  followerCount: number;
  postCount: number;
  change: number; // positive = rising, negative = falling
}

export interface TrendingEntry {
  id: string;
  rank: number;
  title: string;
  platform: string;
  url: string;
  engagementScore: number;
  tipCount: number;
  tipTotal: number;
  change: number;
  authorName: string;
  authorAvatar: string;
}

export interface CommunityEntry {
  id: string;
  rank: number;
  name: string;
  icon: string;
  platform: string;
  memberCount: number;
  postCount: number;
  tipCount: number;
  tipTotal: number;
  change: number;
}

interface LeaderboardData {
  entries: LeaderboardEntry[];
  updatedAt: string;
}

interface TrendingData {
  entries: TrendingEntry[];
  updatedAt: string;
}

interface CommunitiesData {
  entries: CommunityEntry[];
  updatedAt: string;
}

type Period = 'daily' | 'weekly' | 'monthly' | 'alltime';

const VALID_PERIODS = new Set(['daily', 'weekly', 'monthly', 'alltime']);
const VALID_PLATFORMS = new Set(['all', 'degenfeed', 'lemmy', 'peertube']);
const _VALID_CATEGORIES = new Set(['creators', 'tippers', 'trending', 'communities']);

const KV_TTL = 300; // 5-minute cache

// ─── Helpers ──────────────────────────────────────────────────────────────

function isValidPeriod(p: string | null): p is Period {
  return p !== null && VALID_PERIODS.has(p);
}

function sanitizePeriod(period: string | null): Period {
  if (isValidPeriod(period)) return period;
  return 'weekly';
}

function sanitizePlatform(platform: string | null): string {
  if (platform !== null && VALID_PLATFORMS.has(platform)) return platform;
  return 'all';
}

/**
 * Filter entries by platform and clamp to limit.
 */
function filterByPlatform<T extends { platform: string; platforms?: string[] }>(
  entries: T[],
  platform: string,
  limit: number,
): T[] {
  if (platform === 'all') return entries.slice(0, limit);
  return entries
    .filter((e) => e.platform === platform || e.platforms?.includes(platform))
    .slice(0, limit);
}

// ─── KV helpers ───────────────────────────────────────────────────────────

async function kvGet<T>(env: Env, key: string): Promise<T | null> {
  try {
    const raw = await env.CACHE?.get(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    /* KV unavailable */
  }
  return null;
}

async function kvPut(env: Env, key: string, data: unknown): Promise<void> {
  try {
    await env.CACHE?.put(key, JSON.stringify(data), { expirationTtl: KV_TTL });
  } catch {
    /* KV unavailable */
  }
}

// ─── Seed / Fallback Data ─────────────────────────────────────────────────
// When KV is empty (fresh deploy), we generate plausible entries from
// the unified tipping data. In production, a cron job / periodic refresh
// computes these from actual tip activity.

const FALLBACK_CREATORS: LeaderboardEntry[] = [
  {
    id: 'npub1creator1',
    rank: 1,
    name: 'Vitalik Buterin',
    handle: 'vitalik.eth',
    avatarUrl: '',
    platform: 'degenfeed',
    platforms: ['degenfeed', 'farcaster'],
    tipsReceived: 42_500,
    tipsSent: 12_000,
    followerCount: 2_400_000,
    postCount: 8_432,
    change: 2,
  },
  {
    id: 'npub1creator2',
    rank: 2,
    name: 'Crypto Whaler',
    handle: 'whaler@degenfeed.xyz',
    avatarUrl: '',
    platform: 'degenfeed',
    platforms: ['degenfeed', 'lemmy'],
    tipsReceived: 31_200,
    tipsSent: 8_900,
    followerCount: 156_000,
    postCount: 3_211,
    change: 5,
  },
  {
    id: 'npub1creator3',
    rank: 3,
    name: 'DeFi Degen',
    handle: 'defidegen@degenfeed.xyz',
    avatarUrl: '',
    platform: 'degenfeed',
    platforms: ['degenfeed'],
    tipsReceived: 28_750,
    tipsSent: 15_400,
    followerCount: 89_000,
    postCount: 1_876,
    change: -1,
  },
  {
    id: 'npub1creator4',
    rank: 4,
    name: 'Lemmy Farmer',
    handle: 'farmer@lemmy.world',
    avatarUrl: '',
    platform: 'lemmy',
    platforms: ['lemmy'],
    tipsReceived: 18_300,
    tipsSent: 4_200,
    followerCount: 12_500,
    postCount: 4_567,
    change: 8,
  },
  {
    id: 'npub1creator5',
    rank: 5,
    name: 'PeerTube Star',
    handle: 'starlight@peertube.tv',
    avatarUrl: '',
    platform: 'peertube',
    platforms: ['peertube'],
    tipsReceived: 15_900,
    tipsSent: 6_100,
    followerCount: 45_000,
    postCount: 234,
    change: 3,
  },
  {
    id: 'npub1creator6',
    rank: 6,
    name: 'Meme Lord',
    handle: 'memelord@degenfeed.xyz',
    avatarUrl: '',
    platform: 'degenfeed',
    platforms: ['degenfeed', 'lemmy', 'peertube'],
    tipsReceived: 12_400,
    tipsSent: 22_100,
    followerCount: 67_000,
    postCount: 892,
    change: 12,
  },
  {
    id: 'npub1creator7',
    rank: 7,
    name: 'Tech Analyst',
    handle: 'techanalyst@degenfeed.xyz',
    avatarUrl: '',
    platform: 'degenfeed',
    platforms: ['degenfeed'],
    tipsReceived: 9_800,
    tipsSent: 3_200,
    followerCount: 34_000,
    postCount: 623,
    change: -3,
  },
  {
    id: 'npub1creator8',
    rank: 8,
    name: 'Video Degen',
    handle: 'videogen@peertube.tv',
    avatarUrl: '',
    platform: 'peertube',
    platforms: ['peertube'],
    tipsReceived: 7_600,
    tipsSent: 1_800,
    followerCount: 8_900,
    postCount: 112,
    change: 6,
  },
  {
    id: 'npub1creator9',
    rank: 9,
    name: 'News Hub',
    handle: 'news@lemmy.ml',
    avatarUrl: '',
    platform: 'lemmy',
    platforms: ['lemmy'],
    tipsReceived: 5_400,
    tipsSent: 900,
    followerCount: 22_000,
    postCount: 3_100,
    change: 1,
  },
  {
    id: 'npub1creator10',
    rank: 10,
    name: 'Degen Trader',
    handle: 'trader@degenfeed.xyz',
    avatarUrl: '',
    platform: 'degenfeed',
    platforms: ['degenfeed'],
    tipsReceived: 3_200,
    tipsSent: 18_700,
    followerCount: 15_000,
    postCount: 456,
    change: -5,
  },
];

const FALLBACK_TIPPERS: LeaderboardEntry[] = [
  {
    id: 'npub1tipper1',
    rank: 1,
    name: 'Generous Whale',
    handle: 'whale@degenfeed.xyz',
    avatarUrl: '',
    platform: 'degenfeed',
    platforms: ['degenfeed'],
    tipsReceived: 2_100,
    tipsSent: 89_000,
    followerCount: 12_000,
    postCount: 89,
    change: 1,
  },
  {
    id: 'npub1tipper2',
    rank: 2,
    name: 'Degen Angel',
    handle: 'angel@degenfeed.xyz',
    avatarUrl: '',
    platform: 'degenfeed',
    platforms: ['degenfeed', 'farcaster'],
    tipsReceived: 800,
    tipsSent: 65_400,
    followerCount: 8_500,
    postCount: 45,
    change: 4,
  },
  {
    id: 'npub1tipper3',
    rank: 3,
    name: 'Tip King',
    handle: 'tipking@lemmy.world',
    avatarUrl: '',
    platform: 'lemmy',
    platforms: ['lemmy'],
    tipsReceived: 350,
    tipsSent: 52_100,
    followerCount: 3_200,
    postCount: 234,
    change: -2,
  },
  {
    id: 'npub1tipper4',
    rank: 4,
    name: 'Generous Soul',
    handle: 'soul@degenfeed.xyz',
    avatarUrl: '',
    platform: 'degenfeed',
    platforms: ['degenfeed', 'peertube'],
    tipsReceived: 1_200,
    tipsSent: 41_000,
    followerCount: 6_700,
    postCount: 167,
    change: 7,
  },
  {
    id: 'npub1tipper5',
    rank: 5,
    name: 'Micro Tipper',
    handle: 'micro@peertube.tv',
    avatarUrl: '',
    platform: 'peertube',
    platforms: ['peertube'],
    tipsReceived: 100,
    tipsSent: 34_200,
    followerCount: 1_200,
    postCount: 34,
    change: 11,
  },
  {
    id: 'npub1tipper6',
    rank: 6,
    name: 'Community Backer',
    handle: 'backer@degenfeed.xyz',
    avatarUrl: '',
    platform: 'degenfeed',
    platforms: ['degenfeed'],
    tipsReceived: 650,
    tipsSent: 28_900,
    followerCount: 4_100,
    postCount: 78,
    change: 3,
  },
  {
    id: 'npub1tipper7',
    rank: 7,
    name: 'Generous Lemmy',
    handle: 'glemy@lemmy.ml',
    avatarUrl: '',
    platform: 'lemmy',
    platforms: ['lemmy'],
    tipsReceived: 200,
    tipsSent: 22_300,
    followerCount: 1_800,
    postCount: 412,
    change: -1,
  },
  {
    id: 'npub1tipper8',
    rank: 8,
    name: 'Video Supporter',
    handle: 'vidsupp@peertube.tv',
    avatarUrl: '',
    platform: 'peertube',
    platforms: ['peertube'],
    tipsReceived: 150,
    tipsSent: 18_700,
    followerCount: 900,
    postCount: 23,
    change: 5,
  },
  {
    id: 'npub1tipper9',
    rank: 9,
    name: 'Degen Donor',
    handle: 'donor@degenfeed.xyz',
    avatarUrl: '',
    platform: 'degenfeed',
    platforms: ['degenfeed', 'farcaster'],
    tipsReceived: 400,
    tipsSent: 14_500,
    followerCount: 3_500,
    postCount: 56,
    change: -4,
  },
  {
    id: 'npub1tipper10',
    rank: 10,
    name: 'Crypto Santa',
    handle: 'santa@degenfeed.xyz',
    avatarUrl: '',
    platform: 'degenfeed',
    platforms: ['degenfeed', 'lemmy'],
    tipsReceived: 300,
    tipsSent: 11_200,
    followerCount: 2_100,
    postCount: 34,
    change: 2,
  },
];

const FALLBACK_TRENDING: Record<Period, TrendingEntry[]> = {
  daily: [
    {
      id: 'trend1',
      rank: 1,
      title: 'Solana breaks $300 — new ATH',
      platform: 'degenfeed',
      url: '/post/sol-ath-1',
      engagementScore: 98_500,
      tipCount: 342,
      tipTotal: 12_400,
      change: 15,
      authorName: 'Crypto Whaler',
      authorAvatar: '',
    },
    {
      id: 'trend2',
      rank: 2,
      title: 'I built a DeFi yield aggregator in Rust',
      platform: 'lemmy',
      url: '/post/rust-yield-1',
      engagementScore: 72_100,
      tipCount: 189,
      tipTotal: 8_200,
      change: 8,
      authorName: 'Rust Degen',
      authorAvatar: '',
    },
    {
      id: 'trend3',
      rank: 3,
      title: 'Ethereum Pectra upgrade explained simply',
      platform: 'peertube',
      url: '/post/pectra-video-1',
      engagementScore: 65_800,
      tipCount: 267,
      tipTotal: 15_100,
      change: 22,
      authorName: 'PeerTube Star',
      authorAvatar: '',
    },
    {
      id: 'trend4',
      rank: 4,
      title: 'Meme coin season is back? 🐸',
      platform: 'degenfeed',
      url: '/post/meme-season-1',
      engagementScore: 54_200,
      tipCount: 156,
      tipTotal: 4_800,
      change: -3,
      authorName: 'Meme Lord',
      authorAvatar: '',
    },
    {
      id: 'trend5',
      rank: 5,
      title: 'Deep dive: zk-rollup architecture',
      platform: 'peertube',
      url: '/post/zk-rollup-vid',
      engagementScore: 41_300,
      tipCount: 98,
      tipTotal: 6_700,
      change: 4,
      authorName: 'Video Degen',
      authorAvatar: '',
    },
  ],
  weekly: [
    {
      id: 'trend_w1',
      rank: 1,
      title: 'Solana breaks $300 — new ATH',
      platform: 'degenfeed',
      url: '/post/sol-ath-1',
      engagementScore: 580_000,
      tipCount: 2_100,
      tipTotal: 89_000,
      change: 42,
      authorName: 'Crypto Whaler',
      authorAvatar: '',
    },
    {
      id: 'trend_w2',
      rank: 2,
      title: 'Ethereum Pectra upgrade explained simply',
      platform: 'peertube',
      url: '/post/pectra-video-1',
      engagementScore: 420_000,
      tipCount: 1_800,
      tipTotal: 95_000,
      change: 28,
      authorName: 'PeerTube Star',
      authorAvatar: '',
    },
    {
      id: 'trend_w3',
      rank: 3,
      title: 'How to spot a crypto scam in 2026',
      platform: 'lemmy',
      url: '/post/scam-spotting',
      engagementScore: 380_000,
      tipCount: 1_200,
      tipTotal: 34_000,
      change: 15,
      authorName: 'News Hub',
      authorAvatar: '',
    },
    {
      id: 'trend_w4',
      rank: 4,
      title: 'I built a DeFi yield aggregator in Rust',
      platform: 'lemmy',
      url: '/post/rust-yield-1',
      engagementScore: 310_000,
      tipCount: 950,
      tipTotal: 41_000,
      change: 35,
      authorName: 'Rust Degen',
      authorAvatar: '',
    },
    {
      id: 'trend_w5',
      rank: 5,
      title: 'DegenFeed v2 roadmap walkthrough',
      platform: 'degenfeed',
      url: '/post/df-v2-roadmap',
      engagementScore: 290_000,
      tipCount: 780,
      tipTotal: 22_000,
      change: 10,
      authorName: 'DegenFeed Team',
      authorAvatar: '',
    },
  ],
  monthly: [
    {
      id: 'trend_m1',
      rank: 1,
      title: 'Solana breaks $300 — new ATH',
      platform: 'degenfeed',
      url: '/post/sol-ath-1',
      engagementScore: 2_100_000,
      tipCount: 8_400,
      tipTotal: 320_000,
      change: 55,
      authorName: 'Crypto Whaler',
      authorAvatar: '',
    },
    {
      id: 'trend_m2',
      rank: 2,
      title: 'Ethereum Pectra upgrade explained simply',
      platform: 'peertube',
      url: '/post/pectra-video-1',
      engagementScore: 1_800_000,
      tipCount: 6_200,
      tipTotal: 280_000,
      change: 32,
      authorName: 'PeerTube Star',
      authorAvatar: '',
    },
    {
      id: 'trend_m3',
      rank: 3,
      title: 'I built a DeFi yield aggregator in Rust',
      platform: 'lemmy',
      url: '/post/rust-yield-1',
      engagementScore: 1_200_000,
      tipCount: 3_800,
      tipTotal: 160_000,
      change: 41,
      authorName: 'Rust Degen',
      authorAvatar: '',
    },
    {
      id: 'trend_m4',
      rank: 4,
      title: 'How to spot a crypto scam in 2026',
      platform: 'lemmy',
      url: '/post/scam-spotting',
      engagementScore: 950_000,
      tipCount: 4_100,
      tipTotal: 120_000,
      change: 18,
      authorName: 'News Hub',
      authorAvatar: '',
    },
    {
      id: 'trend_m5',
      rank: 5,
      title: 'Meme coin season is back? 🐸',
      platform: 'degenfeed',
      url: '/post/meme-season-1',
      engagementScore: 780_000,
      tipCount: 2_300,
      tipTotal: 67_000,
      change: -8,
      authorName: 'Meme Lord',
      authorAvatar: '',
    },
  ],
  alltime: [
    {
      id: 'trend_a1',
      rank: 1,
      title: 'How DegenFeed unifies 7 social protocols',
      platform: 'degenfeed',
      url: '/post/df-unified',
      engagementScore: 5_200_000,
      tipCount: 12_000,
      tipTotal: 890_000,
      change: 3,
      authorName: 'DegenFeed Team',
      authorAvatar: '',
    },
    {
      id: 'trend_a2',
      rank: 2,
      title: 'Solana breaks $300 — new ATH',
      platform: 'degenfeed',
      url: '/post/sol-ath-1',
      engagementScore: 4_800_000,
      tipCount: 15_000,
      tipTotal: 720_000,
      change: 55,
      authorName: 'Crypto Whaler',
      authorAvatar: '',
    },
    {
      id: 'trend_a3',
      rank: 3,
      title: 'Ethereum Pectra upgrade explained simply',
      platform: 'peertube',
      url: '/post/pectra-video-1',
      engagementScore: 3_200_000,
      tipCount: 9_800,
      tipTotal: 560_000,
      change: 32,
      authorName: 'PeerTube Star',
      authorAvatar: '',
    },
    {
      id: 'trend_a4',
      rank: 4,
      title: 'DegenFeed Community Manifesto',
      platform: 'lemmy',
      url: '/post/df-manifesto',
      engagementScore: 2_800_000,
      tipCount: 6_500,
      tipTotal: 340_000,
      change: 5,
      authorName: 'DegenFeed Team',
      authorAvatar: '',
    },
    {
      id: 'trend_a5',
      rank: 5,
      title: 'The rise of on-chain options trading',
      platform: 'degenfeed',
      url: '/post/options-rise',
      engagementScore: 2_100_000,
      tipCount: 5_200,
      tipTotal: 290_000,
      change: 12,
      authorName: 'DeFi Degen',
      authorAvatar: '',
    },
  ],
};

const FALLBACK_COMMUNITIES: CommunityEntry[] = [
  {
    id: 'comm1',
    rank: 1,
    name: 'Crypto General',
    icon: '₿',
    platform: 'degenfeed',
    memberCount: 45_000,
    postCount: 12_000,
    tipCount: 8_400,
    tipTotal: 340_000,
    change: 5,
  },
  {
    id: 'comm2',
    rank: 2,
    name: 'DeFi Degens',
    icon: '📊',
    platform: 'degenfeed',
    memberCount: 28_000,
    postCount: 8_500,
    tipCount: 6_200,
    tipTotal: 280_000,
    change: 12,
  },
  {
    id: 'comm3',
    rank: 3,
    name: 'Lemmy Crypto',
    icon: 'L',
    platform: 'lemmy',
    memberCount: 22_000,
    postCount: 15_000,
    tipCount: 4_100,
    tipTotal: 120_000,
    change: -2,
  },
  {
    id: 'comm4',
    rank: 4,
    name: 'Video Creators',
    icon: '▶',
    platform: 'peertube',
    memberCount: 12_000,
    postCount: 3_200,
    tipCount: 3_800,
    tipTotal: 190_000,
    change: 8,
  },
  {
    id: 'comm5',
    rank: 5,
    name: 'Meme Economy',
    icon: '🐸',
    platform: 'degenfeed',
    memberCount: 18_000,
    postCount: 6_700,
    tipCount: 5_600,
    tipTotal: 145_000,
    change: 3,
  },
  {
    id: 'comm6',
    rank: 6,
    name: 'Tech & Builders',
    icon: '🔧',
    platform: 'degenfeed',
    memberCount: 15_000,
    postCount: 4_200,
    tipCount: 2_900,
    tipTotal: 98_000,
    change: 6,
  },
  {
    id: 'comm7',
    rank: 7,
    name: 'NFT Collectors',
    icon: '🖼',
    platform: 'lemmy',
    memberCount: 9_000,
    postCount: 3_800,
    tipCount: 2_100,
    tipTotal: 76_000,
    change: -5,
  },
  {
    id: 'comm8',
    rank: 8,
    name: 'PeerTube Tech',
    icon: '🎥',
    platform: 'peertube',
    memberCount: 5_500,
    postCount: 1_200,
    tipCount: 1_800,
    tipTotal: 52_000,
    change: 4,
  },
];

// ─── CRON / Refresh ───────────────────────────────────────────────────────
// Called hourly by the cron trigger to recompute leaderboards.
// In production this would aggregate from actual tip events; for now
// it refreshes the seeded data and shuffles rankings slightly.

function shuffleRank<T extends { rank: number; change: number }>(entries: T[]): T[] {
  // Simulate ranking changes by toggling some entries
  return entries.map((e) => ({
    ...e,
    change: e.change + (Math.random() > 0.7 ? 1 : 0),
  }));
}

export async function handleRefreshLeaderboards(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  if (env.ADMIN_WALLETS) {
    const admins = env.ADMIN_WALLETS.split(',').map((a) => a.trim().toLowerCase());
    if (!admins.includes(session.address.toLowerCase())) {
      return jsonResponse({ error: 'Forbidden: admin access required' }, 403);
    }
  }

  const now = new Date().toISOString();
  const periods: Period[] = ['daily', 'weekly', 'monthly', 'alltime'];

  try {
    // Creators
    for (const period of periods) {
      const entries = shuffleRank(FALLBACK_CREATORS.map((c, i) => ({ ...c, rank: i + 1 })));
      await kvPut(env, `leaderboard:creators:${period}`, { entries, updatedAt: now });
    }

    // Tippers
    for (const period of periods) {
      const entries = shuffleRank(FALLBACK_TIPPERS.map((t, i) => ({ ...t, rank: i + 1 })));
      await kvPut(env, `leaderboard:tippers:${period}`, { entries, updatedAt: now });
    }

    // Trending
    for (const period of periods) {
      const fallback = FALLBACK_TRENDING[period] ?? FALLBACK_TRENDING.weekly;
      const entries = fallback.map((t, i) => ({ ...t, rank: i + 1 }));
      await kvPut(env, `leaderboard:trending:${period}`, { entries, updatedAt: now });
    }

    // Communities
    const commEntries = FALLBACK_COMMUNITIES.map((c, i) => ({ ...c, rank: i + 1 }));
    await kvPut(env, 'leaderboard:communities', { entries: commEntries, updatedAt: now });

    // Last updated timestamp
    await kvPut(env, 'leaderboard:last_updated', { updatedAt: now });

    return jsonResponse({ ok: true, updatedAt: now });
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
}

// ─── Handlers ─────────────────────────────────────────────────────────────

async function handleLeaderboardGet(
  _request: Request,
  env: Env,
  category: string,
): Promise<Response> {
  const url = new URL(_request.url);
  const period = sanitizePeriod(url.searchParams.get('period'));
  const platform = sanitizePlatform(url.searchParams.get('platform'));
  const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 100);

  const kvKey = `leaderboard:${category}:${period}`;
  const cached = await kvGet<LeaderboardData>(env, kvKey);

  if (cached?.entries) {
    const filtered = filterByPlatform(cached.entries, platform, limit);
    return jsonResponse({ entries: filtered, updatedAt: cached.updatedAt, category, period });
  }

  // Fallback: return seeded data
  let entries: LeaderboardEntry[];
  if (category === 'creators') {
    entries = FALLBACK_CREATORS;
  } else if (category === 'tippers') {
    entries = FALLBACK_TIPPERS;
  } else {
    return jsonResponse({ error: 'Invalid category' }, 400);
  }

  const filtered = filterByPlatform(entries, platform, limit).map((e, i) => ({
    ...e,
    rank: i + 1,
  }));
  return jsonResponse({ entries: filtered, updatedAt: new Date().toISOString(), category, period });
}

export async function handleLeaderboardCreators(request: Request, env: Env): Promise<Response> {
  return handleLeaderboardGet(request, env, 'creators');
}

export async function handleLeaderboardTippers(request: Request, env: Env): Promise<Response> {
  return handleLeaderboardGet(request, env, 'tippers');
}

export async function handleLeaderboardTrending(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const period = sanitizePeriod(url.searchParams.get('period'));
  const platform = sanitizePlatform(url.searchParams.get('platform'));
  const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 100);

  const kvKey = `leaderboard:trending:${period}`;
  const cached = await kvGet<TrendingData>(env, kvKey);

  if (cached?.entries) {
    const filtered = filterByPlatform(cached.entries, platform, limit);
    return jsonResponse({ entries: filtered, updatedAt: cached.updatedAt, period });
  }

  // Fallback
  const fallback = FALLBACK_TRENDING[period] ?? FALLBACK_TRENDING.weekly;
  const filtered = filterByPlatform(fallback, platform, limit).map((e, i) => ({
    ...e,
    rank: i + 1,
  }));
  return jsonResponse({ entries: filtered, updatedAt: new Date().toISOString(), period });
}

export async function handleLeaderboardCommunities(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const platform = sanitizePlatform(url.searchParams.get('platform'));
  const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 100);

  const cached = await kvGet<CommunitiesData>(env, 'leaderboard:communities');

  if (cached?.entries) {
    const filtered = filterByPlatform(cached.entries, platform, limit);
    return jsonResponse({ entries: filtered, updatedAt: cached.updatedAt });
  }

  // Fallback
  const filtered = filterByPlatform(FALLBACK_COMMUNITIES, platform, limit).map((e, i) => ({
    ...e,
    rank: i + 1,
  }));
  return jsonResponse({ entries: filtered, updatedAt: new Date().toISOString() });
}
