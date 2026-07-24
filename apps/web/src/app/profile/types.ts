export interface ResolvedIdentity {
  id: string;
  protocol: string;
  displayName?: string;
  handle?: string;
  avatarUrl?: string;
  address?: string;
  color: string;
  isPrimary: boolean;
  verified: boolean;
}

export interface ProfileStats {
  posts: number;
  followers: number;
  following: number;
  tipsReceived: number;
}

export type ProfileTab = 'posts' | 'replies' | 'media' | 'likes';
