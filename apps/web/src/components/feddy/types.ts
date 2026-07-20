/**
 * Shared types for Feddy Communities components
 */

export type FeddyCategory =
  | 'crypto' | 'tech' | 'art' | 'music' | 'gaming' | 'sports'
  | 'food' | 'travel' | 'fashion' | 'health' | 'education'
  | 'finance' | 'science' | 'literature' | 'film' | 'general';

export type FederationStatus = 'active' | 'limited' | 'suspended';
export type MemberRole = 'owner' | 'moderator' | 'member';

export interface FeddyCommunity {
  id: string;
  name: string;
  displayName: string;
  description: string;
  rules: string[];
  category: FeddyCategory;
  tags: string[];
  owner: string;
  moderators: string[];
  memberCount: number;
  createdAt: number;
  updatedAt: number;
  isPrivate: boolean;
  linkedCoin: string | null;
  gtsHandle: string;
  gtsId: string;
  avatarUrl: string;
  bannerUrl: string;
  federationStatus: FederationStatus;
  totalPosts: number;
}

export interface CommunityMember {
  wallet: string;
  role: MemberRole;
  displayName?: string;
  avatarUrl?: string;
  joinedAt: number;
}

export interface CommunityPost {
  id: string;
  communityId: string;
  author: string;
  authorDisplayName: string;
  authorAvatarUrl?: string;
  text: string;
  embeds?: Array<{ kind: 'image' | 'video' | 'link'; url: string; meta?: Record<string, unknown> }>;
  gtsStatusId: string;
  createdAt: number;
  likes: number;
  replies: number;
  boosts: number;
}

export interface CommunityStats {
  memberCount: number;
  postCount: number;
  postsLast24h: number;
  postsLast7d: number;
  activeMembers: number;
  topContributors: Array<{ wallet: string; displayName: string; postCount: number }>;
}

export const CATEGORY_LABELS: Record<FeddyCategory, string> = {
  crypto: 'Crypto',
  tech: 'Tech',
  art: 'Art',
  music: 'Music',
  gaming: 'Gaming',
  sports: 'Sports',
  food: 'Food',
  travel: 'Travel',
  fashion: 'Fashion',
  health: 'Health',
  education: 'Education',
  finance: 'Finance',
  science: 'Science',
  literature: 'Literature',
  film: 'Film',
  general: 'General',
};

export const CATEGORY_EMOJIS: Record<FeddyCategory, string> = {
  crypto: '₿',
  tech: '💻',
  art: '🎨',
  music: '🎵',
  gaming: '🎮',
  sports: '⚽',
  food: '🍕',
  travel: '✈️',
  fashion: '👗',
  health: '💪',
  education: '📚',
  finance: '💰',
  science: '🔬',
  literature: '📖',
  film: '🎬',
  general: '🌐',
};
