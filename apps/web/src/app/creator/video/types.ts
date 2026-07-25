'use client';

export type VideoTab = 'shorts' | 'videos' | 'live-short' | 'live-full' | 'my-content';
export type PublishTarget = 'degenfeed' | 'peertube' | 'farcaster' | 'zora' | 'nostr' | 'youtube';

export interface VideoDraft {
  id: string;
  title: string;
  description: string;
  tags: string[];
  visibility: 'public' | 'unlisted' | 'followers' | 'token-gated';
  monetization: { tips: boolean; ads: boolean; subscription: boolean };
  publishTargets: PublishTarget[];
  file: File | null;
  thumbnail: string | null;
  category: string;
  duration: number;
  createdAt: number;
}

export interface ShortDraft {
  id: string;
  title: string;
  description: string;
  hashtags: string[];
  publishTargets: PublishTarget[];
  recordedBlob: Blob | null;
  previewUrl: string | null;
  musicTrack: string | null;
  filter: string;
  textOverlay: string;
  createdAt: number;
}

export interface LiveConfig {
  title: string;
  description: string;
  category: string;
  tags: string[];
  thumbnail: string | null;
  format: 'portrait' | 'landscape';
  platforms: PublishTarget[];
  tipsEnabled: boolean;
  tokenGated: boolean;
  tipGoal: number;
  chatEnabled: boolean;
}

export interface VideoAnalyticsData {
  totalViews: number;
  totalWatchTime: number;
  avgViewDuration: number;
  tipRevenue: number;
  newFollowers: number;
  topContent: Array<{ title: string; views: number; revenue: number }>;
  bestTimes: Array<{ day: string; hour: number; engagement: number }>;
}

export const TABS: { id: VideoTab; label: string; icon: string; desc: string }[] = [
  { id: 'shorts', label: 'Shorts', icon: '🎬', desc: 'TikTok-style vertical videos' },
  { id: 'videos', label: 'Videos', icon: '📹', desc: 'YouTube-style long-form' },
  { id: 'live-short', label: 'Live (Short)', icon: '📱', desc: 'Vertical live stream' },
  { id: 'live-full', label: 'Live (Full)', icon: '🖥️', desc: 'Horizontal live stream' },
  { id: 'my-content', label: 'My Content', icon: '📁', desc: 'All your videos & streams' },
];

export const PUBLISH_TARGETS: { id: PublishTarget; label: string; icon: string; color: string }[] = [
  { id: 'degenfeed', label: 'DegenFeed', icon: '◆', color: '#00ff41' },
  { id: 'peertube', label: 'PeerTube', icon: '▶', color: '#f2691d' },
  { id: 'farcaster', label: 'Farcaster', icon: '◈', color: '#8a63d2' },
  { id: 'zora', label: 'Zora', icon: '⧫', color: '#f5a623' },
  { id: 'nostr', label: 'Nostr', icon: '⚡', color: '#8e30eb' },
  { id: 'youtube', label: 'YouTube', icon: '▶', color: '#ff0000' },
];

export const CATEGORIES = [
  'Entertainment', 'Music', 'Gaming', 'Education', 'News',
  'Tech', 'Crypto', 'DeFi', 'Trading', 'Comedy', 'Sports', 'Art',
];

export const FILTERS = [
  { id: 'none', label: 'None' }, { id: 'vintage', label: 'Vintage' },
  { id: 'noir', label: 'Noir' }, { id: 'neon', label: 'Neon' },
  { id: 'warm', label: 'Warm' }, { id: 'cool', label: 'Cool' },
  { id: 'drama', label: 'Drama' }, { id: 'fade', label: 'Fade' },
  { id: 'chrome', label: 'Chrome' },
];

export const MUSIC_TRACKS = [
  { id: 'none', label: 'No Music' }, { id: 'lo-fi', label: 'Lo-Fi Beats' },
  { id: 'phonk', label: 'Phonk' }, { id: 'edm', label: 'EDM' },
  { id: 'jazz', label: 'Jazz' }, { id: 'ambient', label: 'Ambient' },
  { id: 'hiphop', label: 'Hip Hop' }, { id: 'rock', label: 'Rock' },
];

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function generateId(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
