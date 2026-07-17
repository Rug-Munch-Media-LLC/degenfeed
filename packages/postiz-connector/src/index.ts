/**
 * @degenfeed/postiz-connector
 *
 * Postiz API client for cross-protocol posting.
 *
 * Postiz is an open-source social media scheduler
 * (https://github.com/gitroomhq/postiz-app) that supports 32+ platforms
 * including Mastodon, Bluesky, Threads, Nostr, LinkedIn, Reddit, etc.
 *
 * Architecture:
 *   Client (FeedComposer/ComposeModal)
 *     → POST /api/publish (Cloudflare Worker)
 *       → @degenfeed/postiz-connector.crossPost()
 *         → Postiz API (self-hosted or cloud)
 *       → Fallback: existing per-protocol logic
 *
 * Postiz requires each platform "integration" (channel) to be connected
 * via OAuth in the Postiz UI. Integration IDs are stored per-org and
 * passed to this connector at init time.
 *
 * Self-hosted base: http://postiz:3000
 * Cloud base:       https://api.postiz.com
 */

import type { Protocol } from '@degenfeed/types';

// ─── Types ────────────────────────────────────────────────────────────

/** A post to be sent to one or more platforms via Postiz. */
export interface PostizPost {
  /** Plain-text body of the post. */
  content: string;
  /** Target platforms to publish to. */
  platforms: PostizPlatform[];
  /** Optional media attachments. */
  media?: PostizMedia[];
  /** ISO 8601 date for scheduled publishing. Omit for immediate. */
  scheduledAt?: string;
  /** Parent post URL for replies / thread context. */
  replyTo?: string;
}

export type PostizPlatform =
  | 'mastodon'
  | 'bluesky'
  | 'threads'
  | 'reddit'
  | 'linkedin'
  | 'nostr'
  | 'farcaster'
  | 'lens'
  | 'telegram'
  | 'discord'
  | 'medium';

export interface PostizMedia {
  url: string;
  type: 'image' | 'video';
}

/** Per-platform result returned by crossPost(). */
export interface PostizPlatformResult {
  success: boolean;
  /** URL of the published post on the target platform (if available). */
  url?: string;
  /** Postiz post ID (for status tracking). */
  postizPostId?: string;
  /** Error message if failed. */
  error?: string;
}

/** Configuration for the Postiz connector. */
export interface PostizConnectorConfig {
  /** Postiz API base URL. */
  baseUrl: string;
  /** Postiz API key (from Settings > Developers > Public API). */
  apiKey: string;
  /**
   * Map of platform → Postiz integration ID.
   * Integration IDs are created when a user connects a social account
   * via OAuth in the Postiz UI. They can be discovered via
   * GET /public/v1/integrations.
   */
  integrationIds: Partial<Record<PostizPlatform, string>>;
  /** Optional timeout in ms for Postiz API calls. */
  timeoutMs?: number;
}

// ─── Postiz API types (internal) ──────────────────────────────────────

interface PostizCreatePostRequest {
  type: 'now' | 'schedule' | 'draft';
  date: string; // ISO 8601
  shortLink: boolean;
  tags: string[];
  posts: Array<{
    integration: { id: string };
    value: Array<{
      content: string;
      image: Array<{ id: string; path: string }>;
    }>;
    settings: Record<string, unknown> & { __type: string };
  }>;
}

interface PostizCreatePostResponse {
  postId: string;
  integration: string;
}

// ─── Provider type mapping ────────────────────────────────────────────

/**
 * Map our platform IDs to Postiz provider __type values.
 * Most use the same name; a few differ.
 */
const PLATFORM_TO_POSTIZ_TYPE: Record<PostizPlatform, string> = {
  mastodon: 'mastodon',
  bluesky: 'bluesky',
  threads: 'threads',
  reddit: 'reddit',
  linkedin: 'linkedin',
  nostr: 'nostr',
  farcaster: 'warpcast',
  lens: 'lens',
  telegram: 'telegram',
  discord: 'discord',
  medium: 'medium',
};

// ─── Fallback posting interface ───────────────────────────────────────

/**
 * Fallback posting function signature.
 * Called when Postiz is unavailable or a platform isn't configured.
 */
export type FallbackPostFn = (
  platform: PostizPlatform,
  content: string,
  media?: PostizMedia[],
  replyTo?: string,
) => Promise<{ success: boolean; url?: string; error?: string }>;

// ─── Core connector ───────────────────────────────────────────────────

export class PostizConnector {
  private config: PostizConnectorConfig;
  private fallbackFn: FallbackPostFn | null;

  constructor(config: PostizConnectorConfig, fallbackFn?: FallbackPostFn) {
    this.config = { timeoutMs: 10_000, ...config };
    this.fallbackFn = fallbackFn ?? null;
  }

  /** Set or update the fallback posting function. */
  setFallback(fn: FallbackPostFn): void {
    this.fallbackFn = fn;
  }

  /**
   * Health-check the Postiz server.
   * Returns true if the API responds (any valid response means it's alive).
   */
  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${this.config.baseUrl}/public/v1/posts`, {
        method: 'GET',
        headers: {
          Authorization: this.config.apiKey,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(this.config.timeoutMs ?? 10_000),
      });
      // 401 means "API key invalid" but the server is up.
      // 2xx means healthy with valid key.
      return res.status < 500;
    } catch {
      return false;
    }
  }

  /**
   * Cross-post content to multiple platforms via Postiz.
   *
   * For each target platform:
   *   1. If Postiz has a configured integration ID → send via Postiz API
   *   2. If not, and a fallback function is available → use fallback
   *   3. Otherwise → mark as failed with "no integration configured"
   *
   * Returns a map of platform → result.
   */
  async crossPost(post: PostizPost): Promise<Record<string, PostizPlatformResult>> {
    const results: Record<string, PostizPlatformResult> = {};

    for (const platform of post.platforms) {
      const integrationId = this.config.integrationIds[platform];

      if (integrationId) {
        // ── Postiz path ──────────────────────────────────────────────
        try {
          const result = await this.postToPostiz(platform, integrationId, post);
          results[platform] = result;
        } catch (err) {
          results[platform] = {
            success: false,
            error: `Postiz error: ${err instanceof Error ? err.message : String(err)}`,
          };
        }
      } else if (this.fallbackFn) {
        // ── Fallback path ────────────────────────────────────────────
        try {
          const result = await this.fallbackFn(platform, post.content, post.media, post.replyTo);
          results[platform] = result;
        } catch (err) {
          results[platform] = {
            success: false,
            error: `Fallback error: ${err instanceof Error ? err.message : String(err)}`,
          };
        }
      } else {
        results[platform] = {
          success: false,
          error: `No Postiz integration configured for ${platform} and no fallback available`,
        };
      }
    }

    return results;
  }

  /**
   * List configured integrations from Postiz.
   * Useful for discovering available channels and their IDs.
   */
  async listIntegrations(): Promise<
    Array<{ id: string; name: string; providerIdentifier: string; picture?: string }>
  > {
    const res = await fetch(`${this.config.baseUrl}/public/v1/integrations`, {
      method: 'GET',
      headers: {
        Authorization: this.config.apiKey,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(this.config.timeoutMs ?? 10_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Postiz list integrations failed: ${res.status} ${text.slice(0, 200)}`);
    }

    const data = (await res.json()) as {
      integrations: Array<{ id: string; name: string; providerIdentifier: string; picture?: string }>;
    };
    return data.integrations ?? [];
  }

  // ─── Private helpers ────────────────────────────────────────────────

  private async postToPostiz(
    platform: PostizPlatform,
    integrationId: string,
    post: PostizPost,
  ): Promise<PostizPlatformResult> {
    const postizType = PLATFORM_TO_POSTIZ_TYPE[platform] ?? platform;

    // Build the request payload matching Postiz API shape
    const body: PostizCreatePostRequest = {
      type: post.scheduledAt ? 'schedule' : 'now',
      date: post.scheduledAt ?? new Date().toISOString(),
      shortLink: false,
      tags: [],
      posts: [
        {
          integration: { id: integrationId },
          value: [
            {
              content: post.content,
              image: (post.media ?? []).map((m, i) => ({
                id: `media-${i}`,
                path: m.url,
              })),
            },
          ],
          settings: { __type: postizType },
        },
      ],
    };

    const res = await fetch(`${this.config.baseUrl}/public/v1/posts`, {
      method: 'POST',
      headers: {
        Authorization: this.config.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.config.timeoutMs ?? 10_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      // 422 is common for validation errors — include the detail
      const errorMsg = text.slice(0, 300);
      return {
        success: false,
        error: `Postiz API ${res.status}: ${errorMsg}`,
      };
    }

    const data = (await res.json()) as PostizCreatePostResponse;

    return {
      success: true,
      postizPostId: data.postId,
      // Postiz doesn't return platform URLs directly — the user can
      // find them in the Postiz UI under the post's releaseURL.
    };
  }
}

// ─── Convenience factory ──────────────────────────────────────────────

/**
 * Create a PostizConnector from environment configuration.
 *
 * Expects:
 *   POSTIZ_BASE_URL    — e.g. "http://postiz:3000" or "https://api.postiz.com"
 *   POSTIZ_API_KEY     — API key from Postiz Settings > Developers > Public API
 *   POSTIZ_INTEGRATIONS — JSON-encoded map of platform → integration ID
 *
 * Returns null if POSTIZ_BASE_URL or POSTIZ_API_KEY is missing
 * (caller should fall back to per-protocol logic).
 */
export function createConnectorFromEnv(
  env: Record<string, string | undefined>,
  fallbackFn?: FallbackPostFn,
): PostizConnector | null {
  const baseUrl = env.POSTIZ_BASE_URL;
  const apiKey = env.POSTIZ_API_KEY;

  if (!baseUrl || !apiKey) {
    return null;
  }

  let integrationIds: Partial<Record<PostizPlatform, string>> = {};
  try {
    const raw = env.POSTIZ_INTEGRATIONS;
    if (raw) {
      integrationIds = JSON.parse(raw) as Partial<Record<PostizPlatform, string>>;
    }
  } catch {
    // Malformed JSON — start with empty map
  }

  return new PostizConnector({ baseUrl, apiKey, integrationIds }, fallbackFn ?? undefined);
}
