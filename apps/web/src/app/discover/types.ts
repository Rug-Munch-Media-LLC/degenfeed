export interface TrendingPost {
  id: string;
  protocol: string;
  text: string;
  createdAt: number;
  author: { id: string; displayName: string; avatarUrl?: string; handles: Record<string, string> };
  metrics: { likes: number; reposts: number; replies: number; quotes: number };
  niches: string[];
  image?: string | null;
}

export interface DiscoverCommunity {
  id: string;
  name: string;
  displayName?: string;
  description?: string;
  icon?: string;
  memberCount: number;
  postCount: number;
  protocols: string[];
  tags?: string[];
  activityLevel: 'high' | 'medium' | 'low';
}

export interface DiscoverPerson {
  id: string;
  displayName: string;
  handle: string;
  avatarUrl: string;
  protocol: string;
  protocols: string[];
  postCount: number;
  totalEngagement: number;
  topNiches: string[];
}

export interface TrendingTopic {
  topic: string;
  count: number;
  score: number;
}

export interface FeaturedSpace {
  id: string;
  title: string;
  description?: string;
  hostName: string;
  hostAvatarUrl?: string;
  status: 'live' | 'scheduled' | 'ended';
  listeners: number;
  speakers: Array<{ id: string; displayName: string; avatarUrl?: string }>;
  scheduledAt?: string;
}

export interface TrendingItem {
  id: string;
  title: string;
  description: string;
  url: string;
  source: string;
  sourceLabel: string;
  sourceColor: string;
  score: number;
  velocity: number;
  engagement: number;
  thumbnailUrl?: string;
  publishedAt: number;
  metadata: Record<string, unknown>;
}

export type SectionState = 'loading' | 'loaded' | 'empty' | 'error';

export type SectionFetch<T> = (d: T) => { items: unknown[]; total?: number };
