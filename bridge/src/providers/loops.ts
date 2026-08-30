/**
 * Loops Provider
 *
 * Rate Limit: 30 requests/minute (Loops applies `throttle:api` to /api/web/feed)
 *
 * Fetches videos from the self-hosted Loops instance (port 8136).
 * Loops is an open-source, ActivityPub-federated TikTok alternative
 * (loops.video / pixelfed fork lineage) running at loops.degenfeed.xyz.
 * The instance is the DegenFeed-branded video hub for short-form loops.
 *
 * API: GET /api/web/feed (public web feed, throttle-only middleware).
 * The response is a Laravel paginated JSON envelope:
 *   { data: VideoResource[], links: {...}, meta: {...} }
 *
 * A personal access token (LOOPS_ACCESS_TOKEN, minted via
 * `php artisan passport:client --personal`) is sent as a Bearer token when
 * configured; the public feed does not require it today, but sending it is
 * harmless and future-proofs authenticated endpoints.
 */

import { checkRateLimit } from '../rate-limiter';
import type { SchemaGuard, UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;

const LOOPS_BASE = process.env.LOOPS_BASE_URL || 'https://loops.degenfeed.xyz';
const LOOPS_TOKEN = process.env.LOOPS_ACCESS_TOKEN || '';

/**
 * Remote Loops instances used as fallback when the local instance has no
 * content. The flagship instance (loops.video) serves the same Laravel
 * paginated envelope as the self-hosted fork, so the same mapping applies.
 * Verified reachable 2026-08-06 with non-empty /api/web/feed responses:
 *   - loops.video        (flagship, ~4 posts)
 *   - ff93.space         (~8 posts)
 *   - brioco.video       (~2 posts)
 *   - loops.one          (~1 post)
 * The local instance (loops.degenfeed.xyz) is checked first, then these
 * federated peers so the feed surfaces content across the Loops network.
 */
const LOOPS_REMOTE_INSTANCES = [
  { base: 'https://loops.video', label: 'loops.video' },
  { base: 'https://ff93.space', label: 'ff93.space' },
  { base: 'https://brioco.video', label: 'brioco.video' },
  { base: 'https://loops.one', label: 'loops.one' },
];

/** Compact account shape from AccountService::compact(). */
interface LoopsAccount {
  id: string;
  name: string;
  username: string;
  avatar?: string;
}

/** Video item shape returned by VideoResource::toArray(). */
interface LoopsVideo {
  id: string;
  account: LoopsAccount;
  caption: string | null;
  url: string;
  shortcode: string;
  is_owner?: boolean;
  is_sensitive?: boolean;
  media: {
    thumbnail: string;
    src_url: string | null;
    hls_url?: string | null;
    alt_text?: string | null;
    duration?: number;
  };
  pinned?: boolean;
  likes: number;
  shares: number;
  comments: number;
  bookmarks: number;
  has_liked?: boolean;
  has_bookmarked?: boolean;
  is_edited?: boolean;
  lang?: string | null;
  tags?: string[];
  mentions?: string[];
  permissions?: Record<string, boolean>;
  audio?: Record<string, unknown>;
  meta?: { contains_ai?: boolean; contains_ad?: boolean };
  created_at: string;
}

interface LoopsResponse {
  data: LoopsVideo[];
  links?: {
    first?: string | null;
    last?: string | null;
    prev?: string | null;
    next?: string | null;
  };
  meta?: Record<string, unknown>;
}

// ─── Cache ─────────────────────────────────────────────────────────────
// 90s TTL collapses repeated feed-build calls (prewarm + refresher + user
// requests) into one real fetch per window, exactly like the Threads and
// Reddit providers. Loops caches the feed server-side for 45 minutes, so the
// extra client-side window costs nothing in freshness.

const LOOPS_CACHE_TTL_MS = 90_000;

let loopsCache: { posts: UnifiedPost[]; expiresAt: number } | null = null;

function getCachedPosts(): UnifiedPost[] | null {
  if (loopsCache && Date.now() < loopsCache.expiresAt) return loopsCache.posts;
  return null;
}

function setCachedPosts(posts: UnifiedPost[]): void {
  loopsCache = { posts, expiresAt: Date.now() + LOOPS_CACHE_TTL_MS };
}

// ─── Schema guard ──────────────────────────────────────────────────────

/**
 * Validate that a parsed JSON body actually looks like a Loops feed
 * response before mapping it. The Loops fork occasionally changes the
 * paginated envelope; a shape mismatch should surface as an empty feed
 * (with a log line) rather than a thrown TypeError mid-map.
 */
function isValidLoopsResponse(raw: unknown): raw is LoopsResponse {
  if (!raw || typeof raw !== 'object') return false;
  const body = raw as Record<string, unknown>;
  if (!Array.isArray(body.data)) return false;
  // Every item must at least carry an id and account — the fields the
  // mapper depends on for stable dedup keys and author identity.
  return (body.data as unknown[]).every((item) => {
    if (!item || typeof item !== 'object') return false;
    const v = item as Record<string, unknown>;
    return (
      typeof v.id === 'string' &&
      !!v.account &&
      typeof v.account === 'object' &&
      typeof (v.account as Record<string, unknown>).id === 'string'
    );
  });
}

// ─── Helpers ───────────────────────────────────────────────────────────

/** Best available thumbnail; falls back to the Loops placeholder. */
function videoThumbnailUrl(video: LoopsVideo): string {
  return video.media?.thumbnail || `${LOOPS_BASE}/storage/videos/video-placeholder.jpg`;
}

/** Full inline-player embed URL (HLS when available, otherwise MP4 src). */
function videoEmbedUrl(video: LoopsVideo): string {
  const src = video.media?.src_url;
  return src || video.url;
}

/** Guess content niches from caption + tags (mirrors peertube helper). */
function guessNiches(text: string, tags: string[] = []): string[] {
  const niches: string[] = [];
  const lower = `${text} ${tags.join(' ')}`.toLowerCase();
  if (/\b(btc|bitcoin|satoshi|halving)\b/.test(lower)) niches.push('bitcoin');
  if (/\b(eth|ethereum|vitalik|pectra)\b/.test(lower)) niches.push('ethereum');
  if (/\b(sol|solana|spl)\b/.test(lower)) niches.push('solana');
  if (/\b(defi|liquidity|yield|farm|lp)\b/.test(lower)) niches.push('defi');
  if (/\b(nft|art|collectible)\b/.test(lower)) niches.push('nft');
  if (/\b(ai|artificial|intelligence|llm|agent)\b/.test(lower)) niches.push('ai');
  if (/\b(sec|regulation|etf)\b/.test(lower)) niches.push('regulation');
  if (/\b(meme|pepe|dog|shib)\b/.test(lower)) niches.push('memecoin');
  if (/\b(security|hack|exploit|audit|scam|phishing)\b/.test(lower)) niches.push('security');
  if (/\b(layer2|l2|arbitrum|optimism|base|polygon)\b/.test(lower)) niches.push('layer2');
  if (/\b(tutorial|guide|how.?to|learn|course|explain)\b/.test(lower)) niches.push('educational');
  if (/\b(review|unboxing|overview)\b/.test(lower)) niches.push('review');
  if (niches.length === 0) niches.push('crypto');
  return niches;
}

/** Format a Loops duration (seconds) as `m:ss` or `h:mm:ss`. */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Format a view-like count into a compact display string. */
export function formatCount(count: number): string {
  if (!Number.isFinite(count) || count < 0) return '0';
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(count);
}

// ─── Mapping ───────────────────────────────────────────────────────────

export function loopsVideoToPost(video: LoopsVideo): UnifiedPost {
  const account = video.account;
  const authorName = account?.name || account?.username || 'Loops';
  const authorHandle = account?.username || '';
  const avatarUrl = account?.avatar || '';
  const tags = Array.isArray(video.tags) ? video.tags : [];

  const text = video.caption?.trim() || '';
  const createdAt = video.created_at ? new Date(video.created_at).getTime() : Date.now();
  const videoUrl = video.url || `${LOOPS_BASE}/v/${video.shortcode}`;
  const thumbnailUrl = videoThumbnailUrl(video);
  const embedUrl = videoEmbedUrl(video);
  const duration = video.media?.duration || 0;

  return {
    id: `loops:${video.id}`,
    protocol: 'loops',
    author: {
      id: `loops:${account?.id || video.id}`,
      primary: { protocol: 'loops', id: account?.id || video.id },
      handles: { loops: authorHandle },
      displayName: authorName,
      bio: '',
      avatarUrl,
      followerCount: 0,
      followingCount: 0,
      links: videoUrl ? [{ label: 'profile', url: videoUrl }] : [],
      keys: {},
    },
    text,
    contentType: 'video',
    embeds: [
      {
        kind: 'video',
        url: videoUrl,
        meta: {
          duration,
          views: 0,
          likes: video.likes || 0,
          shares: video.shares || 0,
          comments: video.comments || 0,
          thumbnail: thumbnailUrl,
          embedUrl,
          category: 'loops',
          isLive: false,
          sourceLabel: 'Loops via @degenfeed',
        },
      },
    ],
    createdAt: Number.isNaN(createdAt) ? Date.now() : createdAt,
    metrics: {
      likes: video.likes || 0,
      reposts: video.shares || 0,
      replies: video.comments || 0,
      quotes: 0,
      views: 0,
    },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: {
        likes: video.likes || 0,
        reposts: video.shares || 0,
        replies: video.comments || 0,
        quotes: 0,
      },
    },
    raw: {
      ...video,
      thumbnailUrl,
      embedUrl,
      durationLabel: formatDuration(duration),
      likesLabel: formatCount(video.likes || 0),
      sharesLabel: formatCount(video.shares || 0),
      commentsLabel: formatCount(video.comments || 0),
      sourceLabel: 'Loops via @degenfeed',
    },
    niches: guessNiches(text, tags),
    canonicalUrl: videoUrl,
  };
}

// ─── Main ──────────────────────────────────────────────────────────────

export const schema: SchemaGuard = {
  id: 'loops',
  name: 'Loops',
  description: 'Self-hosted short-form video platform (TikTok alternative) — loops.degenfeed.xyz',
  endpoint: '/api/feed/loops',
  requiresAuth: false,
  authEnvVar: 'LOOPS_ACCESS_TOKEN',
  contentType: 'video',
};

export async function fetchLoopsPosts(limit = 20): Promise<UnifiedPost[]> {
  // Serve from cache first — repeated feed-build calls must not hammer Loops.
  const cached = getCachedPosts();
  if (cached) return cached.slice(0, limit);

  // Rate limit: 30 requests/minute (Loops applies throttle:api to this route).
  if (!checkRateLimit('loops', { maxRequests: 30, windowMs: 60_000 })) {
    // console.log('[loops] Rate limited, skipping fetch');
    return [];
  }

  // Fetch the local instance first, then any remote instances as fallback.
  const instances = [{ base: LOOPS_BASE, label: 'local' }, ...LOOPS_REMOTE_INSTANCES];

  const allPosts: UnifiedPost[] = [];
  for (const instance of instances) {
    if (allPosts.length >= limit) break;
    const posts = await fetchLoopsFeed(instance.base, instance.label, limit - allPosts.length);
    if (posts.length > 0) {
      // console.log(`[loops] ${instance.label}: ${posts.length} posts`);
      allPosts.push(...posts);
    }
  }

  // Deduplicate by video id (local + remote may share federated content).
  const seen = new Set<string>();
  const deduped: UnifiedPost[] = [];
  for (const p of allPosts) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    deduped.push(p);
    if (deduped.length >= limit) break;
  }

  // console.log(`[bridge] Loops: ${deduped.length} posts (${instances.length} instances)`);
  // Only cache non-empty results so an empty window is retried next cycle.
  if (deduped.length > 0) setCachedPosts(deduped);
  return deduped;
}

/** Fetch and map a single Loops instance's public web feed. */
async function fetchLoopsFeed(base: string, _label: string, limit: number): Promise<UnifiedPost[]> {
  try {
    const headers: Record<string, string> = {
      'User-Agent': 'DegenFeed-Bridge/0.1',
      Accept: 'application/json',
    };
    if (LOOPS_TOKEN) headers.Authorization = `Bearer ${LOOPS_TOKEN}`;

    const res = await $fetch(`${base}/api/web/feed`, {
      headers,
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) {
      // console.log(`[loops] ${label}: HTTP ${res.status}`);
      return [];
    }

    const raw: unknown = await res.json();
    if (!isValidLoopsResponse(raw)) {
      // console.log(`[loops] ${label}: Unexpected response shape — refusing to map`);
      return [];
    }

    return raw.data
      .slice(0, limit)
      .filter((v) => v?.id)
      .map(loopsVideoToPost);
  } catch {
    // console.log(`[loops] ${label}: error - ${(err as Error).message}`);
    return [];
  }
}

/** @alias Use `fetch` as the standardized export name */
export const fetch = fetchLoopsPosts;
