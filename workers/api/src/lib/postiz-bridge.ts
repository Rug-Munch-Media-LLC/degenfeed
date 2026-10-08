/**
 * @degenfeed/api-worker — Postiz API Bridge
 *
 * Bridges DegenFeed's premium publishing system to Postiz (self-hosted
 * social media scheduler). Routes premium-tier schedules through Postiz
 * for unlimited cross-posting across all supported protocols.
 *
 * NOW WITH EXTERNAL PLATFORM SUPPORT:
 * YouTube, Twitch, Kick, TikTok, Instagram, LinkedIn.
 * Postiz handles OAuth, API complexity, and rate limiting for all external
 * platforms. DegenFeed provides the unified interface.
 *
 * Fallback: If Postiz is unreachable, gracefully falls back to DegenFeed's
 * native scheduler (executeCrossPublish in cross-publish-orchestrator.ts).
 *
 * Postiz runs at http://127.0.0.1:3105 (internal) /
 * https://schedule.degenfeed.xyz (external).
 *
 * @see /path/to/degenfeed/postiz/README.md
 * @see /path/to/degenfeed/postiz/platforms.json
 */

import type { MasterPost } from '@degenfeed/cross-protocol-bridge';
import type { Env } from '../types';

// ─── Constants ──────────────────────────────────────────────────────────────

/**
 * Postiz public API base URL.
 *
 * NOTE: Postiz self-hosted is served behind an nginx that routes `/api/`
 * to the backend, so the public API base must include the `/api` prefix:
 *   - internal: http://127.0.0.1:3105/api
 *   - external: https://schedule.degenfeed.xyz/api
 * All paths below are appended to this base (e.g. `${base}/public/v1/posts`).
 */
const POSTIZ_BASE_URL = 'http://127.0.0.1:3105/api';
const POSTIZ_API_TIMEOUT = 10_000; // 10s
const POSTIZ_HEALTH_PATH = '/public/v1/is-connected';

/** External platforms that DegenFeed Connect routes through Postiz */
export const EXTERNAL_PLATFORM_CATEGORIES = {
  youtube: {
    name: 'YouTube',
    icon: '▶️',
    capabilities: ['post_video', 'schedule', 'go_live', 'analytics', 'clip'],
    postiz_type: 'youtube',
    requires_oauth: true,
    description: 'Post videos, schedule uploads, go live, pull analytics',
  },
  twitch: {
    name: 'Twitch',
    icon: '📺',
    capabilities: ['go_live', 'clip', 'channel_manage', 'analytics'],
    postiz_type: 'twitch',
    requires_oauth: true,
    description: 'Go live notifications, clip sharing, channel management',
  },
  kick: {
    name: 'Kick',
    icon: '🔴',
    capabilities: ['go_live', 'clip'],
    postiz_type: 'kick',
    requires_oauth: true,
    description: 'Go live and share clips',
  },
  tiktok: {
    name: 'TikTok',
    icon: '🎵',
    capabilities: ['post_video', 'schedule', 'go_live', 'analytics'],
    postiz_type: 'tiktok',
    requires_oauth: true,
    description: 'Post videos, schedule, live streaming',
  },
  instagram: {
    name: 'Instagram',
    icon: '📸',
    capabilities: ['post_image', 'post_video', 'stories', 'schedule'],
    postiz_type: 'instagram',
    requires_oauth: true,
    description: 'Post images, videos, stories',
  },
  linkedin: {
    name: 'LinkedIn',
    icon: '💼',
    capabilities: ['post_article', 'post_update', 'analytics'],
    postiz_type: 'linkedin',
    requires_oauth: true,
    description: 'Post articles and updates',
  },
} as const;

export type ExternalPlatformId = keyof typeof EXTERNAL_PLATFORM_CATEGORIES;

/** All external platform IDs */
export const EXTERNAL_PLATFORM_IDS = Object.keys(
  EXTERNAL_PLATFORM_CATEGORIES,
) as ExternalPlatformId[];

/** Map of external platform IDs to Postiz integration types */
export const EXTERNAL_TO_POSTIZ_TYPE: Record<ExternalPlatformId, string> = {
  youtube: 'youtube',
  twitch: 'twitch',
  kick: 'kick',
  tiktok: 'tiktok',
  instagram: 'instagram',
  linkedin: 'linkedin',
};

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
  results?: Record<
    string,
    {
      success: boolean;
      nativeId?: string;
      url?: string;
      error?: string;
    }
  >;
  /** Error message if failed */
  error?: string;
  /** ISO creation timestamp */
  createdAt: string;
}

export interface PostizAnalyticsResponse {
  /** Post identifier in Postiz */
  postId: string;
  /** Per-platform engagement metrics */
  platforms: Record<
    string,
    {
      likes: number;
      reposts: number;
      replies: number;
      quotes: number;
      impressions?: number;
      reach?: number;
      engagement_rate?: number;
    }
  >;
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

// ─── External Platform Types ────────────────────────────────────────────────

export interface ExternalPlatformAccount {
  /** Unique ID for this connected account */
  id: string;
  /** Platform ID (youtube, twitch, kick, tiktok, instagram, linkedin) */
  platform: ExternalPlatformId;
  /** Display name on the platform */
  displayName: string;
  /** Avatar URL from the platform */
  avatarUrl?: string;
  /** Postiz integration ID for this account */
  postizIntegrationId: string;
  /** ISO timestamp of when the account was connected */
  connectedAt: string;
  /** ISO timestamp of last successful post */
  lastUsedAt?: string;
  /** Whether this account is currently active/authorized */
  active: boolean;
  /** Platform-specific metadata */
  metadata?: Record<string, string>;
}

export interface ExternalPostRequest {
  /** Text/caption content */
  text: string;
  /** Title (for YouTube, LinkedIn articles) */
  title?: string;
  /** Target external platform IDs */
  platforms: ExternalPlatformId[];
  /** Media URLs to attach */
  mediaUrls?: string[];
  /** Hashtags (without #) */
  hashtags?: string[];
  /** ISO datetime for scheduled posting. null or empty = immediate */
  scheduledAt?: string | null;
  /** Link card URL */
  linkUrl?: string;
  /** Content warning */
  contentWarning?: string;
  /** Is this sensitive content */
  isSensitive?: boolean;
}

export interface ExternalGoLiveRequest {
  /** Platform to go live on */
  platform: ExternalPlatformId;
  /** Stream title */
  title: string;
  /** Stream description */
  description?: string;
  /** Game/category (for Twitch, Kick) */
  category?: string;
  /** Tags */
  tags?: string[];
  /** Scheduled start time (ISO) for scheduled go-live */
  scheduledAt?: string | null;
  /** RTMP URL from Owncast or other encoder */
  streamUrl?: string;
  /** Stream key for the external platform */
  streamKey?: string;
}

export interface ExternalAnalyticsResponse {
  platform: ExternalPlatformId;
  period: {
    start: string;
    end: string;
  };
  followers: number;
  followersChange: number;
  views: number;
  viewsChange: number;
  engagements: number;
  engagementsChange: number;
  topPosts: Array<{
    id: string;
    title: string;
    url?: string;
    views: number;
    likes: number;
    comments: number;
    shares: number;
    publishedAt: string;
  }>;
}

export interface ExternalPlatformConnectUrl {
  /** The OAuth URL to redirect the user to for platform authorization */
  url: string;
  /** Platform being connected */
  platform: ExternalPlatformId;
  /** State token for CSRF protection */
  state: string;
}

// ─── Postiz Health Check ────────────────────────────────────────────────────

/**
 * Check if Postiz is available and responding.
 * Hits the public API's is-connected endpoint; healthy when it returns 200.
 */
export async function checkPostizHealth(): Promise<PostizBridgeStatus> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);

    const response = await fetch(`${POSTIZ_BASE_URL}${POSTIZ_HEALTH_PATH}`, {  // nosemgrep: typescript.react.security.react-insecure-request.react-insecure-request
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.ok) {
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
 * Make a request to the Postiz public API with proper error handling and timeout.
 * Base URL comes from env (POSTIZ_BASE_URL) or falls back to the local default.
 */
async function postizRequest<T>(
  method: string,
  path: string,
  body?: Record<string, unknown>,
  apiKey?: string,
  baseUrlOverride?: string,
): Promise<{ ok: boolean; data?: T; error?: string; status: number }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), POSTIZ_API_TIMEOUT);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Postiz public API authenticates with `Authorization: <api-key>`
    if (apiKey) {
      headers.Authorization = apiKey;
    }

    const base = baseUrlOverride || POSTIZ_BASE_URL;
    const response = await fetch(`${base}${path}`, {
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
        error:
          ((data as Record<string, unknown>)?.error as string) ??
          ((data as Record<string, unknown>)?.message as string) ??
          `Postiz API error: ${response.status}`,
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
  return (env as Record<string, string>).POSTIZ_API_KEY ?? '';
}

function getPostizBaseUrl(env: Env): string {
  return (env as Record<string, string>).POSTIZ_BASE_URL ?? POSTIZ_BASE_URL;
}

// ─── External Platform Operations ───────────────────────────────────────────

/**
 * Generate an OAuth connect URL for an external platform via Postiz.
 * Postiz handles the OAuth flow — we just redirect the user there.
 *
 * @param platform - The external platform to connect
 * @param userId - DegenFeed user identifier for state tracking
 * @param env - Worker env
 * @returns OAuth URL and state token
 */
export async function getExternalPlatformConnectUrl(
  platform: ExternalPlatformId,
  userId: string,
  env: Env,
): Promise<ExternalPlatformConnectUrl | { error: string }> {
  const category = EXTERNAL_PLATFORM_CATEGORIES[platform];
  if (!category) {
    return { error: `Unsupported platform: ${platform}` };
  }

  const baseUrl = getPostizBaseUrl(env);

  // Generate a state token for CSRF protection
  const stateToken = crypto.randomUUID();
  const statePayload = `${userId}:${platform}:${stateToken}`;

  // Store the state in KV for verification during callback
  try {
    if (env.CACHE) {
      await env.CACHE.put(
        `ext-platform:oauth:state:${stateToken}`,
        statePayload,
        { expirationTtl: 600 }, // 10 minutes
      );
    }
  } catch {
    // Non-critical — proceed without KV storage
  }

  // Postiz handles OAuth for the platform. We redirect to Postiz's
  // OAuth initiation endpoint with our state.
  // Self-hosted Postiz exposes this via /public/v1/social/{integration}.
  const oauthUrl = `${baseUrl}/public/v1/social/${category.postiz_type}`;

  return {
    url: `${oauthUrl}?state=${encodeURIComponent(statePayload)}&redirect=${encodeURIComponent('https://app.degenfeed.xyz/settings/external-platforms')}`,
    platform,
    state: stateToken,
  };
}

/**
 * Verify an OAuth callback from Postiz and store the connected account.
 * Called after the user completes OAuth in Postiz and is redirected back.
 *
 * @param platform - The platform that was connected
 * @param postizIntegrationId - Postiz integration ID for the connected account
 * @param userId - DegenFeed user ID
 * @param env - Worker env
 * @returns The saved account record
 */
export async function completeExternalPlatformConnection(
  platform: ExternalPlatformId,
  postizIntegrationId: string,
  userId: string,
  env: Env,
): Promise<ExternalPlatformAccount> {
  const category = EXTERNAL_PLATFORM_CATEGORIES[platform];
  const account: ExternalPlatformAccount = {
    id: `ext-${platform}-${userId}-${Date.now()}`,
    platform,
    displayName: '', // Will be filled from Postiz integration response
    postizIntegrationId,
    connectedAt: new Date().toISOString(),
    active: true,
  };

  // Try to fetch the integration details from Postiz to get the display name
  try {
    const apiKey = getPostizApiKey(env);
    const baseUrl = getPostizBaseUrl(env);
    const integrationRes = await fetch(
      `${baseUrl}/public/v1/integrations`,
      {
        headers: {
          Authorization: apiKey,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(5_000),
      },
    );
    if (integrationRes.ok) {
      const integrations = (await integrationRes.json()) as Array<{
        id?: string;
        name?: string;
        picture?: string;
        profile?: string;
        identifier?: string;
      }>;
      const match = integrations.find(
        (i) => i.id === postizIntegrationId || i.identifier === postizIntegrationId,
      );
      if (match) {
        account.displayName = match.name ?? match.profile ?? category.name;
        account.avatarUrl = match.picture;
        account.metadata = {
          identifier: match.identifier ?? category.postiz_type,
          profile: match.profile ?? '',
        };
      }
    }
  } catch {
    // Fall back to category name
    account.displayName = category.name;
  }

  // Store the connected account in KV
  try {
    if (env.PLATFORM_ACCOUNTS) {
      await env.PLATFORM_ACCOUNTS.put(
        `ext-platform:${userId}:${platform}`,
        JSON.stringify(account),
      );
      // Also store in the user's account list
      const existing = await env.PLATFORM_ACCOUNTS.get(`ext-platform:user:${userId}`);
      const accounts: ExternalPlatformAccount[] = existing
        ? (JSON.parse(existing) as ExternalPlatformAccount[])
        : [];
      const existingIdx = accounts.findIndex((a) => a.platform === platform);
      if (existingIdx >= 0) {
        accounts[existingIdx] = account;
      } else {
        accounts.push(account);
      }
      await env.PLATFORM_ACCOUNTS.put(`ext-platform:user:${userId}`, JSON.stringify(accounts));
    }
  } catch {
    // KV error — account is still returned
  }

  return account;
}

/**
 * Get all connected external platform accounts for a user.
 *
 * @param userId - DegenFeed user ID
 * @param env - Worker env
 * @returns Array of connected accounts
 */
export async function getConnectedExternalAccounts(
  userId: string,
  env: Env,
): Promise<ExternalPlatformAccount[]> {
  if (!env.PLATFORM_ACCOUNTS) return [];

  try {
    const raw = await env.PLATFORM_ACCOUNTS.get(`ext-platform:user:${userId}`);
    if (!raw) return [];
    return JSON.parse(raw) as ExternalPlatformAccount[];
  } catch {
    return [];
  }
}

/**
 * Remove a connected external platform account.
 *
 * @param userId - DegenFeed user ID
 * @param platform - Platform to disconnect
 * @param env - Worker env
 * @returns true if the account was found and removed
 */
export async function disconnectExternalPlatform(
  userId: string,
  platform: ExternalPlatformId,
  env: Env,
): Promise<boolean> {
  if (!env.PLATFORM_ACCOUNTS) return false;

  try {
    // Remove individual account record
    await env.PLATFORM_ACCOUNTS.delete(`ext-platform:${userId}:${platform}`);

    // Remove from user's account list
    const existing = await env.PLATFORM_ACCOUNTS.get(`ext-platform:user:${userId}`);
    if (existing) {
      const accounts: ExternalPlatformAccount[] = JSON.parse(existing) as ExternalPlatformAccount[];
      const filtered = accounts.filter((a) => a.platform !== platform);
      await env.PLATFORM_ACCOUNTS.put(`ext-platform:user:${userId}`, JSON.stringify(filtered));
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Post content to external platforms via Postiz.
 *
 * This uses the Postiz public API to publish immediately to the specified
 * platforms. Postiz handles API differences between platforms.
 *
 * @param request - Post request details
 * @param integrationIds - Map of platform -> Postiz integration ID
 * @param env - Worker env
 * @returns Per-platform results
 */
export async function postToExternalPlatforms(
  request: ExternalPostRequest,
  integrationIds: Record<string, string>,
  env: Env,
): Promise<Record<string, { success: boolean; url?: string; error?: string }>> {
  const baseUrl = getPostizBaseUrl(env);
  const apiKey = getPostizApiKey(env);
  const results: Record<string, { success: boolean; url?: string; error?: string }> = {};

  for (const platform of request.platforms) {
    const integrationId = integrationIds[platform];
    if (!integrationId) {
      results[platform] = {
        success: false,
        error: `No connected account for ${platform}. Connect it first.`,
      };
      continue;
    }

    const postizType = EXTERNAL_TO_POSTIZ_TYPE[platform] ?? platform;

    try {
      const postBody = {
        type: request.scheduledAt ? 'schedule' : 'now',
        date: request.scheduledAt ?? new Date().toISOString(),
        shortLink: false,
        tags: request.hashtags ?? [],
        posts: [
          {
            integration: { id: integrationId },
            value: [
              {
                content: request.text,
                title: request.title,
                image: (request.mediaUrls ?? []).map((url, i) => ({
                  id: String(i),
                  path: url,
                })),
              },
            ],
            settings: {
              __type: postizType,
            },
          },
        ],
      };

      const res = await fetch(`${baseUrl}/public/v1/posts`, {
        method: 'POST',
        headers: {
          Authorization: apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(postBody),
        signal: AbortSignal.timeout(30_000),
      });

      if (res.ok) {
        const data = (await res.json()) as { postId?: string; url?: string };
        results[platform] = {
          success: true,
          url: data.url,
        };
      } else {
        const errText = await res.text().catch(() => '');
        results[platform] = {
          success: false,
          error: `${platform}: Postiz error (${res.status}): ${errText.slice(0, 200)}`,
        };
      }
    } catch (err) {
      results[platform] = {
        success: false,
        error: `${platform}: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  return results;
}

/**
 * Schedule a post for later publication on external platforms.
 *
 * @param request - Post request details with scheduledAt
 * @param integrationIds - Map of platform -> Postiz integration ID
 * @param env - Worker env
 * @returns Schedule details
 */
export async function scheduleExternalPost(
  request: ExternalPostRequest,
  integrationIds: Record<string, string>,
  env: Env,
): Promise<{
  scheduleId?: string;
  results: Record<string, { success: boolean; error?: string }>;
}> {
  if (!request.scheduledAt) {
    // No schedule time given — publish immediately
    const results = await postToExternalPlatforms(request, integrationIds, env);
    return { results };
  }

  const baseUrl = getPostizBaseUrl(env);
  const apiKey = getPostizApiKey(env);
  const results: Record<string, { success: boolean; error?: string }> = {};

  // Use Postiz's schedule API
  for (const platform of request.platforms) {
    const integrationId = integrationIds[platform];
    if (!integrationId) {
      results[platform] = {
        success: false,
        error: `No connected account for ${platform}.`,
      };
      continue;
    }

    const postizType = EXTERNAL_TO_POSTIZ_TYPE[platform] ?? platform;

    try {
      const scheduleBody = {
        type: 'schedule',
        date: request.scheduledAt,
        shortLink: false,
        tags: request.hashtags ?? [],
        posts: [
          {
            integration: { id: integrationId },
            value: [
              {
                content: request.text,
                title: request.title,
                image: (request.mediaUrls ?? []).map((url, i) => ({
                  id: String(i),
                  path: url,
                })),
              },
            ],
            settings: { __type: postizType },
          },
        ],
      };

      const res = await fetch(`${baseUrl}/public/v1/posts`, {
        method: 'POST',
        headers: {
          Authorization: apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(scheduleBody),
        signal: AbortSignal.timeout(15_000),
      });

      if (res.ok) {
        await res.json();
        results[platform] = {
          success: true,
        };
      } else {
        const errText = await res.text().catch(() => '');
        results[platform] = {
          success: false,
          error: `${platform}: Postiz error (${res.status}): ${errText.slice(0, 200)}`,
        };
      }
    } catch (err) {
      results[platform] = {
        success: false,
        error: `${platform}: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  return {
    scheduleId: `ext-${Date.now()}`,
    results,
  };
}

/**
 * Send a go-live notification to an external platform.
 *
 * For Twitch/Kick: sets stream title/category and sends notification.
 * For YouTube: starts a live stream.
 * For TikTok: initiates live streaming.
 *
 * @param request - Go-live request details
 * @param integrationId - Postiz integration ID for the platform
 * @param env - Worker env
 * @returns Go-live result
 */
export async function goLiveOnExternalPlatform(
  request: ExternalGoLiveRequest,
  integrationId: string,
  env: Env,
): Promise<{
  success: boolean;
  streamUrl?: string;
  error?: string;
}> {
  const baseUrl = getPostizBaseUrl(env);
  const apiKey = getPostizApiKey(env);
  const postizType = EXTERNAL_TO_POSTIZ_TYPE[request.platform] ?? request.platform;

  try {
    const goLiveBody = {
      type: 'now',
      date: request.scheduledAt ?? new Date().toISOString(),
      shortLink: false,
      posts: [
        {
          integration: { id: integrationId },
          value: [
            {
              content: request.description ?? `🎥 Live now: ${request.title}`,
              title: request.title,
            },
          ],
          settings: {
            __type: postizType,
            stream: {
              title: request.title,
              description: request.description,
              category: request.category,
              tags: request.tags,
              streamUrl: request.streamUrl,
              streamKey: request.streamKey,
            },
          },
        },
      ],
    };

    const res = await fetch(`${baseUrl}/public/v1/posts`, {
      method: 'POST',
      headers: {
        Authorization: apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(goLiveBody),
      signal: AbortSignal.timeout(30_000),
    });

    if (res.ok) {
      const data = (await res.json()) as { postId?: string; url?: string };
      return {
        success: true,
        streamUrl: data.url,
      };
    }

    const errText = await res.text().catch(() => '');
    return {
      success: false,
      error: `Go-live failed (${res.status}): ${errText.slice(0, 200)}`,
    };
  } catch (err) {
    return {
      success: false,
      error: `Go-live error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Pull analytics from an external platform via Postiz.
 *
 * @param platform - The platform to pull analytics for
 * @param postizIntegrationId - Postiz integration ID
 * @param env - Worker env
 * @returns Analytics data
 */
export async function getExternalPlatformAnalytics(
  platform: ExternalPlatformId,
  postizIntegrationId: string,
  env: Env,
): Promise<ExternalAnalyticsResponse | { error: string }> {
  const baseUrl = getPostizBaseUrl(env);
  const apiKey = getPostizApiKey(env);

  try {
    const res = await fetch(
      `${baseUrl}/public/v1/analytics/${encodeURIComponent(postizIntegrationId)}?date=30`,
      {
        headers: {
          Authorization: apiKey,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10_000),
      },
    );

    if (res.ok) {
      const data = (await res.json()) as ExternalAnalyticsResponse;
      return {
        ...data,
        platform,
        period: data.period ?? {
          start: new Date(Date.now() - 30 * 86400 * 1000).toISOString(),
          end: new Date().toISOString(),
        },
      };
    }

    return {
      error: `Analytics fetch failed (${res.status})`,
    };
  } catch (err) {
    return {
      error: `Analytics error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ─── Schedule Operations ────────────────────────────────────────────────────

/**
 * Schedule a post via Postiz.
 *
 * Maps a DegenFeed MasterPost + protocol list to Postiz's schedule API
 * (`POST /public/v1/posts`). Falls back to DegenFeed native scheduling if
 * Postiz is unavailable.
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
  const baseUrl = getPostizBaseUrl(env);

  // Map DegenFeed protocol names to Postiz platform IDs
  // Includes external platforms so premium users can cross-post to them
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
    lemmy: 'mastodon', // ActivityPub-compatible
    peertube: 'mastodon', // ActivityPub-compatible
    // External platforms
    youtube: 'youtube',
    twitch: 'twitch',
    kick: 'kick',
    tiktok: 'tiktok',
    instagram: 'instagram',
  };

  const postizPlatforms = protocols.map((p) => platformMap[p.toLowerCase()] ?? p).filter(Boolean);

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

  // Resolve integration IDs from POSTIZ_INTEGRATIONS env map. The Postiz
  // public API requires a concrete integration id per post entry.
  const integrations = parsePostizIntegrations(env);

  // Only schedule to platforms we have a connected integration for.
  const usablePlatforms = scheduleRequest.platforms.filter(
    (p) => integrations[p] ?? integrations[p.toLowerCase()],
  );
  if (usablePlatforms.length === 0) {
    // No connected Postiz integrations — fall back to native scheduler
    return { nativeFallback: true };
  }

  const posts = usablePlatforms.map((platform) => {
    const integrationId = integrations[platform] ?? integrations[platform.toLowerCase()];
    const postizType = EXTERNAL_TO_POSTIZ_TYPE[platform as ExternalPlatformId] ?? platform;
    const values: Array<Record<string, unknown>> = [
      {
        content: scheduleRequest.text,
        ...(scheduleRequest.title ? { title: scheduleRequest.title } : {}),
        image: (scheduleRequest.mediaUrls ?? []).map((url, i) => ({ id: String(i), path: url })),
      },
    ];

    return {
      integration: { id: integrationId },
      value: values,
      settings: { __type: postizType },
    };
  });

  const result = await postizRequest<Array<{ postId?: string; integration?: string }>>(
    'POST',
    '/public/v1/posts',
    {
      type: scheduleRequest.scheduledAt ? 'schedule' : 'now',
      date: scheduleRequest.scheduledAt ?? new Date().toISOString(),
      shortLink: false,
      tags: (scheduleRequest.hashtags ?? []).map((tag) => ({
        value: tag.toLowerCase(),
        label: tag,
      })),
      posts,
    },
    apiKey,
    baseUrl,
  );

  if (result.ok && result.data && result.data.length > 0) {
    const first = result.data[0];
    if (first?.postId) {
      return { postizId: first.postId, nativeFallback: false };
    }
  }

  // Postiz accepted but returned unexpected data — fallback
  return { nativeFallback: true };
}

/**
 * Parse the POSTIZ_INTEGRATIONS env var (JSON map of platform → integration id).
 * Returns an empty object when unset/malformed.
 */
function parsePostizIntegrations(env: Env): Record<string, string> {
  try {
    const raw = (env as Record<string, string>).POSTIZ_INTEGRATIONS;
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Get a schedule's current status from Postiz.
 */
export async function getPostizSchedule(
  scheduleId: string,
  env: Env,
): Promise<PostizScheduleResponse | null> {
  const apiKey = getPostizApiKey(env);
  const baseUrl = getPostizBaseUrl(env);
  const result = await postizRequest<PostizScheduleResponse>(
    'GET',
    `/public/v1/posts/${encodeURIComponent(scheduleId)}/status`,
    undefined,
    apiKey,
    baseUrl,
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
  const baseUrl = getPostizBaseUrl(env);

  // Postiz list API requires a date range (UTC ISO). We request a wide
  // window (last 30 days → next 90 days) and filter by status/date locally.
  const start = new Date(Date.now() - 30 * 86400 * 1000).toISOString();
  const end = new Date(Date.now() + 90 * 86400 * 1000).toISOString();
  const params = new URLSearchParams({ startDate: start, endDate: end });

  const result = await postizRequest<{ posts?: Array<Record<string, unknown>> }>(
    'GET',
    `/public/v1/posts?${params.toString()}`,
    undefined,
    apiKey,
    baseUrl,
  );

  if (!result.ok || !result.data?.posts) {
    return [];
  }

  const now = Date.now();
  let schedules: PostizScheduleResponse[] = [];

  for (const raw of result.data.posts) {
    const p = raw as {
      id?: string;
      content?: string;
      publishDate?: string;
      releaseURL?: string;
      state?: string;
      integration?: { id?: string; providerIdentifier?: string; name?: string };
    };
    const publishTs = p.publishDate ? new Date(p.publishDate).getTime() : 0;
    const rawState = (p.state ?? 'QUEUE').toLowerCase();
    const mappedStatus: PostizScheduleResponse['status'] =
      rawState === 'published' ? 'published' : rawState === 'error' ? 'failed' : rawState === 'draft' ? 'draft' : 'scheduled';

    // Status filter: 'scheduled' → future QUEUE posts; 'published' → PUBLISHED
    if (status === 'scheduled' && (rawState !== 'queue' || publishTs < now)) continue;
    if (status === 'published' && rawState !== 'published') continue;

    schedules.push({
      id: p.id ?? '',
      status: mappedStatus,
      scheduledAt: p.publishDate ?? null,
      publishedAt: rawState === 'published' ? p.publishDate ?? null : null,
      platforms: [p.integration?.providerIdentifier ?? p.integration?.name ?? 'postiz'],
      createdAt: p.publishDate ?? new Date().toISOString(),
    });
  }

  // Sort by scheduled time ascending
  schedules.sort((a, b) => {
    const ta = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
    const tb = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
    return ta - tb;
  });

  return schedules.slice(0, limit);
}

/**
 * Cancel/delete a scheduled post in Postiz.
 */
export async function cancelPostizSchedule(scheduleId: string, env: Env): Promise<boolean> {
  const apiKey = getPostizApiKey(env);
  const baseUrl = getPostizBaseUrl(env);
  const result = await postizRequest<{ id?: string }>(
    'DELETE',
    `/public/v1/posts/${encodeURIComponent(scheduleId)}`,
    undefined,
    apiKey,
    baseUrl,
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
  const baseUrl = getPostizBaseUrl(env);
  const result = await postizRequest<
    Array<{
      label?: string;
      data?: Array<{ total?: string; date?: string }>;
      percentageChange?: number;
    }>
  >(
    'GET',
    `/public/v1/analytics/post/${encodeURIComponent(postId)}?date=30`,
    undefined,
    apiKey,
    baseUrl,
  );

  if (!result.ok || !result.data) {
    return null;
  }

  // Normalize Postiz analytics rows into our aggregate shape.
  const totals: Record<string, number> = {};
  const platforms: PostizAnalyticsResponse['platforms'] = {};
  let totalLikes = 0;
  let totalReposts = 0;
  let totalReplies = 0;
  let totalQuotes = 0;
  let totalImpressions = 0;

  for (const row of result.data) {
    const label = (row.label ?? '').toLowerCase();
    const sum = (row.data ?? []).reduce(
      (acc, d) => acc + (Number.parseInt(d.total ?? '0', 10) || 0),
      0,
    );
    totals[label] = sum;

    if (label === 'likes') totalLikes = sum;
    if (label === 'reposts' || label === 'shares' || label === 'retweets') totalReposts = sum;
    if (label === 'comments' || label === 'replies') totalReplies = sum;
    if (label === 'quotes') totalQuotes = sum;
    if (label === 'impressions') totalImpressions = sum;
  }

  platforms.all = {
    likes: totalLikes,
    reposts: totalReposts,
    replies: totalReplies,
    quotes: totalQuotes,
    impressions: totalImpressions,
    engagement_rate: totalImpressions > 0 ? (totalLikes + totalReposts + totalReplies) / totalImpressions : 0,
  };

  const engagementScore = totalImpressions > 0
    ? Math.min(100, Math.round(((totalLikes + totalReposts + totalReplies * 2) / totalImpressions) * 1000))
    : 0;

  return {
    postId,
    platforms,
    total: {
      likes: totalLikes,
      reposts: totalReposts,
      replies: totalReplies,
      quotes: totalQuotes,
      impressions: totalImpressions,
    },
    engagementScore,
    bestPlatform: totalImpressions > 0 ? 'all' : null,
  };
}

/**
 * List connected Postiz integrations (channels).
 *
 * Returns the raw integration records from `GET /public/v1/integrations`.
 * Used by the Postiz dashboard routes to show available platforms and
 * validate scheduling targets.
 */
export interface PostizIntegration {
  id: string;
  name: string;
  identifier: string;
  picture?: string;
  disabled?: boolean;
  profile?: string;
  customer?: { id?: string; name?: string };
}

export async function listPostizIntegrations(env: Env): Promise<PostizIntegration[]> {
  const apiKey = getPostizApiKey(env);
  const baseUrl = getPostizBaseUrl(env);

  const result = await postizRequest<PostizIntegration[]>(
    'GET',
    '/public/v1/integrations',
    undefined,
    apiKey,
    baseUrl,
  );

  if (result.ok && Array.isArray(result.data)) {
    return result.data;
  }

  return [];
}

/**
 * Get account-level analytics for a connected Postiz integration.
 * Fetches follower/impression trends from `/public/v1/analytics/{integration}`.
 */
export interface PostizAccountAnalyticsRow {
  label: string;
  data: Array<{ total: string; date: string }>;
  percentageChange?: number;
}

export async function getPostizAccountAnalytics(
  integrationId: string,
  env: Env,
  days = 30,
): Promise<PostizAccountAnalyticsRow[]> {
  const apiKey = getPostizApiKey(env);
  const baseUrl = getPostizBaseUrl(env);

  const result = await postizRequest<
    Array<{ label?: string; data?: Array<{ total?: string; date?: string }>; percentageChange?: number }>
  >(
    'GET',
    `/public/v1/analytics/${encodeURIComponent(integrationId)}?date=${days}`,
    undefined,
    apiKey,
    baseUrl,
  );

  if (result.ok && Array.isArray(result.data)) {
    return result.data.map((row) => ({
      label: row.label ?? 'metric',
      data: (row.data ?? []).map((d) => ({ total: d.total ?? '0', date: d.date ?? '' })),
      percentageChange: row.percentageChange,
    }));
  }

  return [];
}

/**
 * Schedule a cross-platform post via the Postiz public API.
 *
 * This is the route-level scheduler used by POST /api/postiz/schedule.
 * Each target platform is resolved to a connected Postiz integration id,
 * then one post group is created with type='schedule' (or 'now' when no
 * scheduledAt is given).
 *
 * @returns per-platform results + the Postiz post ids
 */
export async function scheduleCrossPlatformPost(
  request: {
    text: string;
    title?: string;
    platforms: string[];
    scheduledAt?: string | null;
    mediaUrls?: string[];
    hashtags?: string[];
  },
  env: Env,
): Promise<{
  ok: boolean;
  postIds?: string[];
  results: Record<string, { success: boolean; postId?: string; error?: string }>;
  error?: string;
}> {
  const baseUrl = getPostizBaseUrl(env);
  const apiKey = getPostizApiKey(env);

  const integrations = await listPostizIntegrations(env);
  const integrationByIdentifier = new Map<string, PostizIntegration>();
  for (const integration of integrations) {
    integrationByIdentifier.set(integration.identifier.toLowerCase(), integration);
    integrationByIdentifier.set(integration.id.toLowerCase(), integration);
  }

  // Resolve each requested platform to a Postiz integration.
  const resolved: Array<{ platform: string; integration: PostizIntegration; postizType: string }> = [];
  for (const platform of request.platforms) {
    const key = platform.toLowerCase();
    const integration = integrationByIdentifier.get(key);
    if (!integration) {
      continue;
    }
    const postizType =
      EXTERNAL_TO_POSTIZ_TYPE[platform as ExternalPlatformId] ?? platform.toLowerCase();
    resolved.push({ platform, integration, postizType });
  }

  if (resolved.length === 0) {
    return {
      ok: false,
      results: {},
      error:
        'No connected Postiz integrations match the requested platforms. Connect channels at https://schedule.degenfeed.xyz first.',
    };
  }

  const posts = resolved.map(({ integration, postizType }) => ({
    integration: { id: integration.id },
    value: [
      {
        content: request.text,
        ...(request.title ? { title: request.title } : {}),
        image: (request.mediaUrls ?? []).map((url, i) => ({ id: String(i), path: url })),
      },
    ],
    settings: { __type: postizType },
  }));

  const result = await postizRequest<Array<{ postId?: string; integration?: string }>>(
    'POST',
    '/public/v1/posts',
    {
      type: request.scheduledAt ? 'schedule' : 'now',
      date: request.scheduledAt ?? new Date().toISOString(),
      shortLink: false,
      tags: (request.hashtags ?? []).map((tag) => ({ value: tag.toLowerCase(), label: tag })),
      posts,
    },
    apiKey,
    baseUrl,
  );

  if (!result.ok) {
    return { ok: false, results: {}, error: result.error ?? 'Postiz scheduling failed' };
  }

  const results: Record<string, { success: boolean; postId?: string; error?: string }> = {};
  const postIds: string[] = [];

  for (let i = 0; i < resolved.length; i++) {
    const platform = resolved[i]?.platform ?? `platform-${i}`;
    const created = result.data?.[i];
    if (created?.postId) {
      results[platform] = { success: true, postId: created.postId };
      postIds.push(created.postId);
    } else {
      results[platform] = { success: false, error: 'Postiz did not return a post id' };
    }
  }

  return { ok: postIds.length > 0, postIds, results };
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
      await env.CACHE.put(`postiz:analytics:${postId}`, JSON.stringify(postizAnalytics), {
        expirationTtl: 86400 * 90,
      });
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
 * Determine whether a tier has access to external platforms (YouTube, Twitch, etc.).
 * External platforms are Enterprise tier ($20/mo) or available as a standalone add-on ($15/mo).
 *
 * @param tier - User's premium tier
 * @returns true if external platforms are accessible
 */
export function hasExternalPlatformAccess(tier: string): boolean {
  return tier === 'enterprise';
}

/**
 * Determine the scheduling engine for a given tier.
 */
export function getSchedulingEngine(tier: string): 'native' | 'postiz' {
  return shouldUsePostiz(tier) ? 'postiz' : 'native';
}
