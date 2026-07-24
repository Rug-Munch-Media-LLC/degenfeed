/**
 * Search type definitions shared across SearchOverlay components.
 */

export interface SearchResult {
  id: string;
  protocol: string;
  author: { displayName: string; avatarUrl?: string };
  text: string;
  url: string | null;
  image: string | null;
  niches: string[];
  createdAt: number;
  metrics: { likes: number; reposts: number; replies: number; quotes: number };
}

export interface IdentityResult {
  id: string;
  protocol: string;
  displayName: string;
  handle: string | null;
  avatarUrl: string | null;
  bio: string;
  postCount: number;
}

export interface CommunityResult {
  id: string;
  name: string;
  protocol: string;
  description: string;
  memberCount: number;
  url: string;
  icon: string | null;
}

export interface VideoResult {
  id: string;
  title: string;
  source: string;
  channelName: string;
  thumbnailUrl: string | null;
  url: string;
  views: number;
  durationSeconds: number;
  publishedAt: number;
}

export interface SearchResponse {
  data?: SearchResult[];
  identities?: IdentityResult[];
  communities?: CommunityResult[];
  videos?: VideoResult[];
}

export type ResultItemType = 'identity' | 'post' | 'community' | 'video';

export interface FlatItem {
  type: ResultItemType;
  data: IdentityResult | SearchResult | CommunityResult | VideoResult;
}
