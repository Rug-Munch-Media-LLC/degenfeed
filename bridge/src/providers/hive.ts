/**
 * Hive Blog Provider
 *
 * Fetches blog posts from the Hive blockchain.
 * Hive is a decentralized blockchain for social media and content publishing,
 * forked from Steem. It supports blogs, communities, and dApps.
 *
 * API: Hive JSON-RPC (via api.hive.blog or any Hive API node)
 * - bridge.get_ranked_posts: fetch posts sorted by trending/hot/new
 * - bridge.list_communities: list communities
 * - condenser_api.get_content: single post details
 *
 * Content strategy:
 * 1. Trending posts across Hive (all tags)
 * 2. Crypto/blockchain related posts (tag: crypto, bitcoin, ethereum)
 * 3. Community-specific feeds (especially crypto/tech communities)
 * 4. User blogs from curated creators
 */

import type { SchemaGuard, UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;

const HIVE_API = process.env.HIVE_API_URL || 'https://api.hive.blog';
const HIVE_ENGINE_API = 'https://api.hive-engine.com/rpc/contracts';

// ─── Types ─────────────────────────────────────────────────────────────

interface HiveAccount {
  name: string;
  display_name?: string;
  about?: string;
  website?: string;
  profile_image?: string;
  cover_image?: string;
  post_count: number;
  reputation: number;
}

interface HivePostJsonMetadata {
  tags?: string[];
  app?: string;
  format?: string;
  description?: string;
  image?: string[];
  links?: string[];
  users?: string[];
  video?: {
    content?: {
      videohash?: string;
      thumbnailUrl?: string;
      description?: string;
      duration?: number;
    };
    info?: {
      title?: string;
      author?: string;
      permlink?: string;
      duration?: number;
      thumbnail?: string;
    };
  };
  community?: string;
  community_id?: string;
  canonical_url?: string;
  embeds?: Array<{
    type: string;
    url: string;
    embed?: Record<string, unknown>;
  }>;
}

interface HivePost {
  post_id: number;
  author: string;
  permlink: string;
  category: string;
  title: string;
  body: string;
  json_metadata: string | HivePostJsonMetadata;
  created: string;
  last_update: string;
  depth: number;
  children: number;
  net_rshares: number;
  total_payout_value: string;
  curator_payout_value: string;
  pending_payout_value: string;
  author_reputation: number;
  active_votes: Array<{
    voter: string;
    weight: number;
    rshares: number;
    percent: number;
    reputation: number;
    time: string;
  }>;
  community?: string;
  community_title?: string;
  beneficiaries?: Array<{ account: string; weight: number }>;
  max_accepted_payout: string;
  percent_hbd: number;
  url: string;
  stats?: {
    total_votes: number;
    total_payout_value: string;
    total_author_payout_value: string;
  };
}

interface HiveRankedPostResponse {
  posts: HivePost[];
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

function parseJsonMetadata(raw: string | HivePostJsonMetadata | undefined): HivePostJsonMetadata {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw) as HivePostJsonMetadata;
  } catch {
    return {};
  }
}

function parseReputation(rep: number): number {
  // Hive reputation score formula
  if (rep === 0) return 0;
  const neg = rep < 0;
  const repLog = Math.log10(Math.abs(rep));
  let level = Math.max(repLog - 9, 0);
  if (level < 0) level = 0;
  if (neg) level = -level;
  return Math.floor(level * 9 + 25);
}

export function guessNiches(text: string, title: string, tags: string[] = [], community: string = ''): string[] {
  const niches: string[] = [];
  const lower = `${text} ${title} ${tags.join(' ')} ${community}`.toLowerCase();

  if (/\b(btc|bitcoin|satoshi|halving)\b/.test(lower)) niches.push('bitcoin');
  if (/\b(eth|ethereum|vitalik|pectra)\b/.test(lower)) niches.push('ethereum');
  if (/\b(sol|solana|spl)\b/.test(lower)) niches.push('solana');
  if (/\b(defi|liquidity|yield|farm|swap|dex|staking|lp)\b/.test(lower)) niches.push('defi');
  if (/\b(nft|art|collectible|mint|token|opensea)\b/.test(lower)) niches.push('nft');
  if (/\b(ai |artificial|intelligence|llm|agent|machine learning|deep learning)\b/.test(lower))
    niches.push('ai');
  if (/\b(sec|regulation|etf|compliance|policy)\b/.test(lower)) niches.push('regulation');
  if (/\b(meme|pepe|doge|shib|bonk|memecoin)\b/.test(lower)) niches.push('memecoin');
  if (/\b(security|hack|exploit|audit|scam|phishing|breach|vuln)\b/.test(lower))
    niches.push('security');
  if (/\b(crypto|blockchain|web3|hive|hbd|hive-engine)\b/.test(lower)) niches.push('crypto');
  if (/\b(tech|technology|programming|code|software|dev|github|open.source)\b/.test(lower))
    niches.push('tech');
  if (/\b(news|breaking|analysis|opinion|discussion)\b/.test(lower)) niches.push('news');
  if (/\b(science|research|study|paper|discovery|biology|physics|space)\b/.test(lower))
    niches.push('science');
  if (/\b(music|song|artist|album|creative|poetry|writing)\b/.test(lower)) niches.push('music');
  if (/\b(photography|photo|picture|travel|nature)\b/.test(lower)) niches.push('photography');
  if (/\b(gaming|game|play|esports)\b/.test(lower)) niches.push('gaming');
  if (/\b(hive|hive.blog|peakd|ecency|leofinance)\b/i.test(lower)) niches.push('crypto');

  if (niches.length === 0) {
    if (community?.toLowerCase().includes('crypto') || community?.toLowerCase().includes('leo')) {
      niches.push('crypto');
    } else if (community?.toLowerCase().includes('tech')) {
      niches.push('tech');
    } else if (community?.toLowerCase().includes('art')) {
      niches.push('art');
    } else niches.push('crypto');
  }
  return niches;
}

// ─── Map Hive post to UnifiedPost ─────────────────────────────────────

function hivePostToPost(post: HivePost): UnifiedPost {
  const meta = parseJsonMetadata(post.json_metadata);
  const tags = meta.tags || [];
  const images = meta.image || [];
  const communityName = post.community_title || post.community || post.category || 'hive';
  const text = post.title ? `${post.title}\n\n${stripHtml(post.body).slice(0, 1000)}`.trim() : stripHtml(post.body).slice(0, 1000).trim();
  const reputation = parseReputation(post.author_reputation);

  // Parse payout
  let payoutValue = 0;
  try {
    payoutValue = parseFloat(post.total_payout_value || '0') + parseFloat(post.curator_payout_value || '0');
  } catch {
    // ignore
  }

  const embeds: Array<{ kind: string; url: string; meta?: Record<string, unknown> }> = [];
  for (const img of images.slice(0, 5)) {
    if (img?.startsWith('http')) {
      embeds.push({ kind: 'image', url: img });
    }
  }

  // Add video embed if present
  if (meta.video?.content?.thumbnailUrl) {
    embeds.push({
      kind: 'image',
      url: meta.video.content.thumbnailUrl,
      meta: { videoThumbnail: true, duration: meta.video.content.duration },
    });
  }

  // Add canonical URL link
  if (meta.canonical_url) {
    embeds.push({ kind: 'link', url: meta.canonical_url, meta: { canonical: true } });
  }

  return {
    id: `hive:${post.author}/${post.permlink}`,
    protocol: 'hive',
    author: {
      id: `hive:${post.author}`,
      primary: { protocol: 'hive', id: post.author },
      handles: { hive: post.author },
      displayName: post.author,
      bio: '',
      avatarUrl: `https://images.hive.blog/u/${post.author}/avatar`,
      followerCount: 0,
      followingCount: 0,
      links: [],
      keys: {
        hiveUsername: post.author,
        hiveReputation: String(reputation),
      },
    },
    text,
    embeds,
    contentType: text.length > 800 ? 'article' : 'text',
    createdAt: new Date(post.created).getTime(),
    metrics: {
      likes: post.active_votes?.filter((v) => v.percent > 0).length || 0,
      reposts: 0,
      replies: post.children || 0,
      quotes: 0,
      views: 0,
    },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: {
        likes: post.active_votes?.filter((v) => v.percent > 0).length || 0,
        reposts: 0,
        replies: post.children || 0,
        quotes: 0,
      },
    },
    raw: post,
    niches: guessNiches(text, post.title, tags, communityName),
    community: {
      name: communityName,
      title: communityName,
      actorId: post.community || post.category,
      instance: 'hive.blog',
      niche: tags.includes('crypto') || communityName?.toLowerCase().includes('crypto')
        ? 'crypto'
        : undefined,
    },
  } as UnifiedPost;
}

// ─── Hive JSON-RPC call ────────────────────────────────────────────────

async function hiveRpcCall(method: string, params: unknown[]): Promise<unknown> {
  const res = await $fetch(HIVE_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'DegenFeed-Bridge/0.1 (Hive)',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method,
      params,
      id: Date.now(),
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Hive RPC HTTP ${res.status}`);
  const data = await res.json() as { result?: unknown; error?: { message: string } };
  if (data.error) throw new Error(data.error.message);
  return data.result;
}

// ─── Fetch Strategies ─────────────────────────────────────────────────

async function fetchTrending(limit: number, tag: string = ''): Promise<UnifiedPost[]> {
  try {
    const result = await hiveRpcCall('bridge.get_ranked_posts', [
      { sort: 'trending', tag: tag || undefined, limit: Math.min(limit, 50) },
    ]);
    const posts = (result as HiveRankedPostResponse)?.posts;
    if (!Array.isArray(posts)) return [];
    return posts.slice(0, limit).map(hivePostToPost);
  } catch (err) {
    console.log(`[bridge] Hive trending error: ${(err as Error).message}`);
    return [];
  }
}

async function fetchHot(limit: number, tag: string = ''): Promise<UnifiedPost[]> {
  try {
    const result = await hiveRpcCall('bridge.get_ranked_posts', [
      { sort: 'hot', tag: tag || undefined, limit: Math.min(limit, 30) },
    ]);
    const posts = (result as HiveRankedPostResponse)?.posts;
    if (!Array.isArray(posts)) return [];
    return posts.slice(0, limit).map(hivePostToPost);
  } catch {
    return [];
  }
}

async function fetchNew(limit: number, tag: string = ''): Promise<UnifiedPost[]> {
  try {
    const result = await hiveRpcCall('bridge.get_ranked_posts', [
      { sort: 'created', tag: tag || undefined, limit: Math.min(limit, 30) },
    ]);
    const posts = (result as HiveRankedPostResponse)?.posts;
    if (!Array.isArray(posts)) return [];
    return posts.slice(0, limit).map(hivePostToPost);
  } catch {
    return [];
  }
}

async function fetchCommunityPosts(communityId: string, limit: number): Promise<UnifiedPost[]> {
  try {
    const result = await hiveRpcCall('bridge.get_ranked_posts', [
      { sort: 'trending', community: communityId, limit: Math.min(limit, 20) },
    ]);
    const posts = (result as HiveRankedPostResponse)?.posts;
    if (!Array.isArray(posts)) return [];
    return posts.slice(0, limit).map(hivePostToPost);
  } catch {
    return [];
  }
}

// ─── Main ──────────────────────────────────────────────────────────────

export const schema: SchemaGuard = {
  id: 'hive',
  name: 'Hive Blog',
  description: 'Blockchain-based blogging platform on Hive',
  endpoint: '/api/feed/hive',
  requiresAuth: false,
  contentType: 'mixed',
};

const CRYPTO_TAGS = ['crypto', 'bitcoin', 'ethereum', 'defi', 'nft', 'solana', 'ai', 'web3'];
const CRYPTO_COMMUNITIES = ['hive-167922', 'hive-125125']; // LeoFinance, Hive Crypto

export async function fetchHivePosts(limit = 20): Promise<UnifiedPost[]> {
  const perSource = Math.max(5, Math.ceil(limit / 6));

  const [trendingAll, hotAll, newPosts, ...tagPosts] = await Promise.all([
    fetchTrending(perSource),
    fetchHot(perSource),
    fetchNew(perSource),
    ...CRYPTO_TAGS.slice(0, 3).map((t) => fetchTrending(6, t)),
    ...CRYPTO_COMMUNITIES.map((c) => fetchCommunityPosts(c, 5)),
  ]);

  const all = [trendingAll, hotAll, newPosts, ...tagPosts].flat();

  // Deduplicate by post ID
  const seen = new Set<string>();
  const deduped: UnifiedPost[] = [];
  for (const p of all) {
    if (!seen.has(p.id) && deduped.length < limit) {
      seen.add(p.id);
      deduped.push(p);
    }
  }

  console.log(
    `[bridge] Hive: ${deduped.length} posts (trending: ${trendingAll.length}, hot: ${hotAll.length}, new: ${newPosts.length}, tags: ${tagPosts.length} posts)`,
  );
  return deduped;
}

/** @alias */
export const fetch = fetchHivePosts;
