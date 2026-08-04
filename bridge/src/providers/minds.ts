/**
 * Minds Provider (v2 API)
 *
 * Fetches posts from Minds — an open-source social network with crypto rewards.
 * Minds uses its own REST API and rewards content creators with Minds tokens.
 *
 * API v2: https://www.minds.com/api/v2/   (v3 returns 403 from this host)
 * Token economics: ETH-based Minds tokens, reward for engagement
 *
 * v2 responses use two shapes that are both parsed here:
 *   - `activity[]` — array of activity objects (primary shape)
 *   - `entities{}` — map of guid -> entity (some endpoints/legacy shape)
 *
 * Content strategy:
 * 1. Public newsfeed (anonymous accessible subset)
 * 2. Trending / discovery feeds
 * 3. Hashtag feeds for crypto/tech/ai topics
 * 4. Token rewards tracking (boosts, wire transfers)
 *
 * Spam filtering: lottery/giveaway spam, URL-only posts, and empty-content
 * posts are dropped before mapping to UnifiedPost.
 */

import type { SchemaGuard, UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;

const MINDS_API = 'https://www.minds.com/api/v2';
const MINDS_FRONT = 'https://www.minds.com';

/** 90s TTL — prewarmer + refresher call providers repeatedly; without a cache
 *  each call burns a Minds API request and the feed goes stale/empty. */
const MINDS_CACHE_TTL_MS = 90_000;
let mindsCache: { posts: UnifiedPost[]; expiresAt: number } | null = null;

// ─── Types ─────────────────────────────────────────────────────────────

interface MindsUser {
  guid: string;
  name: string;
  username: string;
  icontime: number;
  avatar_url?: string;
  icon_url?: string;
  briefdescription: string;
  subscribers_count?: number | null;
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
  activity_type?: string;
  type?: string;
  ownerObj?: MindsUser | null;
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
  mature?: boolean;
  spam?: boolean;
  deleted?: boolean;
  paywall?: boolean;
  wire_threshold?: {
    guid: string;
    type: string;
    min: string;
  };
  impressions?: number;
  boosts?: Array<{ guid: string; amount: string }>;
  reminds?: number;
  allows_reminds?: boolean;
  comments_count?: number;
  'comments:count'?: number;
  thumbs_up_count?: number;
  'thumbs:up:count'?: number;
  thumbs_down_count?: number;
  'thumbs:down:count'?: number;
  tags?: string[];
  category?: string;
  license?: string;
  attachment_guid?: string;
  attachments?: MindsAttachment[];
  remind_object?: MindsPost | null;
  entity_guid?: string;
  route?: string;
  urn?: string;
  quotes?: number;
}

interface MindsFeedResponse {
  status: string;
  /** v2 primary shape — array of activities */
  activity?: MindsPost[];
  /** legacy / alternate shape — map of guid -> entity */
  entities?: Record<string, MindsPost>;
  guide?: Array<{ guid: string }>;
  'load-next'?: string;
  error?: string;
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

/** Read a metric that may appear under v2 colon-keys or v3 underscore-keys. */
function metricCount(
  post: MindsPost,
  v2Key: 'thumbs:up:count' | 'comments:count' | 'thumbs:down:count',
  v3Key: 'thumbs_up_count' | 'comments_count' | 'thumbs_down_count',
): number {
  const v2 = post[v2Key];
  const v3 = post[v3Key];
  const raw = typeof v2 === 'number' ? v2 : typeof v3 === 'number' ? v3 : 0;
  return Number.isFinite(raw) ? raw : 0;
}

/** Extract posts from either v2 `activity[]` or `entities{}` response shape. */
function extractPosts(data: MindsFeedResponse): MindsPost[] {
  const posts: MindsPost[] = [];
  if (Array.isArray(data.activity)) posts.push(...data.activity);
  if (data.entities && typeof data.entities === 'object') {
    posts.push(...Object.values(data.entities));
  }
  return posts;
}

/**
 * Spam filter for the v2 activity stream.
 *
 * Drops:
 *  - lottery / giveaway spam (Vietnamese "xổ số" lottery, keno, etc.)
 *  - URL-only posts (message is just a link with no real content)
 *  - empty content (no message/title/blurb AND no media/remind)
 * Also drops entities explicitly flagged deleted/spam by the API.
 */
function isSpamActivity(post: MindsPost): boolean {
  if (post.deleted || post.spam) return true;

  const message = (post.message || '').trim();
  const title = (post.title || '').trim();
  const blurb = (post.blurb || '').trim();
  const text = `${message} ${title} ${blurb}`.toLowerCase();

  // Lottery / giveaway spam — Vietnamese lottery spam is endemic on Minds
  // ("xổ số" = lottery; "XSST" = Sóc Trăng lottery abbreviation).
  if (/xổ số|xs ?\d{2,}|kết quả xổ|xsst|sxst|loto|lô đề|lottery|keno|jackpot/.test(text)) {
    return true;
  }

  // URL-only post — message is a bare link with no title/blurb.
  if (message && /^https?:\/\/\S+$/.test(message) && !title && !blurb) {
    return true;
  }

  // Empty content — no text and no media/remind to display.
  const hasText = Boolean(message || title || blurb);
  const hasMedia = Boolean(
    post.thumbnail_src ||
      (post.custom_data && post.custom_data.length > 0) ||
      (post.attachments && post.attachments.length > 0),
  );
  const hasRemind = Boolean(post.remind_object);
  if (!hasText && !hasMedia && !hasRemind) return true;

  return false;
}

// ─── Map Minds post to UnifiedPost ─────────────────────────────────────

function mindsPostToPost(post: MindsPost): UnifiedPost {
  const owner = post.ownerObj || ({} as MindsUser);
  const isRemind = post.activity_type === 'remind' || Boolean(post.remind_object);
  const original = isRemind && post.remind_object ? post.remind_object : post;
  const text = original.title
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
        contentSrcs.push({
          kind: original.custom_type === 'video' ? 'video' : 'image',
          url: cd.src,
        });
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
    rewardsMeta.totalBoostAmount = post.boosts.reduce(
      (sum, b) => sum + parseFloat(b.amount || '0'),
      0,
    );
  }

  const likes = metricCount(original, 'thumbs:up:count', 'thumbs_up_count');
  const replies = metricCount(original, 'comments:count', 'comments_count');
  const reposts = original.reminds || 0;
  const quotes = typeof original.quotes === 'number' ? original.quotes : isRemind ? 1 : 0;
  const views = original.impressions || 0;

  return {
    id: `minds:${original.guid}`,
    protocol: 'minds',
    author: {
      id: `minds:${owner.guid || original.guid}`,
      primary: { protocol: 'minds', id: owner.username || owner.guid || original.guid },
      handles: { minds: owner.username || '' },
      displayName: owner.name || owner.username || 'Minds User',
      bio: owner.briefdescription || '',
      avatarUrl:
        owner.avatar_url ||
        owner.icon_url ||
        (owner.icontime ? `${MINDS_FRONT}/icon/${owner.guid}/${owner.icontime}/xlarge` : ''),
      followerCount: owner.subscribers_count || 0,
      followingCount: 0,
      links: [],
      keys: {
        mindsGuid: owner.guid || original.guid,
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
      likes,
      reposts,
      replies,
      quotes,
      views,
    },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes, reposts, replies, quotes },
    },
    raw: post,
    niches: guessNiches(text, original.title || '', tags),
    ...(Object.keys(rewardsMeta).length > 0
      ? ({ meta: rewardsMeta } as unknown as Record<string, unknown>)
      : {}),
  } as UnifiedPost;
}

// ─── Fetch via Minds v2 API ────────────────────────────────────────────

async function fetchNewsfeed(limit: number): Promise<UnifiedPost[]> {
  try {
    const res = await $fetch(`${MINDS_API}/newsfeed?limit=${Math.min(limit, 50)}&sync=1`, {
      headers: { 'User-Agent': 'DegenFeed-Bridge/0.1 (Minds)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as MindsFeedResponse;
    if (!data.activity && !data.entities) return [];

    const posts = extractPosts(data)
      .filter((p) => !isSpamActivity(p))
      .slice(0, limit);
    return posts.map(mindsPostToPost);
  } catch (err) {
    console.log(`[bridge] Minds newsfeed error: ${(err as Error).message}`);
    return [];
  }
}

async function fetchTrending(limit: number): Promise<UnifiedPost[]> {
  try {
    const res = await $fetch(`${MINDS_API}/newsfeed/trending?limit=${Math.min(limit, 30)}`, {
      headers: { 'User-Agent': 'DegenFeed-Bridge/0.1 (Minds)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as MindsFeedResponse;
    if (!data.activity && !data.entities) return [];

    const posts = extractPosts(data)
      .filter((p) => !isSpamActivity(p))
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
    if (!data.activity && !data.entities) return [];

    return extractPosts(data)
      .filter((p) => !isSpamActivity(p))
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
  // Serve from the 90s cache first so repeated feed-build calls (prewarm +
  // refresher + user requests) don't hammer Minds or return inconsistent sets.
  const cached = mindsCache && Date.now() < mindsCache.expiresAt ? mindsCache.posts : null;
  if (cached) return cached.slice(0, limit);

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

  console.log(
    `[bridge] Minds: ${deduped.length} posts (newsfeed: ${newsfeed.length}, trending: ${trending.length}, tags: ${tagFeeds.length} feeds)`,
  );
  mindsCache = { posts: deduped, expiresAt: Date.now() + MINDS_CACHE_TTL_MS };
  return deduped;
}

/** @alias */
export const fetch = fetchMindsPosts;
