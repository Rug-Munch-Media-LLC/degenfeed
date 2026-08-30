/**
 * PieFed Provider
 *
 * Rate Limit: 30 requests/minute
 *
 * Fetches posts from the self-hosted PieFed instance (port 8023).
 * PieFed is a link-aggregator (Reddit-style) on ActivityPub, built with
 * Flask/Python. The instance exposes the "alpha" REST API under
 * `/api/alpha/` (ENABLE_ALPHA_API=true in the container env).
 *
 * Endpoints:
 *   GET /api/alpha/post/list?limit=N&sort=Hot&type_=All  → { posts: [...], next_page }
 *   GET /api/alpha/community/list?limit=N                → { communities: [...], next_page }
 *   GET /api/alpha/feed/list                             → { feeds: [...] }
 *   GET /api/alpha/site                                  → instance info
 *
 * Known issue: the PieFed instance has no public vhost configured
 * (only 127.0.0.1:8023 / links.degenfeed.xyz SERVER_NAME). The feed
 * page documents this.
 */

import { checkRateLimit } from '../rate-limiter';
import type { SchemaGuard, UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;

const PIEFED_BASE = 'http://127.0.0.1:8023';
const PIEFED_HOST = 'links.degenfeed.xyz';

// ─── Types (alpha API shapes) ──────────────────────────────────────────

interface PieFedPostCore {
  id: number;
  title: string;
  body?: string;
  published: string;
  ap_id?: string;
  local?: boolean;
  nsfw?: boolean;
  post_type?: string;
  url?: string;
  thumbnail_url?: string;
  small_thumbnail_url?: string;
  alt_text?: string;
  tags?: string;
}

interface PieFedCounts {
  post_id?: number;
  comments?: number;
  score?: number;
  upvotes?: number;
  downvotes?: number;
}

interface PieFedUser {
  id?: number;
  user_name?: string;
  title?: string;
  avatar?: string;
  actor_id?: string;
  local?: boolean;
}

interface PieFedCommunity {
  id?: number;
  name?: string;
  title?: string;
  actor_id?: string;
  ap_domain?: string;
  local?: boolean;
  description?: string;
}

interface PieFedPostView {
  post?: PieFedPostCore;
  counts?: PieFedCounts;
  creator?: PieFedUser;
  community?: PieFedCommunity;
  my_vote?: number;
  saved?: boolean;
  read?: boolean;
}

interface PieFedPostListResponse {
  posts: PieFedPostView[];
  next_page?: string | null;
}

// ─── Helpers ───────────────────────────────────────────────────────────

export function guessNiches(text: string, community: string): string[] {
  const niches: string[] = [];
  const lower = `${text} ${community}`.toLowerCase();
  if (/\b(btc|bitcoin|satoshi|halving)\b/.test(lower)) niches.push('bitcoin');
  if (/\b(eth|ethereum|vitalik|pectra)\b/.test(lower)) niches.push('ethereum');
  if (/\b(sol|solana|spl)\b/.test(lower)) niches.push('solana');
  if (/\b(defi|liquidity|yield|farm|lp|lending)\b/.test(lower)) niches.push('defi');
  if (/\b(nft|art|collectible)\b/.test(lower)) niches.push('nft');
  if (/\b(ai|artificial|intelligence|llm|agent)\b/.test(lower)) niches.push('ai');
  if (/\b(sec|regulation|etf)\b/.test(lower)) niches.push('regulation');
  if (/\b(meme|pepe|dog|shib)\b/.test(lower)) niches.push('memecoin');
  if (/\b(layer2|l2|arbitrum|optimism|base)\b/.test(lower)) niches.push('layer2');
  if (/\b(security|hack|exploit|audit)\b/.test(lower)) niches.push('security');
  if (
    /\b(rust|typescript|python|programming|code|dev)\b/.test(lower) ||
    community === 'tech' ||
    community === 'programming'
  )
    niches.push('tech');
  if (/\b(web3|blockchain|wallet)\b/.test(lower) || community === 'web3') niches.push('web3');
  if (niches.length === 0) niches.push('crypto');
  return niches;
}

// ─── Mapping ───────────────────────────────────────────────────────────

export function postToUnified(pv: PieFedPostView): UnifiedPost | null {
  if (!pv?.post) return null;
  const post = pv.post;
  const counts = pv.counts ?? { comments: 0, score: 0, upvotes: 0, downvotes: 0 };
  const community = pv.community;
  const creator = pv.creator;

  const text = post.body ? `${post.title}\n\n${post.body}` : post.title;
  const link = post.url || '';
  const createdAt = new Date(post.published).getTime();
  const authorName = creator?.title || creator?.user_name || `user@${community?.name || 'piefed'}`;
  const authorId = creator?.id ? String(creator.id) : community?.name || 'unknown';
  const communityName = community?.name || 'piefed';
  const actorId = community?.actor_id || `https://${PIEFED_HOST}/c/${communityName}`;

  // Post type: PieFed returns "Link", "Discussion", "Image", "Video", "Poll"
  const postType = (post.post_type || '').toLowerCase();
  const contentType = postType.includes('link')
    ? 'link'
    : postType.includes('image')
      ? 'image'
      : postType.includes('video')
        ? 'video'
        : postType.includes('discussion')
          ? 'text'
          : link
            ? 'link'
            : 'text';

  return {
    id: `piefed:${post.id}@${PIEFED_HOST}`,
    protocol: 'piefed',
    author: {
      id: `piefed:${authorId}@${PIEFED_HOST}`,
      primary: { protocol: 'piefed', id: authorId },
      handles: { piefed: `${creator?.user_name ?? 'unknown'}@${PIEFED_HOST}` },
      displayName: authorName,
      bio: '',
      avatarUrl: creator?.avatar || '',
      followerCount: 0,
      followingCount: 0,
      links: [{ label: 'community', url: actorId }],
      verified: [],
      keys: {},
    },
    text,
    embeds: link ? [{ kind: 'link', url: link }] : [],
    contentType,
    createdAt: Number.isNaN(createdAt) ? Date.now() : createdAt,
    metrics: {
      likes: counts.upvotes ?? 0,
      reposts: 0,
      replies: counts.comments ?? 0,
      quotes: 0,
    },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: {
        likes: counts.upvotes ?? 0,
        reposts: 0,
        replies: counts.comments ?? 0,
        quotes: 0,
      },
    },
    raw: pv,
    niches: guessNiches(text, communityName),
  };
}

// ─── Fetch ─────────────────────────────────────────────────────────────

async function fetchPostList(limit: number): Promise<UnifiedPost[]> {
  try {
    const url = `${PIEFED_BASE}/api/alpha/post/list?limit=${Math.min(limit, 50)}&sort=Hot&type_=All`;
    const res = await $fetch(url, {
      headers: { 'User-Agent': 'DegenFeed-Bridge/0.1 (PieFed)' },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) {
      // console.log(`[bridge] PieFed post/list HTTP ${res.status}`);
      return [];
    }
    const data = (await res.json()) as PieFedPostListResponse;
    if (!data.posts || data.posts.length === 0) return [];
    return data.posts
      .map(postToUnified)
      .filter((p): p is UnifiedPost => p !== null)
      .slice(0, limit);
  } catch {
    // console.log(`[bridge] PieFed post/list error: ${(err as Error).message}`);
    return [];
  }
}

async function fetchCommunityPosts(limit: number): Promise<UnifiedPost[]> {
  // Fallback: fetch community list and then posts per community if the
  // global post/list came back empty (fresh instances often have no posts).
  try {
    const url = `${PIEFED_BASE}/api/alpha/community/list?limit=${Math.min(limit, 20)}`;
    const res = await $fetch(url, {
      headers: { 'User-Agent': 'DegenFeed-Bridge/0.1 (PieFed)' },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      communities: Array<{ name?: string }>;
      next_page?: string | null;
    };
    const communities = (data.communities || []).slice(0, 4);
    const results = await Promise.allSettled(
      communities.map(async (c) => {
        if (!c.name) return [] as UnifiedPost[];
        const cUrl = `${PIEFED_BASE}/api/alpha/post/list?limit=5&sort=Hot&type_=All&community_name=${encodeURIComponent(c.name)}`;
        const cres = await $fetch(cUrl, {
          headers: { 'User-Agent': 'DegenFeed-Bridge/0.1 (PieFed)' },
          signal: AbortSignal.timeout(6000),
        });
        if (!cres.ok) return [] as UnifiedPost[];
        const cdata = (await cres.json()) as PieFedPostListResponse;
        return (cdata.posts || []).map(postToUnified).filter((p): p is UnifiedPost => p !== null);
      }),
    );
    const all: UnifiedPost[] = [];
    for (const r of results) {
      if (r.status === 'fulfilled') all.push(...r.value);
    }
    return all.slice(0, limit);
  } catch {
    // console.log(`[bridge] PieFed community/list error: ${(err as Error).message}`);
    return [];
  }
}

// ─── Main ──────────────────────────────────────────────────────────────

export const schema: SchemaGuard = {
  id: 'piefed',
  name: 'PieFed',
  description: 'Link aggregator and community discussions — local PieFed instance',
  endpoint: '/api/feed/piefed',
  requiresAuth: false,
  contentType: 'mixed',
};

export async function fetchPieFedPosts(limit = 20): Promise<UnifiedPost[]> {
  if (!checkRateLimit('piefed', { maxRequests: 30, windowMs: 60_000 })) {
    // console.log('[piefed] Rate limited, skipping fetch');
    return [];
  }
  const all: UnifiedPost[] = [];
  const [listRes, communityRes] = await Promise.allSettled([
    fetchPostList(limit),
    fetchCommunityPosts(Math.max(5, Math.ceil(limit / 2))),
  ]);
  if (listRes.status === 'fulfilled') all.push(...listRes.value);
  if (communityRes.status === 'fulfilled') all.push(...communityRes.value);

  // Deduplicate by content hash
  const seen = new Set<string>();
  const deduped: UnifiedPost[] = [];
  for (const p of all) {
    const key = p.id;
    if (!seen.has(key) && deduped.length < limit) {
      seen.add(key);
      deduped.push(p);
    }
  }

  // console.log(`[bridge] PieFed: ${deduped.length} posts`);
  return deduped;
}

/** @alias Standardized export */
export const fetchPosts = fetchPieFedPosts;
/** @deprecated Use `fetchPosts` instead */
export const fetch = fetchPieFedPosts;
