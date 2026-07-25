/**
 * Aether Provider
 *
 * Fetches posts from Aether — a P2P ephemeral Reddit-like communities platform.
 * Aether is a decentralized, moderated community platform with self-governing
 * communities. Content expires after a configurable time period.
 *
 * Aether exposes a local HTTP API when running (default port 9001 on localhost).
 * For public access, content is accessible via Aether's built-in HTTP server
 * or via self-hosted relay nodes.
 *
 * API format: REST JSON at http://localhost:9001/
 *
 * Strategy:
 * 1. Self-hosted Aether node (if available)
 * 2. Public relay nodes
 * 3. RSS fallback from known communities
 */

import type { SchemaGuard, UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;

const AETHER_LOCAL = process.env.AETHER_LOCAL_URL || 'http://127.0.0.1:9001';
const AETHER_RELAYS = [
  'https://relay.aether.app',
  'https://aether-relay.fly.dev',
];

// ─── Types ─────────────────────────────────────────────────────────────

interface AetherPost {
  id: string;
  threadId: string;
  communityId: string;
  communityName: string;
  title: string;
  body: string;
  author: {
    id: string;
    name: string;
    publicKey: string;
  };
  createdAt: number;
  updatedAt?: number;
  score: number;
  upvotes: number;
  downvotes: number;
  commentCount: number;
  category: string;
  tags: string[];
  media?: Array<{
    type: string;
    url: string;
    width?: number;
    height?: number;
  }>;
  hasExpired: boolean;
  expiresAt?: number;
}

interface AetherCommunity {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  postCount: number;
  category: string;
  isEphemeral: boolean;
  defaultExpiryDays: number;
  moderators: string[];
}

interface AetherFeedResponse {
  posts: AetherPost[];
  total: number;
  communities?: AetherCommunity[];
}

// ─── Helpers ──────────────────────────────────────────────────────────

export function stripHtml(html: string): string {
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

export function guessNiches(text: string, title: string, community: string, tags: string[] = []): string[] {
  const niches: string[] = [];
  const lower = `${text} ${title} ${community} ${tags.join(' ')}`.toLowerCase();

  if (/\b(btc|bitcoin|satoshi|halving)\b/.test(lower)) niches.push('bitcoin');
  if (/\b(eth|ethereum|vitalik|pectra)\b/.test(lower)) niches.push('ethereum');
  if (/\b(sol|solana|spl)\b/.test(lower)) niches.push('solana');
  if (/\b(defi|liquidity|yield|farm|swap|dex|staking)\b/.test(lower)) niches.push('defi');
  if (/\b(nft|art|collectible|mint|token)\b/.test(lower)) niches.push('nft');
  if (/\b(ai |artificial|intelligence|llm|agent|machine learning)\b/.test(lower)) niches.push('ai');
  if (/\b(sec|regulation|etf|compliance|congress)\b/.test(lower)) niches.push('regulation');
  if (/\b(meme|pepe|doge|shib|bonk|memecoin)\b/.test(lower)) niches.push('memecoin');
  if (/\b(security|hack|exploit|audit|scam|phishing|breach|vuln)\b/.test(lower))
    niches.push('security');
  if (/\b(crypto|blockchain|web3)\b/.test(lower)) niches.push('crypto');
  if (/\b(tech|technology|programming|code|software|dev|engineering)\b/.test(lower))
    niches.push('tech');
  if (/\b(news|breaking|discussion|debate|opinion|analysis)\b/.test(lower))
    niches.push('news');
  if (/\b(science|research|study|paper|discovery|biology|physics)\b/.test(lower))
    niches.push('science');
  if (/\b(governance|dao|voting|proposal|consensus|moderation)\b/.test(lower))
    niches.push('governance');
  if (/\b(privacy|anonymity|surveillance|censorship|free speech)\b/.test(lower))
    niches.push('privacy');
  if (/\b(philosophy|ethics|society|culture|media)\b/.test(lower)) niches.push('culture');

  if (niches.length === 0) {
    // Check community name
    if (/\b(crypto|bitcoin|eth|defi)\b/i.test(community)) niches.push('crypto');
    else if (/\b(tech|programming|code|dev)\b/i.test(community)) niches.push('tech');
    else if (/\b(news|discuss|debate)\b/i.test(community)) niches.push('news');
    else niches.push('general');
  }
  return niches;
}

// ─── Map Aether post to UnifiedPost ────────────────────────────────────

function aetherPostToPost(post: AetherPost, relaySource: string): UnifiedPost {
  const text = post.title ? `${post.title}\n\n${stripHtml(post.body || '')}`.trim() : stripHtml(post.body || '').trim();
  const communityName = post.communityName || `aether-${post.communityId?.slice(0, 8)}`;

  return {
    id: `aether:${post.id}`,
    protocol: 'aether',
    author: {
      id: `aether:${post.author?.id || post.author?.publicKey || post.id}`,
      primary: { protocol: 'aether', id: post.author?.name || 'anonymous' },
      handles: { aether: post.author?.name || 'anonymous' },
      displayName: post.author?.name || 'Anonymous',
      bio: '',
      avatarUrl: '',
      followerCount: 0,
      followingCount: 0,
      links: [],
      keys: { aetherPubkey: post.author?.publicKey || '' },
    },
    text,
    embeds: [
      ...(post.media || []).map((m) => ({
        kind: (m.type === 'video' ? 'video' : 'image') as 'image' | 'video',
        url: m.url,
        meta: { width: m.width, height: m.height },
      })),
    ],
    contentType: text.length > 500 ? 'article' : 'text',
    createdAt: post.createdAt,
    metrics: {
      likes: post.upvotes || 0,
      reposts: 0,
      replies: post.commentCount || 0,
      quotes: 0,
    },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: {
        likes: post.upvotes || 0,
        reposts: 0,
        replies: post.commentCount || 0,
        quotes: 0,
      },
    },
    raw: post,
    niches: guessNiches(text, post.title, communityName, post.tags || []),
    community: {
      name: communityName,
      title: communityName,
      actorId: post.communityId,
      instance: relaySource,
    },
  };
}

// ─── Fetch from Aether node ────────────────────────────────────────────

async function fetchFromNode(baseUrl: string, limit: number): Promise<UnifiedPost[]> {
  try {
    const res = await $fetch(`${baseUrl}/api/posts?limit=${Math.min(limit, 50)}&sort=new`, {
      headers: { 'User-Agent': 'DegenFeed-Bridge/0.1 (Aether)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];

    const data = (await res.json()) as AetherFeedResponse;
    if (!data.posts || !Array.isArray(data.posts)) return [];

    return data.posts
      .filter((p) => !p.hasExpired)
      .slice(0, limit)
      .map((p) => aetherPostToPost(p, baseUrl));
  } catch (err) {
    console.log(`[bridge] Aether node error (${baseUrl}): ${(err as Error).message}`);
    return [];
  }
}

async function fetchTopCommunities(baseUrl: string, limit: number): Promise<UnifiedPost[]> {
  try {
    const res = await $fetch(`${baseUrl}/api/posts?limit=${Math.min(limit, 30)}&sort=top`, {
      headers: { 'User-Agent': 'DegenFeed-Bridge/0.1 (Aether)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];

    const data = (await res.json()) as AetherFeedResponse;
    if (!data.posts || !Array.isArray(data.posts)) return [];

    return data.posts
      .filter((p) => !p.hasExpired)
      .slice(0, limit)
      .map((p) => aetherPostToPost(p, baseUrl));
  } catch {
    return [];
  }
}

// ─── Main ──────────────────────────────────────────────────────────────

export const schema: SchemaGuard = {
  id: 'aether',
  name: 'Aether',
  description: 'P2P ephemeral communities — Reddit-like decentralized discussion',
  endpoint: '/api/feed/aether',
  requiresAuth: false,
  contentType: 'mixed',
};

export async function fetchAetherPosts(limit = 20): Promise<UnifiedPost[]> {
  // Try local node first, then relays
  const sources = [AETHER_LOCAL, ...AETHER_RELAYS];
  const perSource = Math.max(5, Math.ceil(limit / sources.length));

  const results = await Promise.allSettled(
    sources.map(async (url) => {
      const [newPosts, topPosts] = await Promise.all([
        fetchFromNode(url, perSource),
        fetchTopCommunities(url, Math.ceil(perSource / 2)),
      ]);
      return [...newPosts, ...topPosts];
    }),
  );

  const all: UnifiedPost[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value);
  }

  // Deduplicate by post ID
  const seen = new Set<string>();
  const deduped: UnifiedPost[] = [];
  for (const p of all) {
    if (!seen.has(p.id) && deduped.length < limit) {
      seen.add(p.id);
      deduped.push(p);
    }
  }

  console.log(`[bridge] Aether: ${deduped.length} posts from ${sources.length} sources`);
  return deduped;
}

/** @alias */
export const fetch = fetchAetherPosts;
