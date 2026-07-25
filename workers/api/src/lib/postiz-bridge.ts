/**
 * @degenfeed/api-worker — Postiz API Bridge
 *
 * Bridges DegenFeed's premium publishing system to Postiz (self-hosted
 * social media scheduler). Routes premium-tier schedules through Postiz
 * for unlimited cross-posting across all supported protocols.
 *
 * Fallback: If Postiz is unreachable, gracefully falls back to DegenFeed's
 * native scheduler (executeCrossPublish in cross-publish-orchestrator.ts).
 *
 * Postiz runs at http://127.0.0.1:3105 (internal) /
 * https://schedule.degenfeed.xyz (external).
 *
 * @see /srv/degenfeed/postiz/README.md
 * @see /srv/degenfeed/postiz/platforms.json
 */

import type { Env } from '../index';
import type { MasterPost } from '@degenfeed/cross-protocol-bridge';
import type { QueueEntry, QueueStatus } from '../routes/premium-publish';

// ─── Constants ──────────────────────────────────────────────────────────────

const POSTIZ_BASE_URL = 'http://127.0.0.1:3105';
const POSTIZ_API_TIMEOUT = 10_000; // 10s
const POSTIZ_HEALTH_PATH = '/';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PostizScheduleRequest {
  /** Text content to post */
  text: string;
  /** Title (for LinkedIn, Reddit, etc.) */
  title?: string;
  /** ISO datetime for scheduled posting. null = immediate */
  scheduledAt?: string | null;
  /** Target platform IDs (e.g., 'mastodon', 'twitter', 'bluesky') */
  platforms: string[];
  /** Media URLs */
  mediaUrls?: string[];
  /** Hashtags (without # prefix) */
  hashtags?: string[];
  /** Link card URL */
  linkUrl?: string;
  /** Content warning / spoiler text */
  contentWarning?: string;
  /** Is this sensitive content */
  isSensitive?: boolean;
}

export interface PostizScheduleResponse {
  /** Postiz internal schedule ID */
  id: string;
  /** Current status */
  status: 'draft' | 'scheduled' | 'published' | 'failed' | 'cancelled';
  /** ISO schedule datetime */
  scheduledAt: string | null;
  /** ISO published datetime */
  publishedAt: string | null;
  /** Target platforms */
  platforms: string[];
  /** Per-platform publish results */
  results?: Record<string, {
    success: boolean;
    nativeId?: string;
    url?: string;
    error?: string;
  }>;
  /** Error message if failed */
  error?: string;
  /** ISO creation timestamp */
  createdAt: string;
}

export interface PostizAnalyticsResponse {
  /** Post identifier in Postiz */
  postId: string;
  /** Per-platform engagement metrics */
  platforms: Record<string, {
    likes: number;
    reposts: number;
    replies: number;
    quotes: number;
    impressions?: number;
    reach?: number;
    engagement_rate?: number;
  }>;
  /** Aggregated totals */
  total: {
    likes: number;
    reposts: number;
    replies: number;
    quotes: number;
    impressions: number;
  };
  /** Computed engagement score (0-100) */
  engagementScore: number;
  /** Top performing platform */
  bestPlatform: string | null;
}

export interface PostizBridgeStatus {
  available: boolean;
  version?: string;
  schedulesCount?: number;
  message: string;
}

// ─── Postiz Health Check ────────────────────────────────────────────────────

/**
 * Check if Postiz is available and responding.
 * Postiz returns 307 redirect to /auth when healthy.
 */
export async function checkPostizHealth(): Promise<PostizBridgeStatus> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);

    const response = await fetch(`${POSTIZ_BASE_URL}${POSTIZ_HEALTH_PATH}`, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'manual', // Don't follow the 307 redirect
    });

    clearTimeout(timeout);

    // Postiz is healthy if it returns 307 (redirect to /auth) or 200
    if (response.status === 307 || response.status === 200) {
      return {
        available: true,
        message: `Postiz responding (HTTP ${response.status})`,
      };
    }

    return {
      available: false,
      message: `Postiz unexpected status: ${response.status}`,
    };
  } catch (err) {
    return {
      available: false,
      message: `Postiz unreachable: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ─── Postiz API Client ──────────────────────────────────────────────────────

/**
 * Make a request to the Postiz API with proper error handling and timeout.
 */
async function postizRequest<T>(
  method: string,
  path: string,
  body?: Record<string, unknown>,
  apiKey?: string,
): Promise<{ ok: boolean; data?: T; error?: string; status: number }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), POSTIZ_API_TIMEOUT);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // If we have a Postiz API key, use it for authentication
    if (apiKey) {
      headers['X-Postiz-API-Key'] = apiKey;
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(`${POSTIZ_BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    let data: T | undefined;
    try {
      data = (await response.json()) as T;
    } catch {
      // Response may be empty or HTML
    }

    if (!response.ok && response.status >= 400) {
      return {
        ok: false,
        status: response.status,
        error: (data as Record<string, unknown>)?.error as string
          ?? (data as Record<string, unknown>)?.message as string
          ?? `Postiz API error: ${response.status}`,
      };
    }

    return { ok: true, data, status: response.status };
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, status: 0, error: 'Postiz API timeout' };
    }
    return {
      ok: false,
      status: 0,
      error: `Postiz API error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ─── Get Postiz API Key from env ────────────────────────────────────────────

function getPostizApiKey(env: Env): string {
  return (env as Record<string, string>)['POSTIZ_API_KEY'] ?? '';
}

// ─── Schedule Operations ────────────────────────────────────────────────────

/**
 * Schedule a post via Postiz.
 *
 * Maps a DegenFeed MasterPost + protocol list to Postiz's schedule API.
 * Falls back to DegenFeed native scheduling if Postiz is unavailable.
 *
 * @param masterPost - The post content
 * @param protocols - Target protocols/platforms
 * @param scheduledAt - Optional ISO datetime for scheduled posting
 * @param env - Worker env with optional POSTIZ_API_KEY
 * @returns Postiz schedule ID or null (fallback to native)
 */
export async function createPostizSchedule(
  masterPost: MasterPost,
  protocols: string[],
  scheduledAt: string | null,
  env: Env,
): Promise<{ postizId?: string; nativeFallback: boolean }> {
  // Check Postiz health first
  const health = await checkPostizHealth();
  if (!health.available) {
    // Graceful fallback to native scheduler
    return { nativeFallback: true };
  }

  const apiKey = getPostizApiKey(env);

  // Map DegenFeed protocol names to Postiz platform IDs
  const platformMap: Record<string, string> = {
    mastodon: 'mastodon',
    twitter: 'twitter',
    bluesky: 'bluesky',
    linkedin: 'linkedin',
    nostr: 'nostr',
    farcaster: 'farcaster',
    lens: 'lens',
    telegram: 'telegram',
    discord: 'discord',
    reddit: 'reddit',
    threads: 'threads',
    pixelfed: 'mastodon', // ActivityPub-compatible
    lemmy: 'mastodon',    // ActivityPub-compatible
    peertube: 'mastodon', // ActivityPub-compatible
  };

  const postizPlatforms = protocols
    .map((p) => platformMap[p.toLowerCase()] ?? p)
    .filter(Boolean);

  if (postizPlatforms.length === 0) {
    return { nativeFallback: true };
  }

  const scheduleRequest: PostizScheduleRequest = {
    text: masterPost.text,
    title: masterPost.title,
    scheduledAt,
    platforms: [...new Set(postizPlatforms)], // Deduplicate
    mediaUrls: masterPost.media?.map((m) => m.url).filter(Boolean) as string[] | undefined,
    hashtags: masterPost.hashtags,
    linkUrl: masterPost.linkCard?.url,
    contentWarning: masterPost.contentWarning,
    isSensitive: masterPost.isSensitive,
  };

  const result = await postizRequest<PostizScheduleResponse>(
    'POST',
    '/api/schedules',
    scheduleRequest as unknown as Record<string, unknown>,
    apiKey,
  );

  if (result.ok && result.data?.id) {
    return { postizId: result.data.id, nativeFallback: false };
  }

  // Postiz accepted but returned unexpected data — fallback
  return { nativeFallback: true };
}

/**
 * Get a schedule's current status from Postiz.
 */
export async function getPostizSchedule(
  scheduleId: string,
  env: Env,
): Promise<PostizScheduleResponse | null> {
  const apiKey = getPostizApiKey(env);
  const result = await postizRequest<PostizScheduleResponse>(
    'GET',
    `/api/schedules/${encodeURIComponent(scheduleId)}`,
    undefined,
    apiKey,
  );

  if (result.ok && result.data) {
    return result.data;
  }

  return null;
}

/**
 * List all schedules from Postiz.
 * Optionally filter by status.
 */
export async function listPostizSchedules(
  env: Env,
  status?: string,
  limit = 50,
): Promise<PostizScheduleResponse[]> {
  const apiKey = getPostizApiKey(env);
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  params.set('limit', String(limit));

  const result = await postizRequest<{ schedules: PostizScheduleResponse[] }>(
    'GET',
    `/api/schedules?${params.toString()}`,
    undefined,
    apiKey,
  );

  if (result.ok && result.data?.schedules) {
    return result.data.schedules;
  }

  return [];
}

/**
 * Cancel/delete a scheduled post in Postiz.
 */
export async function cancelPostizSchedule(
  scheduleId: string,
  env: Env,
): Promise<boolean> {
  const apiKey = getPostizApiKey(env);
  const result = await postizRequest<{ ok: boolean }>(
    'DELETE',
    `/api/schedules/${encodeURIComponent(scheduleId)}`,
    undefined,
    apiKey,
  );

  return result.ok;
}

/**
 * Get analytics for a post published via Postiz.
 * Fetches per-platform engagement metrics from Postiz's analytics API.
 */
export async function getPostizAnalytics(
  postId: string,
  env: Env,
): Promise<PostizAnalyticsResponse | null> {
  const apiKey = getPostizApiKey(env);
  const result = await postizRequest<PostizAnalyticsResponse>(
    'GET',
    `/api/analytics/${encodeURIComponent(postId)}`,
    undefined,
    apiKey,
  );

  if (result.ok && result.data) {
    return result.data;
  }

  return null;
}

/**
 * Record Postiz analytics into DegenFeed's analytics KV store.
 * This merges Postiz engagement data into our own analytics pipeline.
 *
 * @see post-analytics.ts updatePostEngagement
 */
export async function syncPostizAnalyticsToDegenFeed(
  walletAddress: string,
  postId: string,
  protocols: string[],
  env: Env,
): Promise<void> {
  const postizAnalytics = await getPostizAnalytics(postId, env);
  if (!postizAnalytics) return;

  // Import and use the existing analytics update function
  try {
    const { updatePostEngagement } = await import('../routes/post-analytics');

    for (const protocol of protocols) {
      const platformData = postizAnalytics.platforms[protocol];
      if (!platformData) continue;

      await updatePostEngagement(env, walletAddress, postId, protocol, {
        likes: platformData.likes,
        reposts: platformData.reposts,
        replies: platformData.replies,
        quotes: platformData.quotes,
        bookmarks: 0,
      });
    }

    // Store the full Postiz analytics as a separate record
    if (env.CACHE) {
      await env.CACHE.put(
        `postiz:analytics:${postId}`,
        JSON.stringify(postizAnalytics),
        { expirationTtl: 86400 * 90 },
      );
    }
  } catch {
    // Analytics sync is best-effort
  }
}

// ─── Utility ────────────────────────────────────────────────────────────────

/**
 * Check if a tier should use Postiz for scheduling.
 *
 * @param tier - User's premium tier ('basic', 'pro', 'platinum', 'enterprise')
 * @returns true if Postiz should be used
 */
export function shouldUsePostiz(tier: string): boolean {
  return tier === 'pro' || tier === 'platinum' || tier === 'enterprise';
}

/**
 * Determine the scheduling engine for a given tier.
 */
export function getSchedulingEngine(tier: string): 'native' | 'postiz' {
  return shouldUsePostiz(tier) ? 'postiz' : 'native';
}
