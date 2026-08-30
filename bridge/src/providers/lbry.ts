/**
 * Odysee / LBRY Provider
 *
 * Fetches videos and content from the LBRY network / Odysee platform.
 * LBRY is a fully open-source, decentralized video and content sharing protocol.
 *
 * API: LBRY SDK JSON-RPC API at https://api.lbry.tv/api/v1/proxy
 * Odysee API: https://api.lbry.tv/api/v1/proxy
 * Also uses Odysee.com public API endpoints.
 *
 * Content strategy: fetch trending, new, and crypto-related content.
 */

import type { SchemaGuard, UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;

const LBRY_API = 'https://api.lbry.tv/api/v1/proxy';

// ─── Types ─────────────────────────────────────────────────────────────

interface LBRYClaim {
  name: string;
  claimId: string;
  claimOp: string;
  value: {
    title?: string;
    description?: string;
    thumbnail?: { url: string };
    source?: {
      hash: string;
      mediaType: string;
      size: string;
      sdHash?: string;
    };
    streamType?: string;
    duration?: number;
    author?: string;
    license?: string;
    languages?: string[];
    tags?: string[];
    locations?: Array<{ country: string }>;
    releaseTime?: string;
    published?: number;
  };
  height: number;
  createTime: number;
  meta: {
    claimId: string;
    name: string;
    normalizedName: string;
    permanentUrl: string;
  };
  channel?: {
    name: string;
    claimId: string;
    value: {
      title?: string;
      thumbnail?: { url: string };
      description?: string;
    };
  };
  reposted?: number;
  effectiveAmount: string;
  supportAmount: string;
  trendingGroup?: string;
  trendingMix?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────

export function guessNiches(text: string, title: string, tags: string[] = []): string[] {
  const niches: string[] = [];
  const lower = `${text} ${title} ${tags.join(' ')}`.toLowerCase();
  if (/\b(btc|bitcoin|satoshi|halving)\b/.test(lower)) niches.push('bitcoin');
  if (/\b(eth|ethereum|vitalik|pectra)\b/.test(lower)) niches.push('ethereum');
  if (/\b(sol|solana|spl)\b/.test(lower)) niches.push('solana');
  if (/\b(defi|liquidity|yield|farm|lp|swap|dex)\b/.test(lower)) niches.push('defi');
  if (/\b(nft|art|collectible|mint|zora)\b/.test(lower)) niches.push('nft');
  if (/\b(ai |artificial|intelligence|llm|agent|machine learning|deep learning)\b/.test(lower))
    niches.push('ai');
  if (/\b(sec|regulation|etf|compliance)\b/.test(lower)) niches.push('regulation');
  if (/\b(meme|pepe|doge|shib|bonk)\b/.test(lower)) niches.push('memecoin');
  if (/\b(security|hack|exploit|audit|scam|phishing|rug)\b/.test(lower)) niches.push('security');
  if (/\b(tutorial|guide|how.?to|learn|course|explain|review|unboxing)\b/.test(lower))
    niches.push('educational');
  if (/\b(crypto|blockchain|web3|lbry|odysee)\b/.test(lower)) niches.push('crypto');
  if (/\b(music|song|artist|album|concert|podcast)\b/.test(lower)) niches.push('music');
  if (/\b(gaming|game|stream|playthrough|walkthrough)\b/.test(lower)) niches.push('gaming');
  if (/\b(tech|technology|programming|code|software|open source)\b/.test(lower))
    niches.push('tech');
  if (/\b(news|breaking|report|update)\b/.test(lower)) niches.push('news');
  if (niches.length === 0) niches.push('crypto');
  return niches;
}

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

function claimToPost(claim: LBRYClaim): UnifiedPost {
  const val = claim.value || ({} as LBRYClaim['value']);
  const channel = claim.channel;
  const authorName = channel?.value?.title || channel?.name || val.author || 'LBRY Creator';
  const title = val.title || claim.name || 'Untitled';
  const description = val.description || '';
  const text = `${title}\n\n${stripHtml(description)}`.trim();
  const tags = val.tags || [];
  const thumbnailUrl = val.thumbnail?.url || channel?.value?.thumbnail?.url || '';
  const contentType =
    val.streamType === 'video' ? 'video' : val.streamType === 'audio' ? 'video' : 'video';

  const lbryUrl = `https://odysee.com/${claim.name}:${claim.claimId}`;

  return {
    id: `lbry:${claim.claimId}`,
    protocol: 'lbry',
    author: {
      id: `lbry:${channel?.claimId || claim.claimId}`,
      primary: { protocol: 'lbry', id: channel?.name || claim.name },
      handles: { lbry: channel?.name || claim.name },
      displayName: authorName,
      bio: channel?.value?.description ? stripHtml(channel.value.description).slice(0, 200) : '',
      avatarUrl: channel?.value?.thumbnail?.url || '',
      followerCount: 0,
      followingCount: 0,
      links: channel?.claimId
        ? [{ label: 'channel', url: `https://odysee.com/@${channel.name}:${channel.claimId}` }]
        : [],
      keys: { lbryClaimId: claim.claimId },
    },
    text,
    contentType,
    embeds: [
      {
        kind: 'video',
        url: lbryUrl,
        meta: {
          duration: val.duration,
          thumbnailUrl,
          claimId: claim.claimId,
          streamType: val.streamType,
          tags,
          releaseTime: val.releaseTime,
        },
      },
      ...(thumbnailUrl
        ? [{ kind: 'image' as const, url: thumbnailUrl, meta: { thumbnail: true } }]
        : []),
    ],
    createdAt: (claim.createTime || 0) * 1000,
    metrics: {
      likes: 0,
      reposts: claim.reposted || 0,
      replies: 0,
      quotes: 0,
      views: 0,
    },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: 0, reposts: claim.reposted || 0, replies: 0, quotes: 0 },
    },
    raw: claim,
    niches: guessNiches(text, title, tags),
  };
}

// ─── Fetch Trending / New via LBRY JSON-RPC ──────────────────────────

async function lbryApiCall(method: string, params: Record<string, unknown>): Promise<unknown> {
  const res = await $fetch(LBRY_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'DegenFeed-Bridge/0.1 (LBRY)',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method,
      params,
      id: Date.now(),
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`LBRY API HTTP ${res.status}`);
  const data = (await res.json()) as { result?: unknown; error?: { message: string } };
  if (data.error) throw new Error(data.error.message);
  return data.result;
}

async function fetchTrending(limit: number): Promise<UnifiedPost[]> {
  try {
    const result = (await lbryApiCall('claim_search', {
      page_size: Math.min(limit, 50),
      order_by: ['trending_group', 'effective_amount'],
      release_time: '>0',
      has_source: true,
    })) as { items?: LBRYClaim[] };

    if (!result?.items) return [];
    return result.items.map(claimToPost);
  } catch {
    // console.log(`[bridge] LBRY trending error: ${(err as Error).message}`);
    return [];
  }
}

async function fetchRecent(limit: number): Promise<UnifiedPost[]> {
  try {
    const result = (await lbryApiCall('claim_search', {
      page_size: Math.min(limit, 50),
      order_by: ['creation_timestamp'],
      release_time: '>0',
      has_source: true,
    })) as { items?: LBRYClaim[] };

    if (!result?.items) return [];
    return result.items.map(claimToPost);
  } catch {
    // console.log(`[bridge] LBRY recent error: ${(err as Error).message}`);
    return [];
  }
}

async function fetchCryptoRelated(limit: number): Promise<UnifiedPost[]> {
  try {
    const cryptoKeywords = ['bitcoin', 'crypto', 'ethereum', 'blockchain', 'defi', 'nft', 'web3'];
    const result = (await lbryApiCall('claim_search', {
      page_size: Math.min(limit, 50),
      order_by: ['trending_group'],
      any_tags: cryptoKeywords,
      has_source: true,
    })) as { items?: LBRYClaim[] };

    if (!result?.items) return [];
    return result.items.map(claimToPost);
  } catch {
    // console.log(`[bridge] LBRY crypto search error: ${(err as Error).message}`);
    return [];
  }
}

// ─── Main ──────────────────────────────────────────────────────────────

export const schema: SchemaGuard = {
  id: 'lbry',
  name: 'Odysee/LBRY',
  description: 'Decentralized video & content sharing on the LBRY protocol',
  endpoint: '/api/feed/lbry',
  requiresAuth: false,
  contentType: 'video',
};

export async function fetchLBRYPosts(limit = 20): Promise<UnifiedPost[]> {
  const [trending, recent, crypto] = await Promise.all([
    fetchTrending(Math.ceil(limit / 3)),
    fetchRecent(Math.ceil(limit / 3)),
    fetchCryptoRelated(Math.ceil(limit / 3)),
  ]);

  const all = [...trending, ...recent, ...crypto];

  // Deduplicate by claimId
  const seen = new Set<string>();
  const deduped: UnifiedPost[] = [];
  for (const p of all) {
    if (!seen.has(p.id) && deduped.length < limit) {
      seen.add(p.id);
      deduped.push(p);
    }
  }

  //   console.log(
  //     `[bridge] LBRY: ${deduped.length} posts (trending: ${trending.length}, recent: ${recent.length}, crypto: ${crypto.length})`,
  //   );
  return deduped;
}

/** @alias */
export const fetch = fetchLBRYPosts;
