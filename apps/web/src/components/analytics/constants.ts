import type { AnalyticsData, TabId } from './types';

export const PROTOCOL_COLORS: Record<string, string> = {
  nostr: '#8e30eb',
  farcaster: '#8a63d2',
  lens: '#abfe2c',
  bluesky: '#1185fe',
  mastodon: '#6364ff',
};

export const PROTOCOL_LABELS: Record<string, string> = {
  nostr: 'Nostr',
  farcaster: 'Farcaster',
  lens: 'Lens',
  bluesky: 'Bluesky',
  mastodon: 'Mastodon',
};

export const PROTOCOL_ORDER = ['nostr', 'farcaster', 'lens', 'bluesky', 'mastodon'];

export const CURRENCY_COLORS: Record<string, string> = {
  DEGEN: '#00ff41',
  ETH: '#627eea',
  SOL: '#9945ff',
  BTC: '#f7931a',
  USDC: '#2775ca',
  MATIC: '#8247e5',
};

export const DEFAULT_ANALYTICS: AnalyticsData = {
  followers: { total: 0, byProtocol: {}, growth30d: [], growthLabels: [] },
  posts: {
    total: 0,
    byDay: [],
    dayLabels: [],
    byWeekday: [],
    weekdayLabels: [],
    totalTopLevel: 0,
    totalReplies: 0,
  },
  tips: {
    totalUsd: 0,
    byCurrency: {},
    byProtocol: {},
    history30d: [],
    historyLabels: [],
    totalDegen: 0,
    totalEth: 0,
    totalSol: 0,
    totalBtc: 0,
    topTippers: [],
    last10: [],
  },
  engagement: { rate: 0, totalLikes: 0, totalReposts: 0, totalReplies: 0, byProtocol: {} },
  topPosts: [],
  topTipPosts: [],
  audience: { byProtocol: {}, byInstance: {}, locations: {}, byCommunity: [] },
  protocols: { connected: [], missing: ['nostr', 'farcaster', 'lens', 'bluesky', 'mastodon'] },
  lastUpdated: Date.now(),
  isMock: true,
};

export const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'content', label: 'Content' },
  { id: 'audience', label: 'Audience' },
  { id: 'earnings', label: 'Earnings' },
];
