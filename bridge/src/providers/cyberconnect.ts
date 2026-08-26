/**
 * CyberConnect Provider
 *
 * Fetches posts and social data from CyberConnect's decentralized social graph.
 * CyberConnect is a decentralized social graph protocol with on-chain profiles,
 * follows, and content (EssenceNFT).
 *
 * API: GraphQL at https://api.cyberconnect.dev/
 *
 * Strategy:
 * 1. Query public profiles and their recent content
 * 2. Use curated accounts for content discovery
 */

import type { SchemaGuard, UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;

const CC_GRAPHQL = 'https://api.cyberconnect.dev/';

// ─── Types ─────────────────────────────────────────────────────────────

interface CCProfile {
  profileID: string;
  handle?: string;
  avatar?: string;
  metadata?: {
    displayName?: string;
    bio?: string;
  };
  owner?: {
    address: string;
  };
}

interface CCEssence {
  essenceID: string;
  tokenURI: string;
  createdBy: string;
  metadata?: {
    content?: string;
    title?: string;
    description?: string;
    image?: string;
    media?: Array<{ url: string; mediaType: string }>;
  };
  collectedCount: number;
  createdAt: string;
}

interface CCGraphQLResponse {
  data?: {
    profileByHandle?: CCProfile;
    essenceByID?: CCEssence;
    subscribeByProfileID?: { items: Array<{ profile: CCProfile }> };
  };
  errors?: unknown;
}

// ─── Helpers ──────────────────────────────────────────────────────────

function _guessNiches(text: string): string[] {
  const niches: string[] = [];
  const lower = text.toLowerCase();
  if (/\b(btc|bitcoin|eth|ethereum|sol|solana|crypto|defi|nft|web3|blockchain)\b/.test(lower))
    niches.push('crypto');
  if (/\b(ai |artificial|intelligence|llm|agent|machine learning)\b/.test(lower)) niches.push('ai');
  if (/\b(tech|technology|code|programming|software|startup)\b/.test(lower)) niches.push('tech');
  if (/\b(nft|art|collectible|mint|essence)\b/.test(lower)) niches.push('nft');
  if (/\b(sec|regulation|congress|etf)\b/.test(lower)) niches.push('regulation');
  if (niches.length === 0) niches.push('web3');
  return niches;
}

async function graphQLQuery(query: string): Promise<CCGraphQLResponse> {
  try {
    const res = await $fetch(CC_GRAPHQL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'DegenFeed-Bridge/0.1',
      },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return {};
    return (await res.json()) as CCGraphQLResponse;
  } catch (err) {
    // console.log(`[bridge] CyberConnect GraphQL error: ${(err as Error).message}`);
    return {};
  }
}

async function fetchProfilePosts(handle: string): Promise<UnifiedPost[]> {
  const query = `
    {
      profileByHandle(handle: "${handle}") {
        profileID
        handle
        avatar
        metadata { displayName bio }
        owner { address }
      }
    }
  `;

  const res = await graphQLQuery(query);
  const profile = res.data?.profileByHandle;
  if (!profile) return [];

  return [
    {
      id: `cyberconnect:profile:${profile.profileID}`,
      protocol: 'cyberconnect',
      author: {
        id: `cyberconnect:${profile.profileID}`,
        primary: { protocol: 'cyberconnect', id: profile.handle || profile.profileID },
        handles: { cyberconnect: profile.handle || null },
        displayName: profile.metadata?.displayName || profile.handle || 'CC User',
        bio: profile.metadata?.bio || '',
        avatarUrl: profile.avatar || '',
        followerCount: 0,
        followingCount: 0,
        links: [],
        keys: { evmAddress: profile.owner?.address || '' },
      },
      text: `Profile: ${profile.metadata?.displayName || profile.handle || ''}\n${profile.metadata?.bio || ''}`.trim(),
      embeds: [],
      contentType: 'text',
      createdAt: Date.now(),
      metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      engagement: {
        viewerLiked: false,
        viewerReposted: false,
        viewerBookmarked: false,
        raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      },
      raw: profile,
      niches: ['web3'],
    },
  ];
}

// ─── Main ──────────────────────────────────────────────────────────────

const CURATED_HANDLES = [
  'cyberlab',
  'cyberconnect',
  'vitalik',
  'brianzhao',
  'spruceid',
  'chainlink',
  'aave',
  'ens',
  'lensprotocol',
];

export const schema: SchemaGuard = {
  id: 'cyberconnect',
  name: 'CyberConnect',
  description: 'Decentralized social graph protocol for Web3 identities',
  endpoint: '/api/feed/cyberconnect',
  requiresAuth: false,
  contentType: 'mixed',
};

export async function fetchCyberConnectPosts(limit = 20): Promise<UnifiedPost[]> {
  const handles = CURATED_HANDLES.slice(0, Math.max(5, Math.ceil(limit / 3)));

  const results = await Promise.allSettled(handles.map((h) => fetchProfilePosts(h)));

  const all: UnifiedPost[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value);
  }

  // console.log(`[bridge] CyberConnect: ${all.length} profiles`);
  return all.slice(0, limit);
}

/** @alias */
export const fetch = fetchCyberConnectPosts;
