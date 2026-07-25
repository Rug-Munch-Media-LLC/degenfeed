/**
 * DeSo (Decentralized Social) Blockchain Provider
 *
 * Fetches posts from the DeSo blockchain via its REST API.
 * DeSo is a layer-1 blockchain for decentralized social applications.
 *
 * API: https://api.deso.org
 * Endpoints: /api/v0/get-posts-stateless, /api/v0/get-hot-feed
 *
 * Strategy:
 * 1. Public DeSo API node
 * 2. Hot feed + global feed
 */

import type { SchemaGuard, UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;

const DESO_NODE = process.env.DESO_API_URL || 'https://api.deso.org';

// ─── Types ─────────────────────────────────────────────────────────────

interface DeSoProfile {
  PublicKeyBase58Check: string;
  Username: string;
  Description: string;
  ProfilePic: string;
  CoinPrice: number;
  CoinPriceDeSo: number;
  DAOCoinLocked: number;
  IsVerified: boolean;
  IsGraylisted: boolean;
}

interface DeSoPostEntry {
  PostHashHex: string;
  PosterPublicKeyBase58Check: string;
  ParentStakeID: string;
  Body: string;
  ImageURLs: string[];
  VideoURLs: string[];
  RepostedPostEntryResponse: DeSoPostEntry | null;
  TimestampNanos: number;
  IsHidden: boolean;
  ProfileEntryResponse: DeSoProfile | null;
  LikeCount: number;
  DiamondCount: number;
  CommentCount: number;
  RepostCount: number;
  QuoteRepostCount: number;
  HotnessScore: number;
}

interface DeSoPostsResponse {
  Posts: DeSoPostEntry[];
  NextPage?: {
    PostHashHex: string;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────

function guessNiches(text: string, username?: string): string[] {
  const niches: string[] = [];
  const lower = `${text} ${username || ''}`.toLowerCase();

  if (/\b(btc|bitcoin|satoshi|halving)\b/.test(lower)) niches.push('bitcoin');
  if (/\b(eth|ethereum|vitalik|pectra)\b/.test(lower)) niches.push('ethereum');
  if (/\b(sol|solana)\b/.test(lower)) niches.push('solana');
  if (/\b(defi|liquidity|yield|farm|swap|dex|staking)\b/.test(lower)) niches.push('defi');
  if (/\b(nft|art|collectible|mint)\b/.test(lower)) niches.push('nft');
  if (/\b(ai |artificial|intelligence|llm|agent|machine learning)\b/.test(lower)) niches.push('ai');
  if (/\b(deso|bitclout|clout|creator coin|diamond)\b/.test(lower)) niches.push('deso');
  if (/\b(crypto|blockchain|web3)\b/.test(lower)) niches.push('crypto');
  if (/\b(sec|regulation|etf)\b/.test(lower)) niches.push('regulation');
  if (/\b(meme|pepe|doge|shib|bonk)\b/.test(lower)) niches.push('memecoin');
  if (/\b(tech|technology|programming|code|software|startup)\b/.test(lower)) niches.push('tech');

  if (niches.length === 0) niches.push('crypto');
  return niches;
}

function desoPostToPost(entry: DeSoPostEntry): UnifiedPost {
  const profile = entry.ProfileEntryResponse;
  const body = entry.Body || '';
  const imageUrls = entry.ImageURLs || [];
  const videoUrls = entry.VideoURLs || [];

  return {
    id: `deso:${entry.PostHashHex}`,
    protocol: 'deso',
    author: {
      id: `deso:${profile?.PublicKeyBase58Check || entry.PosterPublicKeyBase58Check}`,
      primary: {
        protocol: 'deso',
        id: profile?.Username || entry.PosterPublicKeyBase58Check,
      },
      handles: { deso: profile?.Username || entry.PosterPublicKeyBase58Check },
      displayName: profile?.Username || 'DeSo User',
      bio: profile?.Description || '',
      avatarUrl: profile?.ProfilePic || '',
      verified: profile?.IsVerified ? [{ protocol: 'deso', badge: 'verified' }] : [],
      followerCount: 0,
      followingCount: 0,
      links: [],
      keys: {},
    },
    text: body,
    embeds: [
      ...imageUrls.map((url: string) => ({ kind: 'image' as const, url })),
      ...videoUrls.map((url: string) => ({ kind: 'video' as const, url })),
    ],
    contentType: body.length > 500 ? 'article' : 'text',
    createdAt: Math.floor(entry.TimestampNanos / 1e6),
    metrics: {
      likes: (entry.LikeCount || 0) + (entry.DiamondCount || 0),
      reposts: (entry.RepostCount || 0) + (entry.QuoteRepostCount || 0),
      replies: entry.CommentCount || 0,
      quotes: entry.QuoteRepostCount || 0,
    },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: {
        likes: (entry.LikeCount || 0) + (entry.DiamondCount || 0),
        reposts: (entry.RepostCount || 0) + (entry.QuoteRepostCount || 0),
        replies: entry.CommentCount || 0,
        quotes: entry.QuoteRepostCount || 0,
      },
    },
    raw: entry,
    niches: guessNiches(body, profile?.Username),
  };
}

async function fetchHotFeed(limit: number): Promise<UnifiedPost[]> {
  try {
    const res = await $fetch(`${DESO_NODE}/api/v0/get-hot-feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'DegenFeed-Bridge/0.1' },
      body: JSON.stringify({
        NumToFetch: Math.min(limit, 50),
        MediaRequired: false,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { HotFeedPage: DeSoPostEntry[] };
    if (!data.HotFeedPage) return [];
    return data.HotFeedPage.filter((p) => !p.IsHidden).map(desoPostToPost);
  } catch (err) {
    console.log(`[bridge] DeSo hot feed error: ${(err as Error).message}`);
    return [];
  }
}

async function fetchGlobalFeed(limit: number): Promise<UnifiedPost[]> {
  try {
    const res = await $fetch(`${DESO_NODE}/api/v0/get-posts-stateless`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'DegenFeed-Bridge/0.1' },
      body: JSON.stringify({
        NumToFetch: Math.min(limit, 50),
        GetPostsForGlobalWhitelist: true,
        MediaRequired: false,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as DeSoPostsResponse;
    if (!data.Posts) return [];
    return data.Posts.filter((p) => !p.IsHidden).map(desoPostToPost);
  } catch (err) {
    console.log(`[bridge] DeSo global feed error: ${(err as Error).message}`);
    return [];
  }
}

// ─── Main ──────────────────────────────────────────────────────────────

export const schema: SchemaGuard = {
  id: 'deso',
  name: 'DeSo / Bitclout',
  description: 'Layer-1 blockchain for decentralized social apps',
  endpoint: '/api/feed/deso',
  requiresAuth: false,
  contentType: 'mixed',
};

export async function fetchDeSoPosts(limit = 20): Promise<UnifiedPost[]> {
  const perSource = Math.max(5, Math.ceil(limit / 2));

  const [hot, global] = await Promise.all([
    fetchHotFeed(perSource),
    fetchGlobalFeed(perSource),
  ]);

  const all = [...hot, ...global];

  // Deduplicate
  const seen = new Set<string>();
  const deduped: UnifiedPost[] = [];
  for (const p of all) {
    if (!seen.has(p.id) && deduped.length < limit) {
      seen.add(p.id);
      deduped.push(p);
    }
  }

  console.log(`[bridge] DeSo: ${deduped.length} posts`);
  return deduped;
}

/** @alias */
export const fetch = fetchDeSoPosts;
