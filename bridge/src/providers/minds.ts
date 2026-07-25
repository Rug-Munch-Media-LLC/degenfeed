/**
 * Minds Provider
 *
 * Fetches posts from Minds — an open-source social network with crypto rewards.
 * Minds uses its own REST API and rewards content creators with Minds tokens.
 *
 * API v3: https://www.minds.com/api/v3/
 * Token economics: ETH-based Minds tokens, reward for engagement
 *
 * Content strategy:
 * 1. Public newsfeed (anonymous accessible subset)
 * 2. Trending / discovery feeds
 * 3. Hashtag feeds for crypto/tech/ai topics
 * 4. Token rewards tracking (boosts, wire transfers)
 */

import type { SchemaGuard, UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;

const MINDS_API = 'https://www.minds.com/api/v3';
const MINDS_FRONT = 'https://www.minds.com';

// ─── Types ─────────────────────────────────────────────────────────────

interface MindsUser {
  guid: string;
  name: string;
  username: string;
  icontime: number;
  avatar_url?: string;
  briefdescription: string;
  subscribers_count: number;
  impressions: number;
  is_admin?: boolean;
  is_verified?: boolean;
  rewards?: boolean;
}

interface MindsAttachment {
  guid: string;
  type: 'image' | 'video' | 'audio' | 'file';
  src: string;
  width?: number;
  height?: number;
  blurhash?: string;
}

interface MindsPost {
  guid: string;
  activity_type: 'activity' | 'image' | 'video' | 'blog' | 'remind' | 'quote';
  ownerObj: MindsUser;
  message: string;
  title?: string;
  description?: string;
  blurb?: string;
  custom_type?: 'batch' | 'video' | null;
  custom_data?: Array<{ src: string; width?: number; height?: number }> | null;
  thumbnail_src?: string;
  time_created: string;
  time_published?: string;
  container_guid?: string;
  mature: boolean;
  spam: boolean;
  deleted: boolean;
  paywall: boolean;
  wire_threshold?: {
    guid: string;
    type: string;
    min: string;
  };
  impressions: number;
  boosts?: Array<{ guid: string; amount: string }>;
  reminds: number;
  allows_reminds: boolean;
  comments_count: number;
  thumbs_up_count: number;
  thumbs_down_count: number;
  tags?: string[];
  category?: string;
  license?: string;
  attachment_guid?: string;
  attachments?: MindsAttachment[];
  remind_object?: MindsPost | null;
  entity_guid?: string;
  route?: string;
  urn?: string;
}

interface MindsFeedResponse {
  status: string;
  entities: Record<string, MindsPost>;
  guide?: Array<{ guid: string }>;
  'load-next'?: string;
  error?: string;
}

interface MindsTrendingResponse {
  status: string;
  suggestions?: Array<{
    entity: MindsPost;
    channel?: MindsUser;
  }>;
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

export function guessNiches(text: string, title: string, tags: string[] = []): string[] {
  const niches: string[] = [];
  const lower = `${text} ${title} ${tags.join(' ')}`.toLowerCase();
  if (/\b(btc|bitcoin|satoshi|halving)\b/.test(lower)) niches.push('bitcoin');
  if (/\b(eth|ethereum|vitalik|pectra)\b/.test(lower)) niches.push('ethereum');
  if (/\b(sol|solana|spl)\b/.test(lower)) niches.push('solana');
  if (/\b(defi|liquidity|yield|farm|swap|dex|staking)\b/.test(lower)) niches.push('defi');
  if (/\b(nft|art|collectible|mint|token)\b/.test(lower)) niches.push('nft');
  if (/\b(ai |artificial|intelligence|llm|agent|machine learning)\b/.test(lower)) niches.push('ai');
  if (/\b(sec|regulation|etf|compliance|policy)\b/.test(lower)) niches.push('regulation');
  if (/\b(meme|pepe|doge|shib|bonk)\b/.test(lower)) niches.push('memecoin');
  if (/\b(security|hack|exploit|audit|scam|phishing|breach)\b/.test(lower)) niches.push('security');
  if (/\b(crypto|blockchain|web3|minds|token rewards)\b/.test(lower)) niches.push('crypto');
  if (/\b(minds|tokens|rewards|wire|boost)\b/.test(lower)) niches.push('crypto');
  if (/\b(tech|technology|programming|code|software|startup|oss)\b/.test(lower))
    niches.push('tech');
  if (/\b(news|breaking|report|analysis|opinion)\b/.test(lower)) niches.push('news');
  if (/\b(music|song|artist|album|creative)\b/.test(lower)) niches.push('music');
  if (niches.length === 0) niches.push('crypto');
  return niches;
}

// ─── Map Minds post to UnifiedPost ─────────────────────────────────────

function mindsPostToPost(post: MindsPost): UnifiedPost {
  const owner = post.ownerObj;
  const isRemind = post.activity_type === 'remind';
  const original = isRemind && post.remind_object ? post.remind_object : post;
  const text =
    original.title
      ? `${original.title}\n\n${stripHtml(original.message || original.description || original.blurb || '')}`
      : stripHtml(original.message || original.description || original.blurb || '');

  const tags = original.tags || [];
  const contentSrcs: Array<{ kind: 'image' | 'video'; url: string }> = [];

  if (original.thumbnail_src) {
    contentSrcs.push({ kind: 'image', url: original.thumbnail_src });
  }
  if (original.custom_data) {
    for (const cd of original.custom_data) {
      if (cd.src) {
        contentSrcs.push({ kind: original.custom_type === 'video' ? 'video' : 'image', url: cd.src });
      }
    }
  }
  if (original.attachments) {
    for (const a of original.attachments) {
      contentSrcs.push({ kind: a.type === 'video' ? 'video' : 'image', url: a.src });
    }
  }

  let contentType: string = 'text';
  if (contentSrcs.some((s) => s.kind === 'video')) contentType = 'video';
  else if (contentSrcs.length > 0) contentType = 'image';
  else if ((original.title?.length ?? 0) > 100) contentType = 'article';

  // Token rewards tracking
  const rewardsMeta: Record<string, unknown> = {};
  if (post.wire_threshold) {
    rewardsMeta.wireThreshold = post.wire_threshold;
  }
  if (post.boosts && post.boosts.length > 0) {
    rewardsMeta.totalBoostAmount = post.boosts.reduce((sum, b) => sum + parseFloat(b.amount || '0'), 0);
  }

  return {
    id: `minds:${original.guid}`,
    protocol: 'minds',
    author: {
      id: `minds:${owner.guid}`,
      primary: { protocol: 'minds', id: owner.username },
      handles: { minds: owner.username },
      displayName: owner.name || owner.username || 'Minds User',
      bio: owner.briefdescription || '',
      avatarUrl: owner.avatar_url || (owner.icontime
        ? `${MINDS_FRONT}/icon/${owner.guid}/${owner.icontime}/xlarge`
        : ''),
      followerCount: owner.subscribers_count || 0,
      followingCount: 0,
      links: [],
      keys: {
        mindsGuid: owner.guid,
        mindsRewardsEnabled: owner.rewards ? 'true' : 'false',
      },
    },
    text,
    embeds: [
      ...contentSrcs.map((s) => ({
        kind: s.kind,
        url: s.url.startsWith('http') ? s.url : `${MINDS_FRONT}${s.url}`,
      })),
      ...(isRemind && post.remind_object
        ? [
            {
              kind: 'quote' as const,
              url: `${MINDS_FRONT}/${post.remind_object.ownerObj?.username || 'newsfeed'}/${post.remind_object.guid}`,
              meta: { quotedGuid: post.remind_object.guid },
            },
          ]
        : []),
    ],
    contentType,
    createdAt: parseInt(original.time_created, 10) * 1000,
    metrics: {
      likes: original.thumbs_up_count || 0,
      reposts: original.reminds || 0,
      replies: original.comments_count || 0,
      quotes: isRemind ? 1 : 0,
      views: original.impressions || 0,
    },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: {
        likes: original.thumbs_up_count || 0,
        reposts: original.reminds || 0,
        replies: original.comments_count || 0,
        quotes: isRemind ? 1 : 0,
      },
    },
    raw: post,
    niches: guessNiches(text, original.title || '', tags),
    ...(Object.keys(rewardsMeta).length > 0 ? { meta: rewardsMeta } as unknown as Record<string, unknown> : {}),
  } as UnifiedPost;
}

// ─── Fetch via Minds API ───────────────────────────────────────────────

async function fetchNewsfeed(limit: number): Promise<UnifiedPost[]> {
  try {
    const res = await $fetch(
      `${MINDS_API}/newsfeed?limit=${Math.min(limit, 50)}&sync=1`,
      {
        headers: { 'User-Agent': 'DegenFeed-Bridge/0.1 (Minds)' },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as MindsFeedResponse;
    if (!data.entities) return [];

    const posts: MindsPost[] = Object.values(data.entities)
      .filter((p) => !p.deleted && !p.spam)
      .slice(0, limit);

    return posts.map(mindsPostToPost);
  } catch (err) {
    console.log(`[bridge] Minds newsfeed error: ${(err as Error).message}`);
    return [];
  }
}

async function fetchTrending(limit: number): Promise<UnifiedPost[]> {
  try {
    const res = await $fetch(
      `${MINDS_API}/newsfeed/trending?limit=${Math.min(limit, 30)}`,
      {
        headers: { 'User-Agent': 'DegenFeed-Bridge/0.1 (Minds)' },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as MindsFeedResponse;
    if (!data.entities) return [];

    const posts: MindsPost[] = Object.values(data.entities)
      .filter((p) => !p.deleted && !p.spam)
      .slice(0, limit);

    return posts.map(mindsPostToPost);
  } catch {
    return [];
  }
}

async function fetchHashtagFeed(tag: string, limit: number): Promise<UnifiedPost[]> {
  try {
    const res = await $fetch(
      `${MINDS_API}/newsfeed/trending?hashtag=${encodeURIComponent(tag)}&limit=${Math.min(limit, 15)}`,
      {
        headers: { 'User-Agent': 'DegenFeed-Bridge/0.1 (Minds)' },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as MindsFeedResponse;
    if (!data.entities) return [];

    return Object.values(data.entities)
      .filter((p) => !p.deleted && !p.spam)
      .slice(0, limit)
      .map(mindsPostToPost);
  } catch {
    return [];
  }
}

// ─── Main ──────────────────────────────────────────────────────────────

export const schema: SchemaGuard = {
  id: 'minds',
  name: 'Minds',
  description: 'Open-source social network with crypto token rewards',
  endpoint: '/api/feed/minds',
  requiresAuth: false,
  contentType: 'mixed',
};

const INTEREST_TAGS = ['bitcoin', 'crypto', 'ethereum', 'defi', 'nft', 'ai', 'tech', 'blockchain'];

export async function fetchMindsPosts(limit = 20): Promise<UnifiedPost[]> {
  const perSource = Math.max(3, Math.ceil(limit / 5));

  const [newsfeed, trending, ...tagFeeds] = await Promise.all([
    fetchNewsfeed(perSource),
    fetchTrending(perSource),
    ...INTEREST_TAGS.slice(0, 4).map((t) => fetchHashtagFeed(t, 5)),
  ]);

  const all = [newsfeed, trending, ...tagFeeds].flat();

  // Deduplicate by GUID
  const seen = new Set<string>();
  const deduped: UnifiedPost[] = [];
  for (const p of all) {
    if (!seen.has(p.id) && deduped.length < limit) {
      seen.add(p.id);
      deduped.push(p);
    }
  }

  console.log(`[bridge] Minds: ${deduped.length} posts (newsfeed: ${newsfeed.length}, trending: ${trending.length}, tags: ${tagFeeds.length} feeds)`);
  return deduped;
}

/** @alias */
export const fetch = fetchMindsPosts;
