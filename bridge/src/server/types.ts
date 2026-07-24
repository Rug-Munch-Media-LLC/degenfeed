// ─── Types (mirror UnifiedPost shape) ──────────────────────────────────

export interface UnifiedIdentity {
  id: string;
  primary: { protocol: string; id: string };
  handles: Record<string, string | null>;
  displayName: string;
  bio: string;
  avatarUrl: string;
  followerCount: number;
  followingCount: number;
  links: { label: string; url: string }[];
  keys: Record<string, string | undefined>;
}

export interface UnifiedPost {
  id: string;
  protocol: string;
  author: UnifiedIdentity;
  text: string;
  html?: string;
  embeds: { kind: string; url: string; meta?: Record<string, unknown> }[];
  createdAt: number;
  metrics: {
    likes: number;
    reposts: number;
    replies: number;
    quotes: number;
    views?: number;
    zaps?: number;
  };
  engagement: {
    viewerLiked: boolean;
    viewerReposted: boolean;
    viewerBookmarked: boolean;
    raw: { likes: number; reposts: number; replies: number; quotes: number };
  };
  raw: unknown;
  niches: string[];
  contentType?: string;
}

/**
 * SchemaGuard — provider metadata and validation contract.
 * Every provider module MUST export a `schema` of this type.
 */
export interface SchemaGuard {
  id: string;
  name: string;
  description: string;
  endpoint: string;
  requiresAuth: boolean;
  authEnvVar?: string;
  contentType?: string;
}
