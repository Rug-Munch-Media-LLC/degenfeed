/**
 * Orbis Provider
 *
 * Fetches decentralized social content from the Orbis protocol, built on
 * Ceramic Network. Orbis provides composable social data — posts, comments,
 * profiles — stored on Ceramic streams.
 *
 * Orbis SDK is used for client-side integration. For the bridge, we query
 * the Ceramic node via ComposeDB GraphQL or the public Orbis API.
 *
 * API: Ceramic HTTP API at http://127.0.0.1:5102/api/v0/
 *   Orbis public index: https://orbis.club/api/
 *
 * Since Orbis is client-side SDK, we use the public Ceramic node
 * and the Orbis subgraph/indexer for reads.
 */

import type { SchemaGuard, UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;

// ─── Constants ─────────────────────────────────────────────────────────

const ORBIS_API = 'https://orbis.club/api';
const CERAMIC_NODE = process.env.CERAMIC_NODE_URL || 'http://127.0.0.1:5102';

// ─── Types ─────────────────────────────────────────────────────────────

interface OrbisPost {
  stream_id: string;
  content?: {
    body?: string;
    title?: string;
    data?: string;
  };
  creator?: string;
  creator_details?: {
    did?: string;
    metadata?: {
      address?: string;
      ensName?: string;
    };
    profile?: {
      username?: string;
      displayName?: string;
      description?: string;
      pfp?: string;
    };
  };
  context?: string;
  context_details?: {
    name?: string;
    description?: string;
    pfp?: string;
  };
  timestamp?: number;
  indexed_at?: number;
  count_likes?: number;
  count_replies?: number;
  count_haha?: number;
  count_ups?: number;
  count_down?: number;
}

interface OrbisFeedResponse {
  data?: OrbisPost[];
  error?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────

function guessOrbisNiches(text: string): string[] {
  const lower = text.toLowerCase();
  const n: string[] = [];
  if (/\b(crypto|blockchain|web3|bitcoin|ethereum|solana|defi|nft)\b/.test(lower)) n.push('crypto');
  if (/\b(orbis|ceramic|composedb|did|verifiable)\b/.test(lower)) n.push('decentralized identity');
  if (/\b(ai|artificial|intelligence|llm)\b/.test(lower)) n.push('ai');
  if (/\b(dao|governance|community|vote|proposal)\b/.test(lower)) n.push('dao');
  if (/\b(social|decentralized|fediverse|activitypub)\b/.test(lower)) n.push('decentralized social');
  if (n.length === 0) n.push('web3');
  return n;
}

// ─── Mapping ──────────────────────────────────────────────────────────

function orbisPostToUnified(post: OrbisPost): UnifiedPost {
  const body = post.content?.body || post.content?.data || post.content?.title || '';
  const title = post.content?.title || '';
  const text = title ? `${title}\n\n${body}` : body;
  const creator = post.creator_details?.profile || post.creator_details?.metadata;
  const displayName = creator?.displayName || creator?.username || post.creator_details?.did?.slice(0, 10) || 'Orbis User';
  const handle = creator?.username || post.creator_details?.metadata?.ensName || post.creator_details?.did || '';
  const avatar = creator?.pfp || '';
  const contextName = post.context_details?.name || '';

  return {
    id: `orbis:${post.stream_id}`,
    protocol: 'orbis',
    author: {
      id: `orbis:${post.creator || post.creator_details?.did || 'unknown'}`,
      primary: { protocol: 'orbis', id: handle || post.creator_details?.did || 'unknown' },
      handles: { orbis: handle, ens: post.creator_details?.metadata?.ensName || null },
      displayName,
      bio: creator?.description || '',
      avatarUrl: avatar || '',
      followerCount: 0, followingCount: 0, links: [], keys: { did: post.creator_details?.did || '' },
    },
    text: text.slice(0, 2000),
    embeds: [],
    contentType: text.length > 500 ? 'article' : 'text',
    createdAt: (post.timestamp || post.indexed_at || Date.now()) * 1000,
    metrics: {
      likes: post.count_likes || 0,
      reposts: 0,
      replies: post.count_replies || 0,
      quotes: 0,
    },
    engagement: {
      viewerLiked: false, viewerReposted: false, viewerBookmarked: false,
      raw: { likes: post.count_likes || 0, reposts: 0, replies: post.count_replies || 0, quotes: 0 },
    },
    raw: post,
    niches: guessOrbisNiches(text + ' ' + contextName),
  };
}

// ─── Fetch Logic ──────────────────────────────────────────────────────

async function fetchFromOrbisApi(limit: number): Promise<UnifiedPost[]> {
  try {
    const res = await $fetch(`${ORBIS_API}/posts?limit=${limit}`, {
      headers: { 'User-Agent': 'DegenFeed-Bridge/0.1 (Orbis)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = await res.json() as OrbisFeedResponse;
    if (data.error) return [];
    const posts = data.data || [];
    if (!Array.isArray(posts)) return [];
    return posts.slice(0, limit).map(orbisPostToUnified);
  } catch (err) {
    console.log(`[bridge] Orbis API error: ${(err as Error).message}`);
    return [];
  }
}

// ─── Main ──────────────────────────────────────────────────────────────

export const schema: SchemaGuard = {
  id: 'orbis',
  name: 'Orbis',
  description: 'Decentralized social on Ceramic Network',
  endpoint: '/api/feed/orbis',
  requiresAuth: false,
  contentType: 'social',
};

export async function fetchOrbisPosts(limit = 20): Promise<UnifiedPost[]> {
  const posts = await fetchFromOrbisApi(limit);
  console.log(`[bridge] Orbis: ${posts.length} posts`);
  return posts;
}

export const fetch = fetchOrbisPosts;
