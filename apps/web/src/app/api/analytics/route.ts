/**
 * @degenfeed/web — Analytics API proxy
 *
 * GET /api/analytics?wallet=0x...&refresh=true
 *
 * Proxies to the worker analytics endpoint when the user has a wallet.
 * Falls back to a realistic data set for demo/dev so the UI is never empty.
 * The `/api/analytics` Next.js route exists alongside the worker route
 * at `/api/analytics` for Cloudflare — on Vercel/dev this Next.js route wins.
 */

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// ─── Fallback mock data (used only when no wallet is available) ──────

const MOCK_DATA = {
  followers: {
    total: 1847,
    byProtocol: {
      nostr: 412,
      farcaster: 638,
      lens: 295,
      bluesky: 347,
      mastodon: 155,
    },
    growth30d: [
      1720, 1735, 1741, 1750, 1758, 1762, 1770, 1775, 1781, 1788, 1792, 1795, 1800, 1808, 1812,
      1815, 1820, 1822, 1828, 1830, 1832, 1835, 1837, 1840, 1841, 1843, 1844, 1845, 1846, 1847,
    ],
    growthLabels: [
      'Jun 18',
      'Jun 19',
      'Jun 20',
      'Jun 21',
      'Jun 22',
      'Jun 23',
      'Jun 24',
      'Jun 25',
      'Jun 26',
      'Jun 27',
      'Jun 28',
      'Jun 29',
      'Jun 30',
      'Jul 01',
      'Jul 02',
      'Jul 03',
      'Jul 04',
      'Jul 05',
      'Jul 06',
      'Jul 07',
      'Jul 08',
      'Jul 09',
      'Jul 10',
      'Jul 11',
      'Jul 12',
      'Jul 13',
      'Jul 14',
      'Jul 15',
      'Jul 16',
      'Jul 17',
    ],
  },
  posts: {
    total: 342,
    byDay: [
      12, 8, 15, 10, 18, 6, 14, 11, 9, 16, 13, 7, 17, 10, 12, 14, 8, 15, 11, 9, 16, 13, 10, 18, 7,
      14, 12, 8, 15, 10,
    ],
    dayLabels: [
      'Jun 18',
      'Jun 19',
      'Jun 20',
      'Jun 21',
      'Jun 22',
      'Jun 23',
      'Jun 24',
      'Jun 25',
      'Jun 26',
      'Jun 27',
      'Jun 28',
      'Jun 29',
      'Jun 30',
      'Jul 01',
      'Jul 02',
      'Jul 03',
      'Jul 04',
      'Jul 05',
      'Jul 06',
      'Jul 07',
      'Jul 08',
      'Jul 09',
      'Jul 10',
      'Jul 11',
      'Jul 12',
      'Jul 13',
      'Jul 14',
      'Jul 15',
      'Jul 16',
      'Jul 17',
    ],
    byWeekday: [42, 38, 55, 48, 62, 58, 39],
    weekdayLabels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    totalTopLevel: 280,
    totalReplies: 62,
  },
  tips: {
    totalUsd: 1284.5,
    byCurrency: { DEGEN: 850000, ETH: 0.42, SOL: 2.8, BTC: 0.0012 },
    byProtocol: {
      nostr: 539.49,
      farcaster: 398.2,
      lens: 231.21,
      ethereum: 115.6,
    },
    history30d: [
      12, 8, 45, 22, 15, 8, 62, 35, 18, 12, 5, 28, 42, 15, 22, 10, 8, 55, 30, 18, 12, 7, 38, 25, 15,
      20, 48, 32, 18, 10,
    ],
    historyLabels: [
      'Jun 18',
      'Jun 19',
      'Jun 20',
      'Jun 21',
      'Jun 22',
      'Jun 23',
      'Jun 24',
      'Jun 25',
      'Jun 26',
      'Jun 27',
      'Jun 28',
      'Jun 29',
      'Jun 30',
      'Jul 01',
      'Jul 02',
      'Jul 03',
      'Jul 04',
      'Jul 05',
      'Jul 06',
      'Jul 07',
      'Jul 08',
      'Jul 09',
      'Jul 10',
      'Jul 11',
      'Jul 12',
      'Jul 13',
      'Jul 14',
      'Jul 15',
      'Jul 16',
      'Jul 17',
    ],
    totalDegen: 850000,
    totalEth: 0.42,
    totalSol: 2.8,
    totalBtc: 0.0012,
    topTippers: [
      { name: 'vitalik.eth', totalUsd: 420 },
      { name: 'martin', totalUsd: 185 },
      { name: 'nick.eth', totalUsd: 128 },
    ],
    last10: [
      { amount: '0.01', currency: 'ETH', protocol: 'farcaster', createdAt: Date.now() - 3600000 },
      { amount: '5000', currency: 'DEGEN', protocol: 'farcaster', createdAt: Date.now() - 7200000 },
      { amount: '0.001', currency: 'BTC', protocol: 'nostr', createdAt: Date.now() - 14400000 },
    ],
  },
  engagement: {
    rate: 0.083,
    totalLikes: 2840,
    totalReposts: 892,
    totalReplies: 412,
    byProtocol: {
      farcaster: { likes: 1040, reposts: 320, replies: 152 },
      nostr: { likes: 720, reposts: 248, replies: 118 },
      bluesky: { likes: 540, reposts: 162, replies: 82 },
      lens: { likes: 380, reposts: 112, replies: 48 },
      mastodon: { likes: 160, reposts: 50, replies: 12 },
    },
  },
  topPosts: [
    {
      id: '0x1a2b3c',
      protocol: 'farcaster',
      content: 'Just deployed our new analytics pipeline. Real-time cross-protocol data is here.',
      likes: 342,
      reposts: 88,
      replies: 45,
      tips: 12500,
      tipsUsd: 42.5,
      createdAt: '2026-07-14T14:32:00Z',
    },
    {
      id: 'note1xyz',
      protocol: 'nostr',
      content:
        "Web3 social isn't dead — it's just getting started. Nostr + Farcaster + Lens = the new foundation.",
      likes: 281,
      reposts: 64,
      replies: 38,
      tips: 8500,
      tipsUsd: 28.9,
      createdAt: '2026-07-12T09:15:00Z',
    },
    {
      id: '0x4d5e6f',
      protocol: 'bluesky',
      content:
        "Hot take: the best social apps won't be on any single protocol. They'll aggregate everything.",
      likes: 215,
      reposts: 52,
      replies: 31,
      tips: 0,
      tipsUsd: 0,
      createdAt: '2026-07-10T18:45:00Z',
    },
    {
      id: '0x7g8h9i',
      protocol: 'lens',
      content: 'New milestone: 1,800+ cross-protocol followers. The network effect is real.',
      likes: 198,
      reposts: 41,
      replies: 27,
      tips: 3200,
      tipsUsd: 10.88,
      createdAt: '2026-07-08T11:00:00Z',
    },
    {
      id: '0x0j1k2l',
      protocol: 'farcaster',
      content:
        "We're open sourcing our cross-posting engine this week. Write once, publish to 6 protocols.",
      likes: 178,
      reposts: 95,
      replies: 52,
      tips: 21000,
      tipsUsd: 71.4,
      createdAt: '2026-07-05T20:30:00Z',
    },
  ],
  topTipPosts: [
    {
      id: '0x0j1k2l',
      protocol: 'farcaster',
      content: "We're open sourcing our cross-posting engine this week.",
      likes: 178,
      reposts: 95,
      replies: 52,
      tips: 21000,
      tipsUsd: 71.4,
      createdAt: '2026-07-05T20:30:00Z',
    },
    {
      id: '0x1a2b3c',
      protocol: 'farcaster',
      content: 'Just deployed our new analytics pipeline.',
      likes: 342,
      reposts: 88,
      replies: 45,
      tips: 12500,
      tipsUsd: 42.5,
      createdAt: '2026-07-14T14:32:00Z',
    },
    {
      id: 'note1xyz',
      protocol: 'nostr',
      content: "Web3 social isn't dead — it's just getting started.",
      likes: 281,
      reposts: 64,
      replies: 38,
      tips: 8500,
      tipsUsd: 28.9,
      createdAt: '2026-07-12T09:15:00Z',
    },
    {
      id: '0x7g8h9i',
      protocol: 'lens',
      content: 'New milestone: 1,800+ cross-protocol followers.',
      likes: 198,
      reposts: 41,
      replies: 27,
      tips: 3200,
      tipsUsd: 10.88,
      createdAt: '2026-07-08T11:00:00Z',
    },
  ],
  audience: {
    byProtocol: { nostr: 412, farcaster: 638, lens: 295, bluesky: 347, mastodon: 155 },
    byInstance: {
      'degenfeed.xyz': 422,
      'farcaster.xyz': 386,
      'nostr.band': 215,
      'bsky.social': 347,
      'lens.xyz': 295,
      'mastodon.social': 98,
      other: 84,
    },
    locations: {
      'United States': 620,
      Germany: 185,
      'United Kingdom': 172,
      Japan: 98,
      France: 87,
      Canada: 76,
      Brazil: 52,
      Other: 557,
    },
    byCommunity: [],
  },
  protocols: {
    connected: ['farcaster', 'nostr', 'lens', 'bluesky', 'mastodon'],
    missing: [],
  },
  lastUpdated: Date.now(),
  isMock: true,
};

// ─── Worker API base URL ──────────────────────────────────────────

const WORKER_API_BASE =
  process.env.NEXT_PUBLIC_WORKER_API_URL ||
  process.env.WORKER_API_URL ||
  'https://api.degenfeed.xyz';

// ─── Handler ──────────────────────────────────────────────────────

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const wallet = url.searchParams.get('wallet');
  const refresh = url.searchParams.get('refresh') === 'true';

  // Try to get wallet from session cookie if not in query
  let resolvedWallet = wallet;
  if (!resolvedWallet) {
    try {
      const cookieStore = await cookies();
      // The session cookie is stored differently in Next.js vs the worker
      // Try common wallet/address storage
      const sessionCookie = cookieStore.get('wallet_address');
      if (sessionCookie?.value) {
        resolvedWallet = sessionCookie.value;
      }
    } catch {
      // cookies() might throw in dev, ignore
    }
  }

  // If we have a wallet, attempt to fetch from the worker API
  if (resolvedWallet) {
    try {
      const workerUrl = `${WORKER_API_BASE}/api/analytics?wallet=${encodeURIComponent(resolvedWallet)}${refresh ? '&refresh=true' : ''}`;
      const res = await fetch(workerUrl, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const data = await res.json();
        return NextResponse.json({ ...data, lastUpdated: Date.now() });
      }
      // Worker returned an error — fall through to mock
      console.warn('[analytics] worker returned', res.status);
    } catch (err) {
      console.warn('[analytics] worker fetch failed, using mock:', err);
      // Network error — fall through to mock
    }
  }

  // No wallet available — return mock data that shows the "Connect protocols" messaging
  return NextResponse.json({
    ...MOCK_DATA,
    lastUpdated: Date.now(),
  });
}
