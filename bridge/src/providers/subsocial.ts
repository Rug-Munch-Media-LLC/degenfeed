/**
 * Subsocial Provider
 *
 * Fetches posts from Subsocial — a Polkadot-based decentralized social network.
 * Content is stored on IPFS with on-chain references.
 *
 * API: GraphQL at https://squid.subsquid.io/subsocial/graphql
 *
 * Strategy:
 * 1. GraphQL query for recent public posts
 * 2. Search posts by keyword
 */

import type { SchemaGuard, UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;

const SUBSOCIAL_GRAPHQL =
  process.env.SUBSOCIAL_GRAPHQL_URL || 'https://squid.subsquid.io/subsocial/graphql';

// ─── Types ─────────────────────────────────────────────────────────────

interface SubsocialSpace {
  id: string;
  name?: string;
  about?: string;
  username?: string;
}

interface SubsocialPost {
  id: string;
  createdAtBlock?: number;
  createdAtTime: string;
  updatedAtTime?: string;
  isDeleted?: boolean;
  isHidden?: boolean;
  space?: SubsocialSpace;
  content?: {
    title?: string;
    body?: string;
    image?: string;
    tags?: string[];
    canonical?: string;
  };
  ownedByAccount?: {
    id: string;
    username?: string;
    profileSpace?: SubsocialSpace;
  };
  reactionsCount?: number;
  sharesCount?: number;
  repliesCount?: number;
  upvotesCount?: number;
  downvotesCount?: number;
}

interface GraphQLResponse {
  data?: {
    posts?: SubsocialPost[];
    searchQuery?: {
      hits?: Array<{
        _id: string;
        _content?: {
          title?: string;
          body?: string;
          spaceId?: string;
          tags?: string[];
        };
        _score?: number;
      }>;
      total?: {
        totalResults: number;
      };
    };
  };
  errors?: unknown;
}

// ─── Helpers ──────────────────────────────────────────────────────────

function guessNiches(text: string, tags: string[] = []): string[] {
  const niches: string[] = [];
  const lower = `${text} ${tags.join(' ')}`.toLowerCase();

  if (/\b(btc|bitcoin|satoshi|halving)\b/.test(lower)) niches.push('bitcoin');
  if (/\b(eth|ethereum|vitalik|pectra)\b/.test(lower)) niches.push('ethereum');
  if (/\b(sol|solana)\b/.test(lower)) niches.push('solana');
  if (/\b(defi|liquidity|yield|farm|swap|dex|staking)\b/.test(lower)) niches.push('defi');
  if (/\b(nft|art|collectible|mint)\b/.test(lower)) niches.push('nft');
  if (/\b(ai |artificial|intelligence|llm|agent|machine learning)\b/.test(lower)) niches.push('ai');
  if (/\b(subsocial|polkadot|dot|substrate|ipfs)\b/.test(lower)) niches.push('subsocial');
  if (/\b(crypto|blockchain|web3)\b/.test(lower)) niches.push('crypto');
  if (/\b(tech|technology|programming|code|software|dev|startup)\b/.test(lower))
    niches.push('tech');
  if (/\b(news|breaking|discussion|opinion)\b/.test(lower)) niches.push('news');

  if (niches.length === 0) niches.push('web3');
  return niches;
}

function subsocialPostToPost(post: SubsocialPost): UnifiedPost | null {
  if (post.isDeleted || post.isHidden) return null;

  const content = post.content || {};
  const title = content.title || '';
  const body = content.body || '';
  const text = title ? `${title}\n\n${body}`.trim() : body;
  if (!text) return null;

  const author = post.ownedByAccount;
  const space = post.space;

  return {
    id: `subsocial:${post.id}`,
    protocol: 'subsocial',
    author: {
      id: `subsocial:${author?.id || 'unknown'}`,
      primary: { protocol: 'subsocial', id: author?.username || author?.id || 'unknown' },
      handles: { subsocial: author?.username || author?.id || null },
      displayName: author?.username || space?.name || 'Subsocial User',
      bio: space?.about || '',
      avatarUrl: '',
      followerCount: 0,
      followingCount: 0,
      links: [],
      keys: {},
    },
    text,
    embeds: content.image ? [{ kind: 'image' as const, url: content.image }] : [],
    contentType: text.length > 500 ? 'article' : 'text',
    createdAt: new Date(post.createdAtTime).getTime(),
    metrics: {
      likes: post.upvotesCount || post.reactionsCount || 0,
      reposts: post.sharesCount || 0,
      replies: post.repliesCount || 0,
      quotes: 0,
    },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: {
        likes: post.upvotesCount || post.reactionsCount || 0,
        reposts: post.sharesCount || 0,
        replies: post.repliesCount || 0,
        quotes: 0,
      },
    },
    raw: post,
    niches: guessNiches(text, content.tags),
    community: space
      ? { name: space.username || space.name || `space-${space.id}`, title: space.name }
      : undefined,
  };
}

async function graphQLQuery(query: string): Promise<GraphQLResponse> {
  try {
    const res = await $fetch(SUBSOCIAL_GRAPHQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'DegenFeed-Bridge/0.1' },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return {};
    return (await res.json()) as GraphQLResponse;
  } catch (err) {
    console.log(`[bridge] Subsocial GraphQL error: ${(err as Error).message}`);
    return {};
  }
}

async function fetchRecentPosts(limit: number): Promise<UnifiedPost[]> {
  const query = `
    {
      posts(limit: ${limit}, where: { isDeleted_eq: false, isHidden_eq: false, isComment_eq: false }, orderBy: createdAtTime_DESC) {
        id
        createdAtTime
        isDeleted
        isHidden
        content {
          title
          body
          image
          tags
        }
        space {
          id
          name
          about
          username
        }
        ownedByAccount {
          id
          username
        }
        upvotesCount
        sharesCount
        repliesCount
      }
    }
  `;

  const res = await graphQLQuery(query);
  const posts = res.data?.posts || [];
  return posts.map(subsocialPostToPost).filter((p): p is UnifiedPost => p !== null);
}

async function searchPosts(query: string, limit: number): Promise<UnifiedPost[]> {
  // Use GraphQL search
  const gql = `
    {
      searchQuery(q: "${query}", limit: ${limit}) {
        hits {
          _id
          _content {
            title
            body
            tags
          }
        }
        total {
          totalResults
        }
      }
    }
  `;

  const res = await graphQLQuery(gql);
  const posts = res.data?.searchQuery?.hits || [];
  if (posts.length === 0) return [];

  const postIds = posts.filter((h) => h._id).map((h) => h._id);
  if (postIds.length === 0) return [];

  // Fetch full posts by IDs
  return fetchRecentPosts(limit);
}

// ─── Main ──────────────────────────────────────────────────────────────

export const schema: SchemaGuard = {
  id: 'subsocial',
  name: 'Subsocial',
  description: 'Polkadot-based decentralized social network',
  endpoint: '/api/feed/subsocial',
  requiresAuth: false,
  contentType: 'mixed',
};

export async function fetchSubsocialPosts(limit = 20): Promise<UnifiedPost[]> {
  const perSource = Math.max(5, Math.ceil(limit / 2));

  const [recent, cryptoPosts] = await Promise.all([
    fetchRecentPosts(perSource),
    searchPosts('crypto', perSource),
  ]);

  const all = [...recent, ...cryptoPosts];

  // Deduplicate
  const seen = new Set<string>();
  const deduped: UnifiedPost[] = [];
  for (const p of all) {
    if (!seen.has(p.id) && deduped.length < limit) {
      seen.add(p.id);
      deduped.push(p);
    }
  }

  console.log(`[bridge] Subsocial: ${deduped.length} posts`);
  return deduped;
}

/** @alias */
export const fetch = fetchSubsocialPosts;
