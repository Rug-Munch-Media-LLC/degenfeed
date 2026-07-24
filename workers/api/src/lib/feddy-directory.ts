import type { Env } from '../index';
import { k, getStore } from './feddy-constants';
import type { SortOption } from './feddy-constants';
import type { FeddyCategory, FeddyCommunity, DirectoryEntry, DirectoryResult, AutocompleteResult, CommunityStats, FederationHealth, TreasuryState } from './feddy-types';
import { getCommunityById, getCommunityMembers } from './feddy-community';
import { getCommunityPosts } from './feddy-content';

export async function listDirectory(
  env: Env,
  opts: {
    category?: FeddyCategory;
    sort?: SortOption;
    search?: string;
    cursor?: string;
    limit?: number;
    featured?: boolean;
    remote?: boolean;
  } = {},
): Promise<DirectoryResult> {
  const store = getStore(env);
  const limit = Math.min(Math.max(opts.limit ?? 48, 1), 100);

  try {
    const indexKey = opts.category
      ? k('feddy', 'directory', 'by-category', opts.category)
      : k('feddy', 'directory', 'index');

    const indexRaw = await store.get(indexKey);
    const allIds: string[] = indexRaw ? JSON.parse(indexRaw) : [];

    if (allIds.length === 0) {
      return { entries: [], cursor: null, hasMore: false, total: 0 };
    }

    const rawCommunities = await Promise.all(
      allIds.map((id) =>
        store.get(k('feddy', id)).then((r) => (r ? (JSON.parse(r) as FeddyCommunity) : null)),
      ),
    );

    let communities = rawCommunities.filter(Boolean) as FeddyCommunity[];

    // Optional: filter for remote communities
    if (opts.remote === true) {
      communities = communities.filter((c) => c.remoteInstance);
    }

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

    // Featured filter
    if (opts.featured) {
      communities = communities.filter((c) => (c.featuredUntil ?? 0) > Date.now());
    }

    // Sort
    const sort = opts.sort ?? 'members';
    communities.sort((a, b) => {
      switch (sort) {
        case 'newest':
          return b.createdAt - a.createdAt;
        case 'trending': {
          const aScore = b.totalPosts * 2 + b.memberCount;
          const bScore = a.totalPosts * 2 + a.memberCount;
          return aScore - bScore;
        }
        case 'posts':
          return b.totalPosts - a.totalPosts;
        default:
          return b.memberCount - a.memberCount;
      }
    });

    const total = communities.length;

    const cursorIdx = opts.cursor ? communities.findIndex((c) => c.id === opts.cursor) : -1;
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
      communityTokenSymbol: c.communityTokenSymbol ?? null,
      featuredPosition: c.featuredPosition,
      remoteInstance: c.remoteInstance ?? null,
    }));

    const hasMore = start + limit < total;
    return {
      entries,
      cursor: hasMore ? (batch[batch.length - 1]?.id ?? null) : null,
      hasMore,
      total,
    };
  } catch {
    return { entries: [], cursor: null, hasMore: false, total: 0 };
  }
}

// ─── Autocomplete ──────────────────────────────────────────────────────

export async function autocompleteSearch(
  env: Env,
  prefix: string,
  limit = 10,
): Promise<AutocompleteResult[]> {
  try {
    const store = getStore(env);
    const key = k('feddy', 'autocomplete', prefix.toLowerCase());
    const raw = await store.get(key);
    if (!raw) return [];
    const ids: string[] = JSON.parse(raw);
    const uniqueIds = [...new Set(ids)].slice(0, limit);

    const results: AutocompleteResult[] = [];
    for (const id of uniqueIds) {
      const community = await getCommunityById(env, id);
      if (community) {
        results.push({
          name: community.name,
          displayName: community.displayName,
          avatarUrl: community.avatarUrl,
          memberCount: community.memberCount,
          category: community.category,
        });
      }
    }
    return results;
  } catch {
    return [];
  }
}

// ─── Trending ──────────────────────────────────────────────────────────

export async function getTrendingCommunities(env: Env, limit = 20): Promise<DirectoryEntry[]> {
  const result = await listDirectory(env, { sort: 'trending', limit });
  return result.entries;
}

export async function getSimilarCommunities(
  env: Env,
  communityId: string,
  limit = 6,
): Promise<DirectoryEntry[]> {
  const community = await getCommunityById(env, communityId);
  if (!community) return [];

  // Find communities with same category + tags, excluding self
  const result = await listDirectory(env, {
    category: community.category,
    limit: 50,
  });
  const similar = result.entries
    .filter((e) => e.id !== communityId)
    .sort((a, b) => {
      // Score by tag overlap
      const aOverlap = community.tags.filter((t) => a.tags.includes(t)).length;
      const bOverlap = community.tags.filter((t) => b.tags.includes(t)).length;
      return bOverlap - aOverlap || b.memberCount - a.memberCount;
    })
    .slice(0, limit);

  return similar;
}

export async function getFollowerCommunities(
  env: Env,
  wallet: string,
  limit = 20,
): Promise<DirectoryEntry[]> {
  try {
    const store = getStore(env);
    const key = k('feddy', 'follower-comms', wallet);
    const raw = await store.get(key);
    if (!raw) return [];
    const ids: string[] = JSON.parse(raw);

    const communities = await Promise.all(
      ids.slice(0, limit).map((id) => getCommunityById(env, id)),
    );
    return communities.filter(Boolean).map((c) => {
      if (!c) throw new Error('Unexpected undefined community after filter');
      const totalPosts = c.totalPosts ?? 0;
      const memberCount = c.memberCount ?? 0;
      return {
        id: c.id ?? '',
        name: c.name ?? '',
        displayName: c.displayName ?? '',
        description: (c.description ?? '').slice(0, 200),
        category: c.category ?? ('other' as FeddyCategory),
        tags: c.tags ?? [],
        memberCount,
        postCount: totalPosts,
        createdAt: c.createdAt ?? 0,
        avatarUrl: c.avatarUrl ?? '',
        federationStatus: c.federationStatus ?? 'unknown',
        linkedCoin: c.linkedCoin ?? null,
        trendingScore: totalPosts * 2 + memberCount,
        communityTokenSymbol: c.communityTokenSymbol ?? null,
        featuredPosition: c.featuredPosition,
        remoteInstance: c.remoteInstance ?? null,
      };
    });
  } catch {
    return [];
  }
}

// ─── Stats ─────────────────────────────────────────────────────────────

export async function getCommunityStats(env: Env, communityId: string): Promise<CommunityStats> {
  try {
    const cacheKey = k('feddy', 'stats', communityId);
    const cached = await getStore(env).get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as CommunityStats;
    }

    const community = await getCommunityById(env, communityId);
    if (!community) {
      return {
        memberCount: 0,
        postCount: 0,
        postsLast24h: 0,
        postsLast7d: 0,
        activeMembers: 0,
        topContributors: [],
      };
    }

    const _members = await getCommunityMembers(env, communityId);
    const posts = await getCommunityPosts(env, communityId, 500);

    const now = Date.now();
    const dayMs = 86400000;
    const weekMs = 604800000;

    const postsLast24h = posts.posts.filter((p) => p.createdAt > now - dayMs).length;
    const postsLast7d = posts.posts.filter((p) => p.createdAt > now - weekMs).length;

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
        displayName: `${wallet.slice(0, 6)}...${wallet.slice(-4)}`,
        postCount: count,
      }));

    // Fetch federation health
    const healthRaw = await getStore(env).get(k('feddy', 'federation-health', communityId));
    const health: FederationHealth | null = healthRaw ? JSON.parse(healthRaw) : null;

    // Fetch treasury
    const treasuryRaw = await getStore(env).get(k('feddy', 'treasury', communityId));
    const treasury: TreasuryState | null = treasuryRaw ? JSON.parse(treasuryRaw) : null;

    // Count active events
    const eventsIndexRaw = await getStore(env).get(k('feddy', 'events', communityId, 'index'));
    const eventIds: string[] = eventsIndexRaw ? JSON.parse(eventsIndexRaw) : [];
    const eventsThisMonth = eventIds.length;

    const stats: CommunityStats = {
      memberCount: community.memberCount,
      postCount: community.totalPosts,
      postsLast24h,
      postsLast7d,
      activeMembers: authorSet.size,
      topContributors,
      treasuryBalance: treasury ? Number(treasury.balance) : 0,
      eventsThisMonth,
      activePolls: 0,
      memberGrowth7d: 0,
      postGrowth7d: 0,
      federatedInstances: health?.followerInstances.length ?? 0,
    };

    await getStore(env).put(cacheKey, JSON.stringify(stats), {
      expirationTtl: 300,
    });
    return stats;
  } catch {
    return {
      memberCount: 0,
      postCount: 0,
      postsLast24h: 0,
      postsLast7d: 0,
      activeMembers: 0,
      topContributors: [],
    };
  }
}

