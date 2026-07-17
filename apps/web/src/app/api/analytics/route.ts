import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

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

interface AnalyticsData {
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
  };
  tips: {
    totalUsd: number;
    byCurrency: Record<string, number>;
    history30d: number[];
    historyLabels: string[];
    totalDegen: number;
    totalEth: number;
    totalSol: number;
    totalBtc: number;
  };
  engagement: {
    rate: number;
    totalLikes: number;
    totalReposts: number;
    totalReplies: number;
  };
  topPosts: TopPost[];
  topTipPosts: TopPost[];
  audience: {
    byInstance: Record<string, number>;
    locations: Record<string, number>;
  };
}

export async function GET(_request: Request): Promise<NextResponse<AnalyticsData>> {
  // Mock data — production would aggregate from backend analytics pipeline
  const data: AnalyticsData = {
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
    },
    tips: {
      totalUsd: 1284.5,
      byCurrency: {
        DEGEN: 850000,
        ETH: 0.42,
        SOL: 2.8,
        BTC: 0.0012,
      },
      history30d: [
        12, 8, 45, 22, 15, 8, 62, 35, 18, 12, 5, 28, 42, 15, 22, 10, 8, 55, 30, 18, 12, 7, 38, 25,
        15, 20, 48, 32, 18, 10,
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
    },
    engagement: {
      rate: 0.083,
      totalLikes: 2840,
      totalReposts: 892,
      totalReplies: 412,
    },
    topPosts: [
      {
        id: '0x1a2b3c',
        protocol: 'farcaster',
        content:
          'Just deployed our new analytics pipeline. Real-time cross-protocol data is here. 🚀',
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
          "Hot take: the best social apps won't be on any single protocol. They'll aggregate everything. That's what we're building.",
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
        content:
          "New milestone: 1,800+ cross-protocol followers. The network effect is real when you're not locked into one silo.",
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
          "We're open sourcing our cross-posting engine this week. Write once, publish to 6 protocols. No more manual cross-posting.",
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
        content:
          "We're open sourcing our cross-posting engine this week. Write once, publish to 6 protocols.",
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
        content:
          'Just deployed our new analytics pipeline. Real-time cross-protocol data is here. 🚀',
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
        content: 'New milestone: 1,800+ cross-protocol followers. The network effect is real.',
        likes: 198,
        reposts: 41,
        replies: 27,
        tips: 3200,
        tipsUsd: 10.88,
        createdAt: '2026-07-08T11:00:00Z',
      },
      {
        id: '0x7j8k9l',
        protocol: 'nostr',
        content:
          'Lightning Zaps are the best way to monetize content on Nostr. No ads, no algo, just direct value exchange.',
        likes: 145,
        reposts: 33,
        replies: 19,
        tips: 2500,
        tipsUsd: 8.5,
        createdAt: '2026-07-03T16:20:00Z',
      },
    ],
    audience: {
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
    },
  };

  return NextResponse.json(data);
}
