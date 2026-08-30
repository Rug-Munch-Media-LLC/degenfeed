/**
 * Ceramic / ComposeDB Provider
 *
 * Ceramic is a decentralized data network for Web3. ComposeDB is a
 * composable GraphQL database built on Ceramic.
 *
 * We run a Ceramic One node (local) and use the ComposeDB client to
 * read/write streams. The bridge queries our node + public Ceramic nodes.
 *
 * API: Ceramic HTTP API at /api/v0/
 *   POST /api/v0/streams — create stream
 *   GET /api/v0/streams/{id} — get stream
 *   POST /api/v0/query — ComposeDB GraphQL query
 *
 * ComposeDB GraphQL endpoint at /graphql
 */

import type { SchemaGuard, UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;

// ─── Constants ─────────────────────────────────────────────────────────

const CERAMIC_NODE = process.env.CERAMIC_NODE_URL || 'http://127.0.0.1:5102';
const PUBLIC_CERAMIC_NODES = ['https://ceramic-clay.3boxlabs.com', 'https://ceramic.memories.xyz'];

// ─── Types ─────────────────────────────────────────────────────────────

// ─── Helpers ──────────────────────────────────────────────────────────

// ─── Mapping ──────────────────────────────────────────────────────────

// ─── Fetch Logic ──────────────────────────────────────────────────────

async function fetchFromCeramicNode(nodeUrl: string, limit: number): Promise<UnifiedPost[]> {
  try {
    // Ping the node to check its alive
    const res = await $fetch(`${nodeUrl}/api/v0/streams?limit=${limit}`, {
      headers: { 'User-Agent': 'DegenFeed-Bridge/0.1 (Ceramic)' },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      return [
        {
          id: `ceramic:node:${nodeUrl}`,
          protocol: 'ceramic',
          author: {
            id: `ceramic:node:${nodeUrl}`,
            primary: { protocol: 'ceramic', id: 'ceramic-node' },
            handles: {},
            displayName: 'Ceramic Node',
            bio: `Ceramic decentralized data node at ${nodeUrl}`,
            avatarUrl: '',
            followerCount: 0,
            followingCount: 0,
            links: [],
            keys: {},
          },
          text: `🔗 Ceramic Node active: ${nodeUrl}\nDecentralized data network ready.`,
          embeds: [],
          contentType: 'status',
          createdAt: Date.now(),
          metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
          engagement: {
            viewerLiked: false,
            viewerReposted: false,
            viewerBookmarked: false,
            raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
          },
          raw: { url: nodeUrl, status: 'ok' },
          niches: ['decentralized data'],
        },
      ];
    }
    return [];
  } catch {
    return [];
  }
}

// ─── Main ──────────────────────────────────────────────────────────────

export const schema: SchemaGuard = {
  id: 'ceramic',
  name: 'Ceramic / ComposeDB',
  description: 'Decentralized data network — composable GraphQL database',
  endpoint: '/api/feed/ceramic',
  requiresAuth: false,
  contentType: 'data',
};

export async function fetchCeramicPosts(limit = 20): Promise<UnifiedPost[]> {
  const allNodes = [CERAMIC_NODE, ...PUBLIC_CERAMIC_NODES];
  const results = await Promise.allSettled(
    allNodes.map((node) => fetchFromCeramicNode(node, Math.ceil(limit / allNodes.length))),
  );
  const all: UnifiedPost[] = [];
  for (const r of results) if (r.status === 'fulfilled') all.push(...r.value);
  // console.log(`[bridge] Ceramic: ${all.length} node statuses`);
  return all.slice(0, limit);
}

export const fetch = fetchCeramicPosts;
