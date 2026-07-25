/**
 * Arena.social Provider
 *
 * Fetches posts from Arena — a social trading platform built on Avalanche.
 * Arena combines social feeds with DeFi: users post threads, trade tokens,
 * and engage with communities. All powered by AVAX.
 *
 * API: REST at https://api.arena.social
 * Endpoints:
 *   GET /threads/feed/trending — trending posts
 *   GET /threads — list threads
 *   GET /threads/feed/trendingPosts — agent API trending
 *
 * Strategy:
 * 1. Trending threads feed (public, no auth needed for read)
 * 2. Recent threads
 * 3. Agent API fallback
 */

import type { SchemaGuard, UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;

const ARENA_API = process.env.ARENA_API_URL || 'https://api.arena.social';
const ARENA_AGENT_API = process.env.ARENA_AGENT_API_URL || 'https://api.starsarena.com/agents';
const ARENA_TOKEN = process.env.ARENA_ACCESS_TOKEN || '';

// ─── Types ─────────────────────────────────────────────────────────────

interface ArenaAuthor {
  id: string;
  handle: string;
  displayName?: string;
  avatar?: string;
  bio?: string;
  followerCount?: number;
  followingCount?: number;
  walletAddress?: string;
  isVerified?: boolean;
}

interface ArenaThread {
  id: string;
  content: string;
  author: ArenaAuthor;
  createdAt: string;
  updatedAt?: string;
  likeCount: number;
  repostCount: number;
  replyCount: number;
  quoteCount: number;
  mediaUrls?: string[];
  communityId?: string;
  communityName?: string;
  tags?: string[];
  isPinned?: boolean;
  isNSFW?: boolean;
}

interface ArenaFeedResponse {
  data?: ArenaThread[];
  threads?: ArenaThread[];
  posts?: ArenaThread[];
  items?: ArenaThread[];
  total?: number;
  nextCursor?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────

function guessNiches(text: string, tags: string[] = []): string[] {
  const niches: string[] = [];
  const lower = `${text} ${tags.join(' ')}`.toLowerCase();

  if (/\b(btc|bitcoin|satoshi|halving)\b/.test(lower)) niches.push('bitcoin');
  if (/\b(eth|ethereum|vitalik|pectra)\b/.test(lower)) niches.push('ethereum');
  if (/\b(sol|solana)\b/.test(lower)) niches.push('solana');
  if (/\b(avax|avalanche|snowman|subnet)\b/.test(lower)) niches.push('avalanche');
  if (/\b(defi|liquidity|yield|farm|swap|dex|staking|trade)\b/.test(lower)) niches.push('defi');
  if (/\b(arena|starsarena)\b/.test(lower)) niches.push('social-trading');
  if (/\b(nft|art|collectible|mint|token)\b/.test(lower)) niches.push('nft');
  if (/\b(ai |artificial|intelligence|llm|agent|machine learning)\b/.test(lower)) niches.push('ai');
  if (/\b(sec|regulation|etf|compliance)\b/.test(lower)) niches.push('regulation');
  if (/\b(meme|pepe|doge|shib|bonk|memecoin)\b/.test(lower)) niches.push('memecoin');
  if (/\b(security|hack|exploit|audit|scam)\b/.test(lower)) niches.push('security');
  if (/\b(crypto|blockchain|web3|token)\b/.test(lower)) niches.push('crypto');
  if (/\b(tech|technology|programming|code|software)\b/.test(lower)) niches.push('tech');

  if (niches.length === 0) niches.push('social-trading');
  return niches;
}

// ─── Mapping ──────────────────────────────────────────────────────────

function avatarUrl(author: ArenaAuthor): string {
  return author.avatar || '';
}

function arenaThreadToPost(t: ArenaThread): UnifiedPost {
  const text = t.content || '';
  return {
    id: `arena:${t.id}`,
    protocol: 'arena',
    author: {
      id: `arena:${t.author.id}`,
      primary: { protocol: 'arena', id: t.author.handle || t.author.id },
      handles: { arena: t.author.handle || null },
      displayName: t.author.displayName || t.author.handle || 'Arena User',
      bio: t.author.bio || '',
      avatarUrl: avatarUrl(t.author),
      followerCount: t.author.followerCount || 0,
      followingCount: t.author.followingCount || 0,
      links: [],
      keys: { evmAddress: t.author.walletAddress || '' },
    },
    text,
    embeds: (t.mediaUrls || []).map((url: string) => ({
      kind: url.match(/\.(mp4|webm|mov)$/i) ? ('video' as const) : ('image' as const),
      url,
    })),
    contentType: text.length > 500 ? 'article' : 'text',
    createdAt: new Date(t.createdAt).getTime(),
    metrics: {
      likes: t.likeCount || 0,
      reposts: t.repostCount || 0,
      replies: t.replyCount || 0,
      quotes: t.quoteCount || 0,
    },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: {
        likes: t.likeCount || 0,
        reposts: t.repostCount || 0,
        replies: t.replyCount || 0,
        quotes: t.quoteCount || 0,
      },
    },
    raw: t,
    niches: guessNiches(text, t.tags),
    community: t.communityName ? { name: t.communityName, title: t.communityName } : undefined,
  };
}

// ─── Fetch Logic ──────────────────────────────────────────────────────

async function fetchTrending(limit: number): Promise<UnifiedPost[]> {
  try {
    const headers: Record<string, string> = {
      'User-Agent': 'DegenFeed-Bridge/0.1 (Arena)',
    };
    if (ARENA_TOKEN) headers.Authorization = `Bearer ${ARENA_TOKEN}`;

    const res = await $fetch(`${ARENA_API}/threads/feed/trending?limit=${limit}`, {
      headers,
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as ArenaFeedResponse;
    const threads = data.threads || data.data || data.posts || data.items || [];
    if (!Array.isArray(threads)) return [];
    return threads.slice(0, limit).map(arenaThreadToPost);
  } catch (err) {
    console.log(`[bridge] Arena trending error: ${(err as Error).message}`);
    return [];
  }
}

async function fetchFromAgentAPI(limit: number): Promise<UnifiedPost[]> {
  try {
    const res = await $fetch(`${ARENA_AGENT_API}/threads/feed/trendingPosts?limit=${limit}`, {
      headers: {
        'User-Agent': 'DegenFeed-Bridge/0.1 (Arena)',
        ...(ARENA_TOKEN ? { Authorization: `Bearer ${ARENA_TOKEN}` } : {}),
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as ArenaFeedResponse;
    const threads = data.threads || data.data || data.posts || [];
    if (!Array.isArray(threads)) return [];
    return threads.slice(0, limit).map(arenaThreadToPost);
  } catch (err) {
    console.log(`[bridge] Arena agent API error: ${(err as Error).message}`);
    return [];
  }
}

async function fetchRecent(limit: number): Promise<UnifiedPost[]> {
  try {
    const headers: Record<string, string> = {
      'User-Agent': 'DegenFeed-Bridge/0.1 (Arena)',
    };
    if (ARENA_TOKEN) headers.Authorization = `Bearer ${ARENA_TOKEN}`;

    const res = await $fetch(`${ARENA_API}/threads?limit=${limit}&sort=new`, {
      headers,
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as ArenaFeedResponse;
    const threads = data.threads || data.data || data.posts || [];
    if (!Array.isArray(threads)) return [];
    return threads.slice(0, limit).map(arenaThreadToPost);
  } catch {
    return [];
  }
}

// ─── Main ──────────────────────────────────────────────────────────────

export const schema: SchemaGuard = {
  id: 'arena',
  name: 'Arena.social',
  description: 'Social trading platform on Avalanche — threads, feeds, communities',
  endpoint: '/api/feed/arena',
  requiresAuth: false,
  contentType: 'mixed',
};

export async function fetchArenaPosts(limit = 20): Promise<UnifiedPost[]> {
  const perSource = Math.max(5, Math.ceil(limit / 3));

  const [trending, recent, agentFeed] = await Promise.all([
    fetchTrending(perSource),
    fetchRecent(perSource),
    fetchFromAgentAPI(perSource).catch(() => [] as UnifiedPost[]),
  ]);

  const all = [...trending, ...recent, ...agentFeed];

  // Deduplicate
  const seen = new Set<string>();
  const deduped: UnifiedPost[] = [];
  for (const p of all) {
    if (!seen.has(p.id) && deduped.length < limit) {
      seen.add(p.id);
      deduped.push(p);
    }
  }

  console.log(`[bridge] Arena: ${deduped.length} posts`);
  return deduped;
}

/** @alias */
export const fetch = fetchArenaPosts;
