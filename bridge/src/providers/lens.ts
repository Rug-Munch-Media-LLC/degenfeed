/**
 * Lens Protocol Provider — Self-hosted Lens Indexer
 *
 * Reads Lens publications from our local Lens indexer (port 8088) instead of
 * the external api.lens.xyz GraphQL API.
 *
 * This gives DegenFeed ownership of its Lens data — no dependency on
 * the public Lens API for reads.
 *
 * The local indexer runs at /srv/degenfeed/lens-indexer/ and polls
 * api.lens.xyz every 30s, storing results in SQLite.
 *
 * Endpoint: http://127.0.0.1:8088/api/publications
 */

import type { SchemaGuard, UnifiedPost } from '../server';

// ─── Configuration ────────────────────────────────────────────────────

const LENS_INDEXER_URL = process.env.LENS_INDEXER_URL || 'http://127.0.0.1:8099';

// ─── Interface ────────────────────────────────────────────────────────

interface IndexerPublication {
  id: string;
  slug: string;
  author_address: string;
  author_username: string | null;
  author_name: string | null;
  author_bio: string | null;
  author_avatar: string | null;
  timestamp: string;
  content: string;
  metadata_type: string | null;
  image_url: string | null;
  video_url: string | null;
  sharing_link: string | null;
  stats_reactions: number;
  stats_comments: number;
  stats_reposts: number;
  stats_quotes: number;
  raw_json: string | null;
}

interface IndexerResponse {
  data: IndexerPublication[];
  meta: {
    total: number;
    returned: number;
    offset: number;
    limit: number;
    source: string;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────

function guessNiches(text: string): string[] {
  const niches: string[] = [];
  const lower = text.toLowerCase();
  if (/\b(btc|bitcoin|satoshi|halving)\b/.test(lower)) niches.push('bitcoin');
  if (/\b(eth|ethereum|vitalik|pectra)\b/.test(lower)) niches.push('ethereum');
  if (/\b(sol|solana|spl)\b/.test(lower)) niches.push('solana');
  if (/\b(defi|liquidity|yield|farm|lp|lending|compound|aave|uniswap)\b/.test(lower))
    niches.push('defi');
  if (/\b(nft|art|collectible|punk|bored|ape)\b/.test(lower)) niches.push('nft');
  if (/\b(ai|artificial|intelligence|llm|agent)\b/.test(lower)) niches.push('ai');
  if (/\b(sec|regulation|etf|compliance)\b/.test(lower)) niches.push('regulation');
  if (/\b(meme|pepe|dog|shib|bonk|wif|trump)\b/.test(lower)) niches.push('memecoin');
  if (/\b(layer2|l2|arbitrum|optimism|base|polygon)\b/.test(lower)) niches.push('layer2');
  if (/\b(security|hack|exploit|audit|bug)\b/.test(lower)) niches.push('security');
  if (/\b(rust|typescript|python|programming|code|dev)\b/.test(lower)) niches.push('tech');
  if (/\b(lens|hey|orb)\b/.test(lower)) niches.push('lens');
  if (/\b(web3|blockchain|wallet|did)\b/.test(lower)) niches.push('web3');
  if (niches.length === 0) niches.push('crypto');
  return niches;
}

function mapPublication(pub: IndexerPublication): UnifiedPost | null {
  const content = pub.content || '';
  if (!content.trim()) return null;

  const embeds: Array<{ kind: string; url: string; meta?: Record<string, unknown> }> = [];

  if (pub.image_url) {
    embeds.push({ kind: 'image', url: pub.image_url });
  }
  if (pub.video_url) {
    embeds.push({ kind: 'video', url: pub.video_url });
  }
  if (pub.sharing_link) {
    embeds.push({ kind: 'link', url: pub.sharing_link });
  }

  // Extract URLs from content
  const urlRegex = /https?:\/\/[^\s]+/g;
  const urlMatches = content.match(urlRegex);
  if (urlMatches) {
    for (const url of urlMatches) {
      if (!embeds.some((e) => e.url === url)) {
        const isImage = /\.(png|jpg|jpeg|gif|webp|svg)(\?|$)/i.test(url);
        embeds.push({ kind: isImage ? 'image' : 'link', url });
      }
    }
  }

  const displayName = pub.author_name || pub.author_username || pub.author_address.slice(0, 10);

  return {
    id: `lens:${pub.id}`,
    protocol: 'lens',
    author: {
      id: `lens:${pub.author_address}`,
      primary: { protocol: 'lens', id: pub.author_address },
      handles: { lens: pub.author_username || pub.author_address },
      displayName,
      bio: pub.author_bio || '',
      avatarUrl: pub.author_avatar || '',
      followerCount: 0,
      followingCount: 0,
      links: [],
      keys: { address: pub.author_address },
    },
    text: content,
    embeds,
    contentType:
      metadata?.__typename === 'ImageMetadata'
        ? 'image'
        : metadata?.__typename === 'VideoMetadata'
          ? 'video'
          : metadata?.__typename === 'LinkMetadata'
            ? 'link'
            : 'text',
    createdAt: new Date(pub.timestamp).getTime(),
    metrics: {
      likes: pub.stats_reactions ?? 0,
      reposts: pub.stats_reposts ?? 0,
      replies: pub.stats_comments ?? 0,
      quotes: pub.stats_quotes ?? 0,
    },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: {
        likes: pub.stats_reactions ?? 0,
        reposts: pub.stats_reposts ?? 0,
        replies: pub.stats_comments ?? 0,
        quotes: pub.stats_quotes ?? 0,
      },
    },
    raw: pub,
    niches: guessNiches(content),
  };
}

// ─── Fetch from Local Indexer ─────────────────────────────────────────

async function fetchPosts(limit: number): Promise<UnifiedPost[]> {
  const url = `${LENS_INDEXER_URL}/api/publications?limit=${limit}`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'DegenFeed-Bridge/0.1' },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      console.warn(`[bridge] Lens Indexer: HTTP ${res.status} ${res.statusText}`);
      return [];
    }

    const data = (await res.json()) as IndexerResponse;

    if (!data.data || data.data.length === 0) {
      console.warn('[bridge] Lens Indexer: No publications returned');
      return [];
    }

    const posts: UnifiedPost[] = [];
    for (const pub of data.data) {
      const post = mapPublication(pub);
      if (post) posts.push(post);
    }

    console.log(`[bridge] Lens Indexer: ${posts.length} posts (from ${data.meta.total} local)`);
    return posts.slice(0, limit);
  } catch (err) {
    console.warn(
      '[bridge] Lens Indexer: Error fetching posts:',
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}

// ─── Main export ──────────────────────────────────────────────────────

export const schema: SchemaGuard = {
  id: 'lens',
  name: 'Lens Protocol',
  description: 'User-owned social graph on Polygon — Lens v2 GraphQL API',
  endpoint: '/api/feed/lens',
  requiresAuth: false,
  contentType: 'mixed',
};

export async function fetchLensPosts(limit = 20): Promise<UnifiedPost[]> {
  const posts = await fetchPosts(limit);
  return posts;
}

/** @alias Use `fetch` as the standardized export name */
export const fetch = fetchLensPosts;
