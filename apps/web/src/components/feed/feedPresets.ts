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

export const PROTOCOL_META: Record<string, { label: string; color: string; emoji: string }> = {
  nostr: { label: 'Nostr', color: '#8e30eb', emoji: '⚡' },
  farcaster: { label: 'Farcaster', color: '#8a63d2', emoji: '🟣' },
  lens: { label: 'Lens', color: '#abfe2c', emoji: '🌿' },
  bluesky: { label: 'Bluesky', color: '#1185fe', emoji: '🦋' },
  mastodon: { label: 'Mastodon', color: '#6364ff', emoji: '🐘' },
  threads: { label: 'Threads (Experimental)', color: '#888888', emoji: '🧵' },
  reddit: { label: 'Reddit', color: '#ff4500', emoji: '🔴' },
  rss: { label: 'News', color: '#ffa500', emoji: '📰' },
  mirror: { label: 'Mirror.xyz', color: '#0a0a0a', emoji: '🪞' },
  arena: { label: 'Arena.social', color: '#e84142', emoji: '🏟️' },
  paragraph: { label: 'Paragraph.xyz', color: '#6b21a8', emoji: '📝' },
};
