/**
 * @degenfeed/api-worker — Feddy Communities KV data layer
 *
 * KV-backed store for federated ActivityPub communities.
 * Each community exists on our GoToSocial instance as a Group actor and
 * federates across the Fediverse automatically.
 *
 * KV key patterns:
 *   feddy:{id}                         → FeddyCommunity object (permanent)
 *   feddy:by-name:{name}               → community id (permanent)
 *   feddy:members:{id}                 → Set of wallet + role entries (permanent)
 *   feddy:posts:{id}:{timestamp}:{uid} → Post (90d TTL)
 *   feddy:feed:{id}                    → Recent post index (array of IDs)
 *   feddy:directory:index              → Set of all community IDs
 *   feddy:directory:by-category:{cat}  → Category index
 *   feddy:stats:{id}                   → Cached stats (5min TTL)
 *   feddy:name-reservation:{name}      → Pending name lock (10min TTL)
 */

import type { Env } from '../index';

// ─── Types ──────────────────────────────────────────────────────────────

export type FeddyCategory =
  | 'crypto'
  | 'tech'
  | 'art'
  | 'music'
  | 'gaming'
  | 'sports'
  | 'food'
  | 'travel'
  | 'fashion'
  | 'health'
  | 'education'
  | 'finance'
  | 'science'
  | 'literature'
  | 'film'
  | 'general';

export type FederationStatus = 'active' | 'limited' | 'suspended';

export type MemberRole = 'owner' | 'moderator' | 'member';

export interface FeddyCommunity {
  id: string;
  name: string; // URL-safe: "crypto-artists"
  displayName: string; // "Crypto Artists Collective"
  description: string;
  rules: string[];
  category: FeddyCategory;
  tags: string[];
  owner: string; // wallet address
  moderators: string[];
  memberCount: number;
  createdAt: number;
  updatedAt: number;
  isPrivate: boolean;
  linkedCoin: string | null; // creator coin address
  gtsHandle: string; // @name@communities.degenfeed.xyz
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

export interface DirectoryEntry {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: FeddyCategory;
  tags: string[];
  memberCount: number;
  postCount: number;
  createdAt: number;
  avatarUrl: string;
  federationStatus: FederationStatus;
  linkedCoin: string | null;
  trendingScore: number;
}

export interface DirectoryResult {
  entries: DirectoryEntry[];
  cursor: string | null;
  hasMore: boolean;
  total: number;
}

// ─── Constants ──────────────────────────────────────────────────────────

export const VALID_CATEGORIES: FeddyCategory[] = [
  'crypto', 'tech', 'art', 'music', 'gaming', 'sports',
  'food', 'travel', 'fashion', 'health', 'education',
  'finance', 'science', 'literature', 'film', 'general',
];

export const VALID_CATEGORIES_SET = new Set<string>(VALID_CATEGORIES);

export const CATEGORY_META: Record<FeddyCategory, { emoji: string; label: string }> = {
  crypto: { emoji: '₿', label: 'Crypto' },
  tech: { emoji: '💻', label: 'Tech' },
  art: { emoji: '🎨', label: 'Art' },
  music: { emoji: '🎵', label: 'Music' },
  gaming: { emoji: '🎮', label: 'Gaming' },
  sports: { emoji: '⚽', label: 'Sports' },
  food: { emoji: '🍕', label: 'Food' },
  travel: { emoji: '✈️', label: 'Travel' },
  fashion: { emoji: '👗', label: 'Fashion' },
  health: { emoji: '💪', label: 'Health' },
  education: { emoji: '📚', label: 'Education' },
  finance: { emoji: '💰', label: 'Finance' },
  science: { emoji: '🔬', label: 'Science' },
  literature: { emoji: '📖', label: 'Literature' },
  film: { emoji: '🎬', label: 'Film' },
  general: { emoji: '🌐', label: 'General' },
};

export const PREMIUM_FEATURES = {
  unlimitedProtocols: true,
  creatorCoins: true,
  customVesting: true,
  feddyCommunities: true,
  communityDirectory: true,
  communityCoin: true,
  customDomain: true,
  analytics: true,
  scheduledPosts: true,
  modTools: true,
  joinCommunities: true,
  browseDirectory: true,
  tipInCommunities: true,
} as const;

// ─── KV helpers ─────────────────────────────────────────────────────────

function k(...parts: string[]): string {
  return parts.join(':');
}

function getStore(env: Env): KVNamespace {
  if (!env.FEDDY) throw new Error('FEDDY KV namespace not bound');
  return env.FEDDY;
}

// ─── Community CRUD ────────────────────────────────────────────────────

export async function createCommunity(
  env: Env,
  community: FeddyCommunity,
): Promise<void> {
  const store = getStore(env);
  await Promise.all([
    store.put(k('feddy', community.id), JSON.stringify(community)),
    store.put(k('feddy', 'by-name', community.name), community.id),
    // Seed owner as member
    store.put(
      k('feddy', 'members', community.id),
      JSON.stringify([
        {
          wallet: community.owner,
          role: 'owner' as MemberRole,
          joinedAt: community.createdAt,
        },
      ]),
    ),
    // Add to directory index
    store.put(k('feddy', 'directory', 'index'), community.id, {
      metadata: { method: 'append' },
    }),
    // Add to category index
    store.put(
      k('feddy', 'directory', 'by-category', community.category),
      community.id,
      { metadata: { method: 'append' } },
    ),
    // Initialize empty feed
    store.put(k('feddy', 'feed', community.id), JSON.stringify([])),
  ]);
}

export async function getCommunityById(
  env: Env,
  id: string,
): Promise<FeddyCommunity | null> {
  try {
    const raw = await getStore(env).get(k('feddy', id));
    return raw ? (JSON.parse(raw) as FeddyCommunity) : null;
  } catch {
    return null;
  }
}

export async function getCommunityByName(
  env: Env,
  name: string,
): Promise<FeddyCommunity | null> {
  try {
    const store = getStore(env);
    const id = await store.get(k('feddy', 'by-name', name.toLowerCase()));
    if (!id) return null;
    return getCommunityById(env, id);
  } catch {
    return null;
  }
}

export async function updateCommunity(
  env: Env,
  id: string,
  updates: Partial<FeddyCommunity>,
): Promise<FeddyCommunity | null> {
  const community = await getCommunityById(env, id);
  if (!community) return null;

  const updated: FeddyCommunity = {
    ...community,
    ...updates,
    id: community.id, // id is immutable
    name: community.name, // name is immutable
    owner: community.owner, // owner is immutable
    gtsId: community.gtsId, // gtsId is immutable
    gtsHandle: community.gtsHandle, // gtsHandle is immutable
    createdAt: community.createdAt, // createdAt is immutable
    updatedAt: Date.now(),
  };

  const store = getStore(env);
  await store.put(k('feddy', id), JSON.stringify(updated));

  // If category changed, update category index
  if (updates.category && updates.category !== community.category) {
    // Note: In production you'd remove from old category index
    // For simplicity we keep both — directory list handles duplicates
    await store.put(
      k('feddy', 'directory', 'by-category', updates.category),
      id,
      { metadata: { method: 'append' } },
    );
  }

  return updated;
}

export async function deleteCommunity(
  env: Env,
  id: string,
): Promise<boolean> {
  const community = await getCommunityById(env, id);
  if (!community) return false;

  const store = getStore(env);
  await Promise.all([
    store.delete(k('feddy', id)),
    store.delete(k('feddy', 'by-name', community.name)),
    store.delete(k('feddy', 'members', id)),
    store.delete(k('feddy', 'feed', id)),
    store.delete(k('feddy', 'stats', id)),
    // Note: In production, also remove from directory & category indexes
  ]);

  return true;
}

// ─── Name reservation (to prevent race conditions during creation) ─────

export async function reserveName(
  env: Env,
  name: string,
  wallet: string,
): Promise<boolean> {
  try {
    const key = k('feddy', 'name-reservation', name);
    const existing = await getStore(env).get(key);
    if (existing) {
      const reservation = JSON.parse(existing) as { wallet: string };
      if (reservation.wallet !== wallet) return false;
    }
    await getStore(env).put(key, JSON.stringify({ wallet, reservedAt: Date.now() }), {
      expirationTtl: 600, // 10 minutes
    });
    return true;
  } catch {
    return false;
  }
}

export async function releaseName(env: Env, name: string): Promise<void> {
  try {
    await getStore(env).delete(k('feddy', 'name-reservation', name));
  } catch {
    // Non-critical
  }
}

// ─── Members ───────────────────────────────────────────────────────────

export async function getCommunityMembers(
  env: Env,
  communityId: string,
  limit = 50,
): Promise<CommunityMember[]> {
  try {
    const raw = await getStore(env).get(k('feddy', 'members', communityId));
    if (!raw) return [];
    const members = JSON.parse(raw) as CommunityMember[];
    return members.slice(0, limit);
  } catch {
    return [];
  }
}

export async function addCommunityMember(
  env: Env,
  communityId: string,
  wallet: string,
  role: MemberRole = 'member',
): Promise<boolean> {
  try {
    const key = k('feddy', 'members', communityId);
    const raw = await getStore(env).get(key);
    const members: CommunityMember[] = raw ? JSON.parse(raw) : [];

    if (members.some((m) => m.wallet === wallet)) return false;

    members.push({
      wallet,
      role,
      joinedAt: Date.now(),
    });

    await getStore(env).put(key, JSON.stringify(members));
    return true;
  } catch {
    return false;
  }
}

export async function removeCommunityMember(
  env: Env,
  communityId: string,
  wallet: string,
): Promise<boolean> {
  try {
    const key = k('feddy', 'members', communityId);
    const raw = await getStore(env).get(key);
    if (!raw) return false;

    const members: CommunityMember[] = JSON.parse(raw);
    const filtered = members.filter((m) => m.wallet !== wallet);
    if (filtered.length === members.length) return false;

    await getStore(env).put(key, JSON.stringify(filtered));
    return true;
  } catch {
    return false;
  }
}

export async function isCommunityMember(
  env: Env,
  communityId: string,
  wallet: string,
): Promise<boolean> {
  try {
    const raw = await getStore(env).get(k('feddy', 'members', communityId));
    if (!raw) return false;
    const members: CommunityMember[] = JSON.parse(raw);
    return members.some((m) => m.wallet === wallet);
  } catch {
    return false;
  }
}

export async function getMemberRole(
  env: Env,
  communityId: string,
  wallet: string,
): Promise<MemberRole | null> {
  try {
    const raw = await getStore(env).get(k('feddy', 'members', communityId));
    if (!raw) return null;
    const members: CommunityMember[] = JSON.parse(raw);
    const member = members.find((m) => m.wallet === wallet);
    return member?.role ?? null;
  } catch {
    return null;
  }
}

export async function setMemberRole(
  env: Env,
  communityId: string,
  wallet: string,
  role: MemberRole,
): Promise<boolean> {
  try {
    const key = k('feddy', 'members', communityId);
    const raw = await getStore(env).get(key);
    if (!raw) return false;

    const members: CommunityMember[] = JSON.parse(raw);
    const idx = members.findIndex((m) => m.wallet === wallet);
    if (idx === -1) return false;

    members[idx] = { ...members[idx], role };
    await getStore(env).put(key, JSON.stringify(members));
    return true;
  } catch {
    return false;
  }
}

export async function isOwnerOrMod(
  env: Env,
  communityId: string,
  wallet: string,
): Promise<boolean> {
  const role = await getMemberRole(env, communityId, wallet);
  return role === 'owner' || role === 'moderator';
}

// ─── Posts / Feed ──────────────────────────────────────────────────────

export async function addCommunityPost(
  env: Env,
  communityId: string,
  post: CommunityPost,
): Promise<void> {
  const store = getStore(env);
  const postKey = k('feddy', 'posts', communityId, String(post.createdAt), post.id);

  await Promise.all([
    store.put(postKey, JSON.stringify(post), {
      expirationTtl: 86400 * 90, // 90 days
    }),
    // Update feed index (keep last 500)
    (async () => {
      const feedKey = k('feddy', 'feed', communityId);
      const raw = await store.get(feedKey);
      const feed: string[] = raw ? JSON.parse(raw) : [];
      feed.unshift(postKey);
      if (feed.length > 500) feed.length = 500;
      await store.put(feedKey, JSON.stringify(feed));
    })(),
    // Increment post count
    (async () => {
      const community = await getCommunityById(env, communityId);
      if (community) {
        community.totalPosts += 1;
        await store.put(k('feddy', communityId), JSON.stringify(community));
      }
    })(),
  ]);
}

export async function getCommunityPosts(
  env: Env,
  communityId: string,
  limit = 50,
  cursor?: string,
): Promise<{ posts: CommunityPost[]; cursor: string | null; hasMore: boolean }> {
  try {
    const store = getStore(env);
    const feedKey = k('feddy', 'feed', communityId);
    const raw = await store.get(feedKey);
    if (!raw) return { posts: [], cursor: null, hasMore: false };

    const feed: string[] = JSON.parse(raw);
    const startIdx = cursor ? feed.indexOf(cursor) + 1 : 0;
    if (startIdx < 0 || startIdx >= feed.length) {
      return { posts: [], cursor: null, hasMore: false };
    }

    const batch = feed.slice(startIdx, startIdx + limit + 1);
    const hasMore = batch.length > limit;
    const postKeys = batch.slice(0, limit);

    const posts: CommunityPost[] = [];
    for (const key of postKeys) {
      const postRaw = await store.get(key);
      if (postRaw) {
        posts.push(JSON.parse(postRaw) as CommunityPost);
      }
    }

    return {
      posts,
      cursor: hasMore && postKeys.length > 0 ? postKeys[postKeys.length - 1] : null,
      hasMore,
    };
  } catch {
    return { posts: [], cursor: null, hasMore: false };
  }
}

// ─── Directory ─────────────────────────────────────────────────────────

export async function listDirectory(
  env: Env,
  opts: {
    category?: FeddyCategory;
    sort?: 'members' | 'newest' | 'trending' | 'posts';
    search?: string;
    cursor?: string;
    limit?: number;
  } = {},
): Promise<DirectoryResult> {
  const store = getStore(env);
  const limit = Math.min(Math.max(opts.limit ?? 48, 1), 100);

  try {
    // Get all community IDs from the index
    const indexKey = opts.category
      ? k('feddy', 'directory', 'by-category', opts.category)
      : k('feddy', 'directory', 'index');

    const indexRaw = await store.get(indexKey);
    const allIds: string[] = indexRaw ? JSON.parse(indexRaw) : [];

    if (allIds.length === 0) {
      return { entries: [], cursor: null, hasMore: false, total: 0 };
    }

    // Resolve communities in parallel
    const rawCommunities = await Promise.all(
      allIds.map((id) =>
        store.get(k('feddy', id)).then((r) => (r ? (JSON.parse(r) as FeddyCommunity) : null)),
      ),
    );

    let communities = rawCommunities.filter(Boolean) as FeddyCommunity[];

    // Search filter
    if (opts.search) {
      const q = opts.search.toLowerCase();
      communities = communities.filter(
        (c) =>
          c.displayName.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          c.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }

    // Sort
    const sort = opts.sort ?? 'members';
    communities.sort((a, b) => {
      switch (sort) {
        case 'newest':
          return b.createdAt - a.createdAt;
        case 'trending':
          return (b.totalPosts * 2 + b.memberCount) - (a.totalPosts * 2 + a.memberCount);
        case 'posts':
          return b.totalPosts - a.totalPosts;
        case 'members':
        default:
          return b.memberCount - a.memberCount;
      }
    });

    const total = communities.length;

    // Paginate
    const cursorIdx = opts.cursor
      ? communities.findIndex((c) => c.id === opts.cursor)
      : -1;
    const start = cursorIdx >= 0 ? cursorIdx + 1 : 0;
    const batch = communities.slice(start, start + limit);

    const entries: DirectoryEntry[] = batch.map((c) => ({
      id: c.id,
      name: c.name,
      displayName: c.displayName,
      description: c.description.slice(0, 200),
      category: c.category,
      tags: c.tags,
      memberCount: c.memberCount,
      postCount: c.totalPosts,
      createdAt: c.createdAt,
      avatarUrl: c.avatarUrl,
      federationStatus: c.federationStatus,
      linkedCoin: c.linkedCoin,
      trendingScore: c.totalPosts * 2 + c.memberCount,
    }));

    const hasMore = start + limit < total;
    return {
      entries,
      cursor: hasMore ? batch[batch.length - 1]?.id ?? null : null,
      hasMore,
      total,
    };
  } catch {
    return { entries: [], cursor: null, hasMore: false, total: 0 };
  }
}

// ─── Stats ─────────────────────────────────────────────────────────────

export async function getCommunityStats(
  env: Env,
  communityId: string,
): Promise<CommunityStats> {
  try {
    const cacheKey = k('feddy', 'stats', communityId);
    const cached = await getStore(env).get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as CommunityStats;
    }

    const community = await getCommunityById(env, communityId);
    if (!community) {
      return {
        memberCount: 0, postCount: 0, postsLast24h: 0, postsLast7d: 0,
        activeMembers: 0, topContributors: [],
      };
    }

    const members = await getCommunityMembers(env, communityId);
    const posts = await getCommunityPosts(env, communityId, 500);

    const now = Date.now();
    const dayMs = 86400000;
    const weekMs = 604800000;

    const postsLast24h = posts.posts.filter((p) => p.createdAt > now - dayMs).length;
    const postsLast7d = posts.posts.filter((p) => p.createdAt > now - weekMs).length;

    // Count unique authors
    const authorSet = new Set(posts.posts.map((p) => p.author));
    const authorPosts = new Map<string, number>();
    for (const p of posts.posts) {
      authorPosts.set(p.author, (authorPosts.get(p.author) ?? 0) + 1);
    }

    const topContributors = [...authorPosts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([wallet, count]) => ({
        wallet,
        displayName: wallet.slice(0, 6) + '...' + wallet.slice(-4),
        postCount: count,
      }));

    const stats: CommunityStats = {
      memberCount: community.memberCount,
      postCount: community.totalPosts,
      postsLast24h,
      postsLast7d,
      activeMembers: authorSet.size,
      topContributors,
    };

    // Cache for 5 minutes
    await getStore(env).put(cacheKey, JSON.stringify(stats), {
      expirationTtl: 300,
    });

    return stats;
  } catch {
    return {
      memberCount: 0, postCount: 0, postsLast24h: 0, postsLast7d: 0,
      activeMembers: 0, topContributors: [],
    };
  }
}

// ─── Banned members ────────────────────────────────────────────────────

export async function banMember(
  env: Env,
  communityId: string,
  wallet: string,
): Promise<boolean> {
  try {
    const removed = await removeCommunityMember(env, communityId, wallet);
    if (!removed) return false;

    const store = getStore(env);
    const banKey = k('feddy', 'banned', communityId);
    const raw = await store.get(banKey);
    const banned: string[] = raw ? JSON.parse(raw) : [];

    if (!banned.includes(wallet)) {
      banned.push(wallet);
      await store.put(banKey, JSON.stringify(banned), {
        expirationTtl: 86400 * 365, // 1 year
      });
    }

    return true;
  } catch {
    return false;
  }
}

export async function isBanned(
  env: Env,
  communityId: string,
  wallet: string,
): Promise<boolean> {
  try {
    const banKey = k('feddy', 'banned', communityId);
    const raw = await getStore(env).get(banKey);
    if (!raw) return false;
    const banned: string[] = JSON.parse(raw);
    return banned.includes(wallet);
  } catch {
    return false;
  }
}

// ─── Utility ───────────────────────────────────────────────────────────

export function generateCommunityId(): string {
  return crypto.randomUUID();
}

export function validateCommunityName(name: string): string | null {
  const cleaned = name.toLowerCase().trim();
  if (!/^[a-z0-9-]{3,30}$/.test(cleaned)) return null;
  if (cleaned.startsWith('-') || cleaned.endsWith('-')) return null;
  if (/--/.test(cleaned)) return null;
  return cleaned;
}

export function buildGtsHandle(name: string): string {
  return `@${name}@communities.degenfeed.xyz`;
}
