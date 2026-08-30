/**
 * Steem Blockchain Provider
 *
 * Fetches posts from the Steem blockchain via its JSON-RPC API.
 * Steem is a decentralized blockchain for social media with built-in rewards.
 *
 * API: JSON-RPC at https://api.steemit.com
 * Methods: condenser_api.get_discussions_by_hot, condenser_api.get_discussions_by_created
 *
 * Strategy:
 * 1. Public Steem API nodes
 * 2. Fallback to alternate nodes
 */

import type { SchemaGuard, UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;

const STEEM_NODES = [
  'https://api.steemit.com',
  'https://api.hive.blog', // fallback, though Hive is separate
];

// ─── Types ─────────────────────────────────────────────────────────────

interface SteemPost {
  post_id: number;
  author: string;
  permlink: string;
  category: string;
  title: string;
  body: string;
  json_metadata: string;
  created: string;
  last_update: string;
  depth: number;
  children: number;
  net_rshares: string;
  net_votes: number;
  total_payout_value: string;
  pending_payout_value: string;
  author_reputation: string | number;
  url: string;
  active_votes: Array<{
    voter: string;
    weight: number;
    rshares: string;
    percent: number;
    reputation: string;
    time: string;
  }>;
  tags?: string[];
  image?: string[];
}

interface SteemRPCResponse {
  jsonrpc: string;
  id: number;
  result?: SteemPost[];
  error?: { message: string };
}

// ─── Helpers ──────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function guessNiches(text: string, title: string, tags: string[] = []): string[] {
  const niches: string[] = [];
  const lower = `${text} ${title} ${tags.join(' ')}`.toLowerCase();

  if (/\b(btc|bitcoin|satoshi|halving)\b/.test(lower)) niches.push('bitcoin');
  if (/\b(eth|ethereum|vitalik|pectra)\b/.test(lower)) niches.push('ethereum');
  if (/\b(sol|solana)\b/.test(lower)) niches.push('solana');
  if (/\b(defi|liquidity|yield|farm|swap|dex|staking)\b/.test(lower)) niches.push('defi');
  if (/\b(nft|art|collectible|mint)\b/.test(lower)) niches.push('nft');
  if (/\b(ai |artificial|intelligence|llm|agent|machine learning)\b/.test(lower)) niches.push('ai');
  if (/\b(steem|steemit|sbd|steem power|witness|delegation)\b/.test(lower)) niches.push('steem');
  if (/\b(crypto|blockchain|web3)\b/.test(lower)) niches.push('crypto');
  if (/\b(sec|regulation|etf)\b/.test(lower)) niches.push('regulation');
  if (/\b(meme|pepe|doge|shib)\b/.test(lower)) niches.push('memecoin');
  if (/\b(security|hack|exploit|audit|scam|phishing)\b/.test(lower)) niches.push('security');
  if (/\b(tech|technology|programming|code|software|dev)\b/.test(lower)) niches.push('tech');
  if (/\b(news|breaking|discussion|opinion|analysis)\b/.test(lower)) niches.push('news');

  if (niches.length === 0) niches.push('crypto');
  return niches;
}

function parseMetadata(jsonStr: string): { tags?: string[]; image?: string[] } {
  try {
    return JSON.parse(jsonStr);
  } catch {
    return {};
  }
}

function steemPostToPost(p: SteemPost): UnifiedPost {
  const meta = parseMetadata(p.json_metadata);
  const content = stripHtml(p.body || '');
  const text = p.title ? `${p.title}\n\n${content}`.trim() : content;

  return {
    id: `steem:${p.author}/${p.permlink}`,
    protocol: 'steem',
    author: {
      id: `steem:${p.author}`,
      primary: { protocol: 'steem', id: p.author },
      handles: { steem: p.author },
      displayName: p.author,
      bio: '',
      avatarUrl: `https://steemitimages.com/u/${p.author}/avatar`,
      followerCount: 0,
      followingCount: 0,
      links: [],
      keys: { hiveUsername: p.author, hiveReputation: String(p.author_reputation || '0') },
    },
    text,
    embeds: (meta.image || []).map((img: string) => ({
      kind: 'image' as const,
      url: img,
    })),
    contentType: text.length > 500 ? 'article' : 'text',
    createdAt: new Date(p.created).getTime(),
    metrics: {
      likes: p.net_votes || 0,
      reposts: 0,
      replies: p.children || 0,
      quotes: 0,
    },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: p.net_votes || 0, reposts: 0, replies: p.children || 0, quotes: 0 },
    },
    raw: p,
    niches: guessNiches(text, p.title, meta.tags),
    community: { name: p.category || 'general', title: p.category },
  };
}

// ─── RPC call ──────────────────────────────────────────────────────────

async function callSteemAPI(node: string, method: string, params: unknown[]): Promise<SteemPost[]> {
  try {
    const res = await $fetch(node, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'DegenFeed-Bridge/0.1' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method,
        params,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as SteemRPCResponse;
    if (data.error || !data.result) return [];
    return data.result;
  } catch {
    // console.log(`[bridge] Steem RPC error (${node}): ${(err as Error).message}`);
    return [];
  }
}

async function fetchByTag(tag: string, limit: number): Promise<SteemPost[]> {
  return callSteemAPI(STEEM_NODES[0]!, 'condenser_api.get_discussions_by_created', [
    { tag, limit: Math.min(limit, 20) },
  ]);
}

async function fetchHot(limit: number): Promise<SteemPost[]> {
  return callSteemAPI(STEEM_NODES[0]!, 'condenser_api.get_discussions_by_hot', [
    { limit: Math.min(limit, 20) },
  ]);
}

// ─── Main ──────────────────────────────────────────────────────────────

export const schema: SchemaGuard = {
  id: 'steem',
  name: 'Steem',
  description: 'Blockchain-based social media with rewards',
  endpoint: '/api/feed/steem',
  requiresAuth: false,
  contentType: 'mixed',
};

const STEEM_TAGS = ['crypto', 'bitcoin', 'ethereum', 'defi', 'nft', 'blockchain', 'tech', 'ai'];

export async function fetchSteemPosts(limit = 20): Promise<UnifiedPost[]> {
  const perSource = Math.max(3, Math.ceil(limit / 4));

  const [hotPosts, ...tagPosts] = await Promise.all([
    fetchHot(perSource),
    ...STEEM_TAGS.slice(0, 5).map((tag) => fetchByTag(tag, perSource)),
  ]);

  const all = [hotPosts, ...tagPosts].flat().map(steemPostToPost);

  // Deduplicate
  const seen = new Set<string>();
  const deduped: UnifiedPost[] = [];
  for (const p of all) {
    if (!seen.has(p.id) && deduped.length < limit) {
      seen.add(p.id);
      deduped.push(p);
    }
  }

  // console.log(`[bridge] Steem: ${deduped.length} posts`);
  return deduped;
}

/** @alias */
export const fetch = fetchSteemPosts;
