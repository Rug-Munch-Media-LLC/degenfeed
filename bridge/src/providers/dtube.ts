/**
 * DTube Provider
 *
 * Fetches videos from DTube — the decentralized video platform on Hive blockchain.
 * Uses the DTube API at api.d.tube and Hive content API.
 *
 * DTube hosts user-uploaded videos stored on IPFS with metadata on Hive.
 * API: https://api.d.tube (DTube internal API)
 * Hive API: https://api.hive.blog (for Hive blockchain queries)
 *
 * Content strategy: fetch trending and recent DTube videos via both
 * DTube API endpoints and Hive blockchain (posts tagged 'dtube').
 */

import type { SchemaGuard, UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;

const DTHIVE_API = 'https://api.d.tube';
const HIVE_API = 'https://api.hive.blog';

// ─── Types ─────────────────────────────────────────────────────────────

interface DTubeVideo {
  _id: string;
  author: string;
  title: string;
  description: string;
  duration: number;
  thumbnail: string;
  video: string; // IPFS hash or URL
  category: string;
  tags: string[];
  created: string;
  views: number;
  likes: number;
  dislikes: number;
  comments: number;
}

interface HivePost {
  post_id: number;
  author: string;
  permlink: string;
  title: string;
  body: string;
  json_metadata: {
    tags?: string[];
    image?: string[];
    links?: string[];
    app?: string;
    format?: string;
    description?: string;
    video?: {
      content?: {
        videohash?: string;
        video640hash?: string;
        description?: string;
        duration?: number;
        thumbnailUrl?: string;
        title?: string;
      };
      info?: {
        author?: string;
        title?: string;
        duration?: number;
        thumbnail?: string;
        permlink?: string;
      };
    };
  };
  created: string;
  last_update: string;
  total_payout_value: string;
  curator_payout_value: string;
  net_rshares: number;
  children: number;
  active_votes: Array<{
    voter: string;
    weight: number;
    rshares: number;
    percent: number;
    reputation: number;
    time: string;
  }>;
  stats: {
    total_votes: number;
    total_payout_value: string;
    total_author_payout_value: string;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────

export function guessNiches(text: string, title: string): string[] {
  const niches: string[] = [];
  const lower = `${text} ${title}`.toLowerCase();
  if (/\b(btc|bitcoin|satoshi|halving)\b/.test(lower)) niches.push('bitcoin');
  if (/\b(eth|ethereum|vitalik|pectra)\b/.test(lower)) niches.push('ethereum');
  if (/\b(sol|solana|spl)\b/.test(lower)) niches.push('solana');
  if (/\b(defi|liquidity|yield|farm|lp|swap)\b/.test(lower)) niches.push('defi');
  if (/\b(nft|art|collectible|mint)\b/.test(lower)) niches.push('nft');
  if (/\b(ai |artificial|intelligence|llm|agent|machine learning)\b/.test(lower)) niches.push('ai');
  if (/\b(sec|regulation|etf|compliance)\b/.test(lower)) niches.push('regulation');
  if (/\b(meme|pepe|doge|shib)\b/.test(lower)) niches.push('memecoin');
  if (/\b(security|hack|exploit|audit|scam|phishing|rug)\b/.test(lower)) niches.push('security');
  if (/\b(tutorial|guide|how.?to|learn|course|explain|review)\b/.test(lower))
    niches.push('educational');
  if (/\b(crypto|blockchain|web3|hive|dtube)\b/.test(lower)) niches.push('crypto');
  if (/\b(music|song|artist|album|concert)\b/.test(lower)) niches.push('music');
  if (/\b(gaming|game|stream|twitch)\b/.test(lower)) niches.push('gaming');
  if (niches.length === 0) niches.push('crypto');
  return niches;
}

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

// ─── Fetch via DTube API ───────────────────────────────────────────────

async function fetchFromDTubeAPI(limit: number): Promise<UnifiedPost[]> {
  try {
    const res = await $fetch(`${DTHIVE_API}/v1/trending?skip=0&limit=${limit}`, {
      headers: { 'User-Agent': 'DegenFeed-Bridge/0.1 (DTube)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];

    const data = (await res.json()) as { results?: DTubeVideo[] };
    if (!data.results || !Array.isArray(data.results)) return [];

    return data.results.map((v) => {
      const text = `${v.title}\n\n${v.description || ''}`.trim();
      const videoUrl = v.video?.startsWith('http')
        ? v.video
        : `https://ipfs.io/ipfs/${v.video}`;
      const thumbnail = v.thumbnail?.startsWith('http')
        ? v.thumbnail
        : v.thumbnail
          ? `https://ipfs.io/ipfs/${v.thumbnail}`
          : '';

      return {
        id: `dtube:${v._id}`,
        protocol: 'dtube',
        author: {
          id: `dtube:${v.author}`,
          primary: { protocol: 'dtube', id: v.author },
          handles: { dtube: v.author },
          displayName: v.author,
          bio: '',
          avatarUrl: '',
          followerCount: 0,
          followingCount: 0,
          links: [],
          keys: {},
        },
        text,
        contentType: 'video',
        embeds: [
          {
            kind: 'video',
            url: videoUrl,
            meta: {
              duration: v.duration,
              views: v.views,
              thumbnail,
              tags: v.tags,
            },
          },
          ...(thumbnail
            ? [{ kind: 'image' as const, url: thumbnail, meta: { thumbnail: true } }]
            : []),
        ],
        createdAt: new Date(v.created).getTime(),
        metrics: {
          likes: v.likes || 0,
          reposts: 0,
          replies: v.comments || 0,
          quotes: 0,
          views: v.views || 0,
        },
        engagement: {
          viewerLiked: false,
          viewerReposted: false,
          viewerBookmarked: false,
          raw: {
            likes: v.likes || 0,
            reposts: 0,
            replies: v.comments || 0,
            quotes: 0,
            views: v.views || 0,
          },
        },
        raw: v,
        niches: guessNiches(text, v.title),
      };
    });
  } catch (err) {
    console.log(`[bridge] DTube API error: ${(err as Error).message}`);
    return [];
  }
}

// ─── Fetch via Hive Blockchain ──────────────────────────────────────────

async function fetchHiveDTubePosts(limit: number): Promise<UnifiedPost[]> {
  try {
    const query = {
      jsonrpc: '2.0',
      method: 'bridge.get_ranked_posts',
      params: {
        sort: 'trending',
        tag: 'dtube',
        limit: Math.min(limit, 50),
      },
      id: 1,
    };

    const res = await $fetch(HIVE_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'DegenFeed-Bridge/0.1 (DTube)',
      },
      body: JSON.stringify(query),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];

    const data = (await res.json()) as { result?: HivePost[] };
    if (!data.result || !Array.isArray(data.result)) return [];

    return data.result
      .filter((p) => {
        const meta = p.json_metadata;
        return (
          meta?.video?.content?.videohash ||
          meta?.video?.info?.title ||
          (meta?.tags && meta.tags.includes('dtube'))
        );
      })
      .slice(0, limit)
      .map((p) => {
        const meta = p.json_metadata;
        const videoMeta = meta?.video?.content || meta?.video?.info;
        const title = videoMeta?.title || p.title || 'DTube Video';
        const description = videoMeta?.description || meta?.description || '';
        const text = `${title}\n\n${stripHtml(p.body || description).slice(0, 500)}`.trim();
        const videoHash = videoMeta?.videohash || '';
        const videoUrl = videoHash ? `https://ipfs.io/ipfs/${videoHash}` : '';
        const thumbnailUrl =
          videoMeta?.thumbnail || meta?.image?.[0] || '';

        return {
          id: `dtube:hive:${p.author}/${p.permlink}`,
          protocol: 'dtube',
          author: {
            id: `dtube:hive:${p.author}`,
            primary: { protocol: 'dtube', id: p.author },
            handles: { dtube: p.author, rss: `${p.author}@hive` },
            displayName: p.author,
            bio: '',
            avatarUrl: '',
            followerCount: 0,
            followingCount: 0,
            links: [],
            keys: { hiveUsername: p.author },
          },
          text,
          contentType: 'video',
          embeds: [
            {
              kind: 'video',
              url: videoUrl || `https://d.tube/#!/v/${p.author}/${p.permlink}`,
              meta: {
                duration: videoMeta?.duration,
                permlink: p.permlink,
                hivePostId: p.post_id,
              },
            },
            ...(thumbnailUrl
              ? [{ kind: 'image' as const, url: thumbnailUrl, meta: { thumbnail: true } }]
              : []),
          ],
          createdAt: new Date(p.created).getTime(),
          metrics: {
            likes: p.active_votes?.length || 0,
            reposts: 0,
            replies: p.children || 0,
            quotes: 0,
            views: 0,
          },
          engagement: {
            viewerLiked: false,
            viewerReposted: false,
            viewerBookmarked: false,
            raw: {
              likes: p.active_votes?.length || 0,
              reposts: 0,
              replies: p.children || 0,
              quotes: 0,
            },
          },
          raw: p,
          niches: guessNiches(text, title),
        };
      });
  } catch (err) {
    console.log(`[bridge] DTube Hive fetch error: ${(err as Error).message}`);
    return [];
  }
}

// ─── Main ──────────────────────────────────────────────────────────────

export const schema: SchemaGuard = {
  id: 'dtube',
  name: 'DTube',
  description: 'Decentralized video platform on Hive blockchain + IPFS',
  endpoint: '/api/feed/dtube',
  requiresAuth: false,
  contentType: 'video',
};

export async function fetchDTubePosts(limit = 20): Promise<UnifiedPost[]> {
  const [apiPosts, hivePosts] = await Promise.all([
    fetchFromDTubeAPI(Math.ceil(limit / 2)),
    fetchHiveDTubePosts(Math.ceil(limit / 2)),
  ]);

  const all = [...apiPosts, ...hivePosts];

  // Deduplicate by author+title
  const seen = new Set<string>();
  const deduped: UnifiedPost[] = [];
  for (const p of all) {
    const key = `${p.author.displayName}:${p.text.slice(0, 60)}`;
    if (!seen.has(key) && deduped.length < limit) {
      seen.add(key);
      deduped.push(p);
    }
  }

  console.log(`[bridge] DTube: ${deduped.length} posts (API: ${apiPosts.length}, Hive: ${hivePosts.length})`);
  return deduped;
}

/** @alias */
export const fetch = fetchDTubePosts;
