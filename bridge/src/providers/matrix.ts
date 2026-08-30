/**
 * Matrix Provider
 *
 * Fetches posts from Matrix rooms via the Matrix Client-Server API.
 * Matrix is a major decentralized communication protocol used by crypto
 * communities, open-source projects, DAOs, and government entities.
 *
 * API: Matrix Client-Server API v1
 *   GET /_matrix/client/v3/rooms/{roomId}/messages — get room messages
 *   GET /_matrix/client/v3/rooms/{roomId}/state/m.room.name — room name
 *   GET /_matrix/client/v3/profile/{userId} — user profile
 *
 * Strategy:
 * 1. Public room access via matrix.org and other open homeservers
 * 2. Guest access for public rooms
 * 3. Supports text messages, images, links, and formatted content
 */

import type { SchemaGuard, UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;

// ─── Constants ─────────────────────────────────────────────────────────

interface MatrixSource {
  homeserver: string;
  roomId: string;
  displayName: string;
  topic?: string;
}

const CURATED_ROOMS: MatrixSource[] = [
  {
    homeserver: 'https://matrix.org',
    roomId: '!degenfeed:matrix.org',
    displayName: 'DegenFeed Matrix',
    topic: 'announcements',
  },
  {
    homeserver: 'https://matrix.org',
    roomId: '!crypto:matrix.org',
    displayName: 'Crypto Community',
    topic: 'crypto',
  },
  {
    homeserver: 'https://matrix.org',
    roomId: '!ethereum:matrix.org',
    displayName: 'Ethereum Community',
    topic: 'ethereum',
  },
  {
    homeserver: 'https://matrix.org',
    roomId: '!bitcoin:matrix.org',
    displayName: 'Bitcoin Community',
    topic: 'bitcoin',
  },
  {
    homeserver: 'https://matrix.org',
    roomId: '!defi:matrix.org',
    displayName: 'DeFi Matrix',
    topic: 'defi',
  },
];

const MATRIX_API_PATH = '/_matrix/client/v3';

// ─── Types ─────────────────────────────────────────────────────────────

interface MatrixEvent {
  event_id: string;
  type: string;
  sender: string;
  content: {
    body?: string;
    msgtype?: string;
    format?: string;
    formatted_body?: string;
    url?: string;
    info?: {
      w?: number;
      h?: number;
      mimetype?: string;
      size?: number;
    };
    'm.relates_to'?: {
      event_id?: string;
      rel_type?: string;
    };
  };
  origin_server_ts: number;
  room_id: string;
}

interface MatrixMessagesResponse {
  chunk: MatrixEvent[];
  start: string;
  end: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────

function guessMatrixNiches(text: string, roomName?: string): string[] {
  const lower = `${text} ${roomName || ''}`.toLowerCase();
  const niches: string[] = [];
  if (
    /\b(crypto|bitcoin|btc|ethereum|eth|solana|sol|defi|nft|web3|blockchain|altcoin)\b/.test(lower)
  )
    niches.push('crypto');
  if (
    /\b(ai|artificial|intelligence|llm|machine.learning|gpt|openai|anthropic|claude|deepseek)\b/.test(
      lower,
    )
  )
    niches.push('ai');
  if (
    /\b(trading|trade|signal|entry|long|short|leverage|margin|futures|perp|swap|dex)\b/.test(lower)
  )
    niches.push('trading');
  if (/\b(audit|hack|exploit|vulnerability|rug|scam|security|breach|exploit)\b/.test(lower))
    niches.push('security');
  if (/\b(defi|yield|liquidity|staking|pool|farm|apy|apr|lend|borrow|swap|amm)\b/.test(lower))
    niches.push('defi');
  if (/\b(nft|mint|collection|art|collectible|pfp|soulbound|opensea)\b/.test(lower))
    niches.push('nft');
  if (/\b(memecoin|meme|shitcoin|pump|dump|degens)\b/.test(lower)) niches.push('memes');
  if (/\b(dao|governance|proposal|vote|treasury|multisig)\b/.test(lower)) niches.push('dao');
  if (/\b(dev|developer|code|programming|solidity|rust|typescript|contract|api|sdk)\b/.test(lower))
    niches.push('tech');
  if (
    /\b(privacy|encryption|signal|tor|anonymity|decentralized|federation|fediverse)\b/.test(lower)
  )
    niches.push('privacy');
  if (/\b(gaming|game|metaverse|play2earn|p2e|web3.gaming)\b/.test(lower)) niches.push('gaming');
  if (niches.length === 0) niches.push('social');
  return niches;
}

function matrixUserToHandle(sender: string): string {
  return sender.startsWith('@') ? sender.split(':')[0]?.replace('@', '') || sender : sender;
}

function extractMatrixContent(event: MatrixEvent): string {
  // Use formatted body if available, otherwise plain body
  return event.content?.formatted_body || event.content?.body || '';
}

function stripMatrixHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

// ─── Mapping ──────────────────────────────────────────────────────────

function eventToPost(event: MatrixEvent, source: MatrixSource): UnifiedPost {
  const rawContent = extractMatrixContent(event);
  const text = rawContent.startsWith('<') ? stripMatrixHtml(rawContent) : rawContent;
  const handle = matrixUserToHandle(event.sender);

  const embeds: Array<{ kind: string; url: string; meta?: Record<string, unknown> }> = [];

  // Check for image/video content (mxc:// URIs need converting)
  if (event.content?.url && event.content?.msgtype === 'm.image') {
    const mxcUrl = event.content.url;
    const httpUrl = mxcUrl.replace('mxc://', `${source.homeserver}/_matrix/media/v3/download/`);
    embeds.push({ kind: 'image', url: httpUrl });
  }

  if (event.content?.url && event.content?.msgtype === 'm.video') {
    const mxcUrl = event.content.url;
    const httpUrl = mxcUrl.replace('mxc://', `${source.homeserver}/_matrix/media/v3/download/`);
    embeds.push({ kind: 'video', url: httpUrl });
  }

  // Extract URLs from text
  const urlRe = /https?:\/\/[^\s<>"']+/gi;
  const urls = text.match(urlRe) ?? [];
  for (const url of urls.slice(0, 5)) {
    if (!embeds.some((existing) => existing.url === url)) {
      embeds.push({ kind: 'link', url });
    }
  }

  const displayText = `🧩 ${text.slice(0, 2000)}${text.length > 2000 ? '\n… (truncated)' : ''}`;

  return {
    id: `matrix:${event.event_id}`,
    protocol: 'matrix',
    author: {
      id: `matrix:${event.sender}`,
      primary: { protocol: 'matrix', id: event.sender },
      handles: { matrix: handle },
      displayName: handle,
      bio: '',
      avatarUrl: `${source.homeserver}/_matrix/media/v3/thumbnail/${event.sender.replace('@', '').replace(':', '%3A')}?width=96&height=96`,
      followerCount: 0,
      followingCount: 0,
      links: [],
      keys: { matrixHomeserver: source.homeserver, matrixRoomId: source.roomId },
    },
    text: displayText,
    embeds,
    contentType: 'text',
    createdAt: event.origin_server_ts,
    metrics: {
      likes: 0,
      reposts: 0,
      replies: 0,
      quotes: 0,
      views: undefined,
    },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    },
    raw: event,
    niches: guessMatrixNiches(text, source.displayName),
  };
}

// ─── Fetch Logic ──────────────────────────────────────────────────────

async function fetchFromRoom(source: MatrixSource, limit: number): Promise<UnifiedPost[]> {
  const homeserver = source.homeserver.replace(/\/$/, '');

  try {
    const encodedRoom = encodeURIComponent(source.roomId);
    const url = `${homeserver}${MATRIX_API_PATH}/rooms/${encodedRoom}/messages?dir=b&limit=${Math.min(limit, 100)}&filter=${encodeURIComponent(JSON.stringify({ types: ['m.room.message'] }))}`;

    const res = await $fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'DegenFeed-Bridge/0.1 (Matrix)',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];

    const data = (await res.json()) as MatrixMessagesResponse;
    if (!data?.chunk || !Array.isArray(data.chunk)) return [];

    return data.chunk
      .filter((e) => {
        const body = e.content?.body || '';
        return e.type === 'm.room.message' && body.trim().length > 0;
      })
      .slice(0, limit)
      .map((e) => eventToPost(e, source));
  } catch {
    // console.log(`[bridge] Matrix fetch error (${source.roomId}): ${(err as Error).message}`);
    return [];
  }
}

// ─── Main ──────────────────────────────────────────────────────────────

export const schema: SchemaGuard = {
  id: 'matrix',
  name: 'Matrix',
  description: 'Matrix decentralized chat rooms',
  endpoint: '/api/feed/matrix',
  requiresAuth: false,
  contentType: 'text',
};

export async function fetchMatrixPosts(limit = 20): Promise<UnifiedPost[]> {
  const perSource = Math.max(3, Math.ceil(limit / CURATED_ROOMS.length));

  const results = await Promise.allSettled(
    CURATED_ROOMS.map((src) => fetchFromRoom(src, perSource)),
  );

  const all: UnifiedPost[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value);
  }

  const seen = new Set<string>();
  const deduped: UnifiedPost[] = [];
  for (const p of all) {
    if (!seen.has(p.id) && deduped.length < limit) {
      seen.add(p.id);
      deduped.push(p);
    }
  }

  // console.log(`[bridge] Matrix: ${deduped.length} messages`);
  return deduped;
}

export const fetch = fetchMatrixPosts;
