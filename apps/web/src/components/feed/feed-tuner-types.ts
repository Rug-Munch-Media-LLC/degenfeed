/**
 * @degenfeed/web — Feed Tuner types, config, and helpers
 *
 * Extracted from FeedTuner.tsx to allow importing types
 * without pulling in the entire UI component.
 */

// ─── Types (all fields required for strict type safety) ───────

export interface ProtocolWeight {
  weight: number;
  minEngagement: number;
  verifiedOnly: boolean;
  minContentLength: number;
}

export interface ContentTypeWeights {
  posts: number;
  images: number;
  videos: number;
  links: number;
  threads: number;
}

export interface FeedMixConfig {
  protocols: Record<string, ProtocolWeight>;
  contentTypes: ContentTypeWeights;
  qualityThresholds: {
    globalMinEngagement: number;
    hideLowQuality: boolean;
    hideThreshold: number;
    verifiedOnly: boolean;
    minContentLength: number;
  };
}

export interface SavedMix {
  id: string;
  name: string;
  description: string;
  config: FeedMixConfig;
}

export interface FeedPreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  config: {
    freshnessPreference: number;
    creatorDiversity: number;
    exploreRatio: number;
    algorithmTransparent: boolean;
    recencyWeight: number;
    engagementWeight: number;
    contentTypes?: Record<string, number>;
  };
}

export interface TopicDef {
  id: string;
  label: string;
  icon: string;
  color: string;
}

// ─── Constants ────────────────────────────────────────────────

export const FEED_PRESETS: FeedPreset[] = [
  {
    id: 'tiktok-mode',
    name: 'TikTok Mode',
    description: 'Video-forward, rapid-fire content. Max freshness, low creator diversity.',
    icon: '🎵',
    config: {
      freshnessPreference: 90,
      creatorDiversity: 2,
      exploreRatio: 60,
      algorithmTransparent: false,
      recencyWeight: 2.5,
      engagementWeight: 3.0,
      contentTypes: { posts: 20, images: 30, videos: 100, links: 10, threads: 10 },
    },
  },
  {
    id: 'twitter-mode',
    name: 'Twitter Mode',
    description: 'Text-forward, chronological-leaning. Balanced discovery.',
    icon: '🐦',
    config: {
      freshnessPreference: 70,
      creatorDiversity: 5,
      exploreRatio: 30,
      algorithmTransparent: true,
      recencyWeight: 2.0,
      engagementWeight: 1.5,
      contentTypes: { posts: 100, images: 40, videos: 20, links: 30, threads: 40 },
    },
  },
  {
    id: 'discover-mode',
    name: 'Discover Mode',
    description: 'Explore-heavy. Maximize new creators, topics, and content types.',
    icon: '✨',
    config: {
      freshnessPreference: 40,
      creatorDiversity: 10,
      exploreRatio: 90,
      algorithmTransparent: true,
      recencyWeight: 1.0,
      engagementWeight: 2.0,
    },
  },
  {
    id: 'focus-mode',
    name: 'Focus Mode',
    description: 'Followed creators only. Minimum noise, maximum signal.',
    icon: '🎯',
    config: {
      freshnessPreference: 30,
      creatorDiversity: 3,
      exploreRatio: 5,
      algorithmTransparent: false,
      recencyWeight: 1.5,
      engagementWeight: 2.5,
    },
  },
];

export const PROTOCOLS = [
  { id: 'nostr', label: 'Nostr', icon: '⚡', color: '#8e30eb' },
  { id: 'farcaster', label: 'Farcaster', icon: '🟣', color: '#8a63d2' },
  { id: 'lens', label: 'Lens', icon: '🌿', color: '#abfe2c' },
  { id: 'bluesky', label: 'Bluesky', icon: '🦋', color: '#1185fe' },
  { id: 'mastodon', label: 'Mastodon', icon: '🐘', color: '#6364ff' },
  { id: 'reddit', label: 'Reddit', icon: '🔴', color: '#ff4500' },
  { id: 'rss', label: 'RSS', icon: '📰', color: '#ffa500' },
  { id: 'lemmy', label: 'Lemmy', icon: '🌲', color: '#22c55e' },
  { id: 'youtube', label: 'YouTube', icon: '▶️', color: '#ff0000' },
  { id: 'peertube', label: 'PeerTube', icon: '📺', color: '#f1680d' },
] as const;

export const CONTENT_TYPE_LABELS: Record<keyof ContentTypeWeights, { label: string; icon: string }> = {
  posts: { label: 'Posts', icon: '📝' },
  images: { label: 'Images', icon: '🖼️' },
  videos: { label: 'Videos', icon: '🎬' },
  links: { label: 'Links', icon: '🔗' },
  threads: { label: 'Threads', icon: '🧵' },
};

export const TOPICS: TopicDef[] = [
  { id: 'crypto', label: 'Crypto', icon: '₿', color: '#f59e0b' },
  { id: 'defi', label: 'DeFi', icon: 'D', color: '#6366f1' },
  { id: 'nft', label: 'NFT', icon: 'N', color: '#ec4899' },
  { id: 'ai', label: 'AI', icon: 'AI', color: '#06b6d4' },
  { id: 'tech', label: 'Tech', icon: '💻', color: '#3b82f6' },
  { id: 'science', label: 'Science', icon: '🔬', color: '#22d3ee' },
  { id: 'startups', label: 'Startups', icon: '🚀', color: '#f97316' },
  { id: 'regulation', label: 'Regulation', icon: '⚖', color: '#ef4444' },
  { id: 'security', label: 'Security', icon: '🔒', color: '#dc2626' },
  { id: 'macro', label: 'Macro', icon: '📈', color: '#10b981' },
  { id: 'memecoin', label: 'Memecoin', icon: '🐸', color: '#f97316' },
  { id: 'layer2', label: 'Layer 2', icon: '⧫', color: '#8b5cf6' },
  { id: 'stablecoin', label: 'Stablecoin', icon: '💲', color: '#22d3ee' },
  { id: 'etf', label: 'ETF', icon: '🏛', color: '#e879f9' },
  { id: 'onchain', label: 'Onchain', icon: 'O', color: '#34d399' },
  { id: 'gaming', label: 'Gaming', icon: '🎮', color: '#f43f5e' },
  { id: 'privacy', label: 'Privacy', icon: '🛡', color: '#a78bfa' },
  { id: 'mining', label: 'Mining', icon: '⛏', color: '#fb923c' },
];

export const DEFAULT_WEIGHT = 50;

// ─── Helper Functions ─────────────────────────────────────────

export function getDefaultProtocols(): Record<string, ProtocolWeight> {
  const p: Record<string, ProtocolWeight> = {};
  for (const proto of PROTOCOLS) {
    p[proto.id] = { weight: DEFAULT_WEIGHT, minEngagement: 0, verifiedOnly: false, minContentLength: 0 };
  }
  return p;
}

export function getDefaultFeedMixConfig(): FeedMixConfig {
  return {
    protocols: getDefaultProtocols(),
    contentTypes: { posts: 100, images: 50, videos: 50, links: 30, threads: 40 },
    qualityThresholds: {
      globalMinEngagement: 0,
      hideLowQuality: false,
      hideThreshold: 1.0,
      verifiedOnly: false,
      minContentLength: 0,
    },
  };
}

export const PREBUILT_MIXES: SavedMix[] = [];

export function getDefaultWeights(): Record<string, number> {
  const w: Record<string, number> = {};
  for (const t of TOPICS) w[t.id] = DEFAULT_WEIGHT;
  return w;
}

export function countTunedTopics(weights: Record<string, number>): number {
  return Object.values(weights).filter((v) => v !== DEFAULT_WEIGHT).length;
}

export function encodeTopicWeights(weights: Record<string, number>): string {
  return Object.entries(weights)
    .filter(([, v]) => v !== DEFAULT_WEIGHT)
    .map(([k, v]) => `${k}:${v}`)
    .join(',');
}

// ─── LocalStorage Persistence ─────────────────────────────────

const LS_FEED_MIX = 'df_feed_mix_config';
const LS_SAVED_MIXES = 'df_saved_mixes';

export function loadFeedMixConfig(): FeedMixConfig {
  if (typeof window === 'undefined') return getDefaultFeedMixConfig();
  try {
    const raw = localStorage.getItem(LS_FEED_MIX);
    if (raw) {
      const parsed = JSON.parse(raw) as FeedMixConfig;
      const defaults = getDefaultFeedMixConfig();
      return {
        protocols: { ...defaults.protocols, ...parsed.protocols },
        contentTypes: { ...defaults.contentTypes, ...parsed.contentTypes },
        qualityThresholds: { ...defaults.qualityThresholds, ...parsed.qualityThresholds },
      };
    }
  } catch { /* ignore */ }
  return getDefaultFeedMixConfig();
}

export function saveFeedMixConfig(config: FeedMixConfig): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(LS_FEED_MIX, JSON.stringify(config)); } catch { /* quota */ }
}

export function loadSavedMixes(): SavedMix[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LS_SAVED_MIXES);
    return raw ? (JSON.parse(raw) as SavedMix[]) : [];
  } catch { return []; }
}

export function saveSavedMixes(mixes: SavedMix[]): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(LS_SAVED_MIXES, JSON.stringify(mixes)); } catch { /* quota */ }
}
