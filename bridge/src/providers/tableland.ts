/**
 * Tableland Provider
 *
 * Tableland is a decentralized database network where tables are ERC721
 * tokens. SQLite-based with REST Gateway API for reads.
 *
 * We run a Tableland validator node and query it via the Gateway API.
 *
 * Gateway API at /api/v1/
 *   GET /api/v1/query?statement=SELECT... — SQL read query
 *   POST /api/v1/query — SQL read query (POST)
 *   GET /api/v1/health — node health
 *
 * For the bridge, we:
 * 1. Query public health tables
 * 2. Monitor DegenFeed tables
 * 3. Serve Tableland data as feed items
 */

import type { SchemaGuard, UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;

// ─── Constants ─────────────────────────────────────────────────────────

const TABLELAND_NODE = process.env.TABLELAND_NODE_URL || 'http://127.0.0.1:8103';
const PUBLIC_GATEWAYS = [
  'https://testnets.tableland.network',
  'https://tableland.network',
];

// ─── Types ─────────────────────────────────────────────────────────────

interface TablelandQueryResult {
  columns?: Array<{ name: string }>;
  rows?: Record<string, unknown>[];
  data?: Record<string, unknown>[];
  success?: boolean;
}

interface TablelandHealthResponse {
  healthy?: boolean;
  status?: string;
  nodeId?: string;
  chainId?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────

function guessTablelandNiches(content: string): string[] {
  const lower = content.toLowerCase();
  const n: string[] = [];
  if (/\b(crypto|web3|blockchain|nft|defi|dao)\b/.test(lower)) n.push('crypto');
  if (/\b(tableland|sql|database|query|table)\b/.test(lower)) n.push('database');
  if (/\b(health|monitoring|status|metrics)\b/.test(lower)) n.push('infrastructure');
  if (/\b(analytics|data|stats|report|analysis)\b/.test(lower)) n.push('analytics');
  if (n.length === 0) n.push('database');
  return n;
}

// ─── Fetch Logic ──────────────────────────────────────────────────────

async function fetchNodeHealth(nodeUrl: string): Promise<UnifiedPost[]> {
  try {
    const res = await $fetch(`${nodeUrl}/api/v1/health`, {
      headers: { 'User-Agent': 'DegenFeed-Bridge/0.1 (Tableland)' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = await res.json() as TablelandHealthResponse;
    const healthy = data.healthy !== false;

    return [{
      id: `tableland:node:${nodeUrl}:${Date.now()}`,
      protocol: 'tableland',
      author: {
        id: `tableland:node:${nodeUrl}`,
        primary: { protocol: 'tableland', id: 'tableland-node' },
        handles: {},
        displayName: `Tableland ${data.nodeId ? `Node ${data.nodeId.slice(0, 8)}` : 'Node'}`,
        bio: 'Decentralized database network — SQLite on chain',
        avatarUrl: '', followerCount: 0, followingCount: 0, links: [], keys: {},
      },
      text: healthy
        ? `✅ Tableland Node Healthy\nChain: ${data.chainId || 'N/A'}\nNode: ${data.nodeId || 'N/A'}`
        : '❌ Tableland Node Unhealthy',
      embeds: [{ kind: 'link', url: `${nodeUrl}/api/v1/query?statement=SELECT+1` }],
      contentType: 'status',
      createdAt: Date.now(),
      metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      engagement: {
        viewerLiked: false, viewerReposted: false, viewerBookmarked: false,
        raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      },
      raw: data,
      niches: ['database', 'infrastructure'],
    }];
  } catch (err) {
    console.log(`[bridge] Tableland health error (${nodeUrl}): ${(err as Error).message}`);
    return [];
  }
}

async function fetchQueryResults(nodeUrl: string): Promise<UnifiedPost[]> {
  try {
    // Query the healthbot table as a demo query
    const res = await $fetch(
      `${nodeUrl}/api/v1/query?statement=SELECT+*+FROM+healthbot_80002_1+ORDER+BY+counter+DESC+LIMIT+10&format=objects`,
      {
        headers: { 'User-Agent': 'DegenFeed-Bridge/0.1 (Tableland)', Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!res.ok) return [];

    const result = await res.json() as TablelandQueryResult;
    const rows = result.rows || result.data || [];
    if (!Array.isArray(rows) || rows.length === 0) return [];

    return rows.slice(0, 5).map((row) => ({
      id: `tableland:query:${JSON.stringify(row)}`,
      protocol: 'tableland',
      author: {
        id: 'tableland:system',
        primary: { protocol: 'tableland', id: 'tableland' },
        handles: {},
        displayName: 'Tableland Query',
        bio: '', avatarUrl: '', followerCount: 0, followingCount: 0, links: [], keys: {},
      },
      text: `📊 Tableland Query Result\n\`\`\`json\n${JSON.stringify(row, null, 2)}\n\`\`\``,
      embeds: [],
      contentType: 'data',
      createdAt: Date.now(),
      metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      engagement: {
        viewerLiked: false, viewerReposted: false, viewerBookmarked: false,
        raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      },
      raw: row,
      niches: ['database'],
    }));
  } catch {
    return [];
  }
}

// ─── Main ──────────────────────────────────────────────────────────────

export const schema: SchemaGuard = {
  id: 'tableland',
  name: 'Tableland',
  description: 'Decentralized SQLite database network — ERC721 tables',
  endpoint: '/api/feed/tableland',
  requiresAuth: false,
  contentType: 'data',
};

export async function fetchTablelandPosts(limit = 20): Promise<UnifiedPost[]> {
  const allNodes = [TABLELAND_NODE, ...PUBLIC_GATEWAYS];
  const healthResults = await Promise.allSettled(
    allNodes.map((node) => fetchNodeHealth(node)),
  );

  const all: UnifiedPost[] = [];
  for (const r of healthResults) if (r.status === 'fulfilled') all.push(...r.value);

  // Try query on local node
  const queryResults = await fetchQueryResults(TABLELAND_NODE);
  all.push(...queryResults);

  console.log(`[bridge] Tableland: ${all.length} items`);
  return all.slice(0, limit);
}

export const fetch = fetchTablelandPosts;
