/**
 * @degenfeed/api-worker — Pixelfed route handlers
 *
 * Provides:
 *   GET /api/feed/pixelfed       — Pixelfed-specific feed (images & galleries)
 *   GET /api/pixelfed/trending   — Trending Pixelfed posts (by engagement)
 *   GET /api/pixelfed/tags/:tag  — Posts by hashtag
 *
 * All endpoints use the PixelfedProvider to fetch from our self-hosted
 * instance first, then fall back to federated instances.
 */

import { PixelfedProvider } from '@degenfeed/feed-providers';
import type { Env } from '../index';
import { jsonResponse } from '../index';

// ─── Provider instance ──────────────────────────────────────────────

function getProvider(env: Env): PixelfedProvider {
  const instanceUrl = env.PIXELFED_INSTANCE_URL || 'http://127.0.0.1:8087';
  return new PixelfedProvider({ instanceUrl });
}

// ─── GET /api/feed/pixelfed ────────────────────────────────────────

/**
 * Pixelfed-specific feed — returns image posts with gallery information.
 *
 * Query params:
 *   limit (number) — max posts to return (default: 20, max: 50)
 *   cursor (string) — pagination cursor (not yet implemented — placeholder)
 */
export async function handlePixelfedFeed(request: Request, env: Env): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const limit = Math.min(Number(params.get('limit')) || 20, 50);
  const _cursor = params.get('cursor') ?? undefined;

  try {
    const provider = getProvider(env);
    const result = await provider.fetchFeed({ timeoutMs: 8000 });

    const posts = result.posts.slice(0, limit);

    return jsonResponse(
      {
        data: posts,
        meta: {
          total: posts.length,
          notice: result.notice ?? null,
          fetchedAt: Date.now(),
        },
      },
      200,
      {
        'cache-control': 'public, max-age=30, stale-while-revalidate=120',
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return jsonResponse({ error: message }, 500);
  }
}

// ─── GET /api/pixelfed/trending ────────────────────────────────────

/**
 * Trending Pixelfed posts — sorted by engagement (likes + reposts).
 *
 * Query params:
 *   limit (number) — max posts to return (default: 20, max: 50)
 */
export async function handlePixelfedTrending(request: Request, env: Env): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const limit = Math.min(Number(params.get('limit')) || 20, 50);

  try {
    const provider = getProvider(env);
    const result = await provider.fetchFeed({ timeoutMs: 8000 });

    // Sort by total engagement (likes + reposts * 2 + replies * 3)
    const sorted = [...result.posts].sort((a, b) => {
      const aScore = a.metrics.likes + a.metrics.reposts * 2 + a.metrics.replies * 3;
      const bScore = b.metrics.likes + b.metrics.reposts * 2 + b.metrics.replies * 3;
      return bScore - aScore;
    });

    const posts = sorted.slice(0, limit);

    return jsonResponse(
      {
        data: posts,
        meta: {
          total: posts.length,
          notice: result.notice ?? null,
          fetchedAt: Date.now(),
        },
      },
      200,
      {
        'cache-control': 'public, max-age=30, stale-while-revalidate=120',
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return jsonResponse({ error: message }, 500);
  }
}

// ─── GET /api/pixelfed/tags/:tag ────────────────────────────────────

/**
 * Pixelfed posts by hashtag — searches across our instance and
 * federated instances for content matching the given tag.
 *
 * URL params:
 *   tag — hashtag to search for (without # prefix)
 *
 * Query params:
 *   limit (number) — max posts to return (default: 20, max: 50)
 *   instance (string) — specific instance to search (optional)
 */
export async function handlePixelfedTag(
  request: Request,
  env: Env,
  tag: string,
): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const limit = Math.min(Number(params.get('limit')) || 20, 50);
  const instanceUrl =
    params.get('instance') || env.PIXELFED_INSTANCE_URL || 'http://127.0.0.1:8087';

  try {
    // Dynamic import to avoid pulling the SDK into all cold starts
    const { getTagTimeline, normalizePixelfedPost } = await import('@degenfeed/pixelfed-sdk');

    const statuses = await getTagTimeline(instanceUrl, tag, limit);
    const posts = (Array.isArray(statuses) ? statuses : []).map((s) =>
      normalizePixelfedPost(s, instanceUrl),
    );

    return jsonResponse(
      {
        data: posts,
        meta: {
          tag,
          total: posts.length,
          instance: instanceUrl,
          fetchedAt: Date.now(),
        },
      },
      200,
      {
        'cache-control': 'public, max-age=60, stale-while-revalidate=300',
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return jsonResponse({ error: message }, 500);
  }
}

// ─── GET /api/pixelfed/health ──────────────────────────────────────

/**
 * Health check for the Pixelfed provider.
 */
export async function handlePixelfedHealth(_request: Request, env: Env): Promise<Response> {
  try {
    const provider = getProvider(env);
    const health = await provider.healthCheck({ timeoutMs: 4000 });
    return jsonResponse({
      healthy: health.healthy,
      latencyMs: health.latencyMs,
      error: health.error ?? null,
      instance: env.PIXELFED_INSTANCE_URL || 'http://127.0.0.1:8087',
      checkedAt: Date.now(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return jsonResponse({ healthy: false, error: message }, 502);
  }
}
