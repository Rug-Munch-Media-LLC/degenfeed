/**
 * Scuttlebutt / SSB Provider
 *
 * Fetches posts from the Scuttlebutt (Secure Scuttlebutt) social network.
 * SSB is an offline-first, peer-to-peer decentralized social network.
 *
 * Access via:
 * 1. Self-hosted SSB server (localhost:8989) using SSB REST API
 * 2. Public SSB pubs via Tunneled connections or HTTP bridges
 * 3. Planetary.social API (popular SSB mobile client)
 *
 * SSB data model:
 * - Messages are signed, append-only logs
 * - Posts (type: post) are the main content type
 * - Social graphs are computed from follow/block messages
 * - Content is replicated P2P between peers
 */

import type { SchemaGuard, UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;

const SSB_LOCAL = process.env.SSB_LOCAL_URL || 'http://127.0.0.1:8989';
const SSB_PUBS = [
  'https://ssb.pub.planetary.social',
  'https://pub.scuttlebutt.nz',
];

// ─── Types ─────────────────────────────────────────────────────────────

interface SSBMessage {
  key: string; // Message hash (sigil)
  value: {
    author: string; // Feed ID (@...)
    content: {
      type: string;
      text?: string;
      name?: string;
      description?: string;
      title?: string;
      root?: string;
      branch?: string;
      fork?: string;
      channel?: string;
      mentions?: Array<{
        link: string;
        name?: string;
        size?: number;
        type?: string;
      }>;
      recps?: string[]; // Private message recipients
    };
    timestamp: number;
    signature: string;
  };
  timestamp: number;
}

interface SSBBlob {
  id: string;
  name: string;
  type: string;
  size: number;
  url?: string;
}

interface SSBChannel {
  channel: string;
  count: number;
  updated: number;
}

interface SSBFeedResponse {
  messages: SSBMessage[];
  hasMore: boolean;
}

interface SSBProfile {
  name?: string;
  description?: string;
  image?: string;
  publicWebHosting?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────

function extractNameFromAuthor(author: string): string {
  // Author format: @<base64>.ed25519
  const match = author.match(/@([A-Za-z0-9+/]+)/);
  if (!match) return 'SSB User';
  return match[1].slice(0, 12) + '...';
}

export function guessNiches(text: string, channel: string): string[] {
  const niches: string[] = [];
  const lower = `${text} ${channel}`.toLowerCase();

  if (/\b(btc|bitcoin|satoshi|halving)\b/.test(lower)) niches.push('bitcoin');
  if (/\b(eth|ethereum|vitalik|pectra)\b/.test(lower)) niches.push('ethereum');
  if (/\b(sol|solana|spl)\b/.test(lower)) niches.push('solana');
  if (/\b(defi|liquidity|yield|farm|swap|dex)\b/.test(lower)) niches.push('defi');
  if (/\b(nft|art|collectible|mint)\b/.test(lower)) niches.push('nft');
  if (/\b(ai |artificial|intelligence|llm|agent|machine learning)\b/.test(lower)) niches.push('ai');
  if (/\b(sec|regulation|etf|compliance)\b/.test(lower)) niches.push('regulation');
  if (/\b(meme|pepe|doge|shib)\b/.test(lower)) niches.push('memecoin');
  if (/\b(security|hack|exploit|audit|scam|phishing|breach)\b/.test(lower)) niches.push('security');
  if (/\b(crypto|blockchain|web3|ssb|scuttlebutt)\b/.test(lower)) niches.push('crypto');
  if (/\b(tech|technology|programming|code|software|p2p|distributed)\b/.test(lower))
    niches.push('tech');
  if (/\b(privacy|offline.first|decentralized|federation|fediverse)\b/.test(lower))
    niches.push('privacy');
  if (/\b(governance|community|moderation|protocol|design)\b/.test(lower))
    niches.push('governance');
  if (/\b(ssb|scuttlebutt|patchwork|planetary)\b/i.test(lower)) niches.push('privacy');

  if (niches.length === 0) niches.push('tech');
  return niches;
}

// ─── Map SSB message to UnifiedPost ────────────────────────────────────

function ssbMessageToPost(msg: SSBMessage, sourcePub: string): UnifiedPost | null {
  const content = msg.value?.content;
  if (!content) return null;
  if (content.type !== 'post' && content.type !== 'about') return null;
  if (!content.text && !content.name) return null;

  const text = content.text || content.name || '';
  const channel = content.channel || '';
  const author = msg.value.author;

  // Extract mentions (images, links, etc)
  const embeds: Array<{ kind: 'image' | 'link'; url: string }> = [];
  if (content.mentions) {
    for (const m of content.mentions) {
      if (m.link?.startsWith('&')) {
        // Blob reference (image/file)
        embeds.push({ kind: 'image', url: `${sourcePub}/blobs/get/${encodeURIComponent(m.link)}` });
      } else if (m.link?.startsWith('http')) {
        embeds.push({ kind: 'link', url: m.link });
      }
    }
  }

  // Extract channel/community context
  const community = channel
    ? {
        name: `#${channel}`,
        title: `#${channel}`,
        actorId: `ssb:channel:${channel}`,
        instance: sourcePub,
      }
    : undefined;

  return {
    id: `scuttlebutt:${msg.key}`,
    protocol: 'scuttlebutt',
    author: {
      id: `scuttlebutt:${author}`,
      primary: { protocol: 'scuttlebutt', id: author },
      handles: { scuttlebutt: extractNameFromAuthor(author) },
      displayName: extractNameFromAuthor(author),
      bio: '',
      avatarUrl: '',
      followerCount: 0,
      followingCount: 0,
      links: [],
      keys: { ssbFeedId: author },
    },
    text,
    embeds,
    contentType: text.length > 500 ? 'article' : 'text',
    createdAt: content.type === 'post' && msg.value.timestamp
      ? msg.value.timestamp
      : msg.timestamp,
    metrics: {
      likes: 0,
      reposts: 0,
      replies: content.root ? 1 : 0,
      quotes: 0,
    },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: 0, reposts: 0, replies: content.root ? 1 : 0, quotes: 0 },
    },
    raw: msg,
    niches: guessNiches(text, channel || ''),
    community,
  };
}

// ─── Fetch via SSB REST API ───────────────────────────────────────────

async function fetchFromSSBLocal(limit: number): Promise<UnifiedPost[]> {
  try {
    const res = await $fetch(
      `${SSB_LOCAL}/api/v1/messages?limit=${Math.min(limit, 50)}&type=post&sort=desc`,
      {
        headers: { 'User-Agent': 'DegenFeed-Bridge/0.1 (SSB)' },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as SSBMessage[];
    if (!Array.isArray(data)) return [];

    return data
      .map((m) => ssbMessageToPost(m, SSB_LOCAL))
      .filter((p): p is UnifiedPost => p !== null);
  } catch (err) {
    console.log(`[bridge] SSB local error: ${(err as Error).message}`);
    return [];
  }
}

// ─── Fetch via Planetary/SSB Pub API ──────────────────────────────────

async function fetchFromPub(pubUrl: string, limit: number): Promise<UnifiedPost[]> {
  try {
    const res = await $fetch(
      `${pubUrl}/api/public/posts?limit=${Math.min(limit, 30)}`,
      {
        headers: { 'User-Agent': 'DegenFeed-Bridge/0.1 (SSB)' },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { messages?: SSBMessage[] };
    if (!data.messages) return [];

    return data.messages
      .map((m) => ssbMessageToPost(m, pubUrl))
      .filter((p): p is UnifiedPost => p !== null);
  } catch {
    return [];
  }
}

async function fetchTrendingChannels(limit: number): Promise<UnifiedPost[]> {
  try {
    // Fetch channel posts from pubs
    const results = await Promise.allSettled(
      SSB_PUBS.map((pub) => fetchFromPub(pub, limit)),
    );

    const all: UnifiedPost[] = [];
    for (const r of results) {
      if (r.status === 'fulfilled') all.push(...r.value);
    }
    return all;
  } catch {
    return [];
  }
}

// ─── Main ──────────────────────────────────────────────────────────────

export const schema: SchemaGuard = {
  id: 'scuttlebutt',
  name: 'Scuttlebutt / SSB',
  description: 'Offline-first P2P decentralized social network',
  endpoint: '/api/feed/scuttlebutt',
  requiresAuth: false,
  contentType: 'mixed',
};

export async function fetchScuttlebuttPosts(limit = 20): Promise<UnifiedPost[]> {
  const [local, pubPosts] = await Promise.all([
    fetchFromSSBLocal(Math.ceil(limit / 3)),
    fetchTrendingChannels(Math.ceil(limit / 1.5)),
  ]);

  const all = [...local, ...pubPosts];

  // Deduplicate by message key
  const seen = new Set<string>();
  const deduped: UnifiedPost[] = [];
  for (const p of all) {
    if (!seen.has(p.id) && deduped.length < limit) {
      seen.add(p.id);
      deduped.push(p);
    }
  }

  console.log(`[bridge] Scuttlebutt: ${deduped.length} posts (local: ${local.length}, pub: ${pubPosts.length})`);
  return deduped;
}

/** @alias */
export const fetch = fetchScuttlebuttPosts;
