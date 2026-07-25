/**
 * @degenfeed/api-worker — Cross-Platform Post Composer (Buffer-Style)
 *
 * Premium feature: one-composer, publish-to-all-protocols.
 * Accepts a single post with text + media + selected protocols.
 * Optionally schedules for later. Supports all 27+ protocols.
 *
 * Integration with the existing premium-publish queue infrastructure.
 *
 * @see ./queue.ts — queue management (schedule, list, update, delete)
 * @see ./optimize.ts — AI time optimization, evergreen, recurring
 * @see ./analytics.ts — per-post cross-protocol analytics
 */

import type { Env } from '../../index';
import { jsonResponse } from '../../index';
import {
  type AutoFormatOptions,
  autoFormatForProtocols,
  getBestPostingTime,
} from '../../lib/auto-formatter';
import { incrementPremiumUsage, requireProtocolLimit, requireQuota } from '../../lib/premium-gate';
import { methodNotAllowed } from '../../response-helpers';
import { sanitizeString, sanitizeStringArray } from '../../sanitize';
import { requireSession } from '../../session';
import type { QueueEntry, QueueStatus } from './types';
import { PREFIX_QUEUE } from './types';
import { getNextDateForDayAndHour } from './utils';

// ─── Supported Protocols ──────────────────────────────────────────────────

export const ALL_PROTOCOLS = [
  'mastodon',
  'bluesky',
  'nostr',
  'farcaster',
  'lens',
  'threads',
  'reddit',
  'telegram',
  'discord',
  'lemmy',
  'peertube',
  'pixelfed',
  'twitter',
  'linkedin',
  'medium',
  'substack',
  'youtube',
  'tiktok',
  'instagram',
  'pinterest',
  'twitch',
  'kick',
  'mirror',
  'paragraph',
  'zora',
  'matrix',
  'xmpp',
] as const;

export type ProtocolId = (typeof ALL_PROTOCOLS)[number];

// ─── Composer Types ───────────────────────────────────────────────────────

export interface ComposerPost {
  /** Post text/content */
  text: string;
  /** Optional title (for long-form platforms: Medium, Substack, YouTube) */
  title?: string;
  /** Optional media URLs */
  media?: Array<{ url: string; alt?: string; type?: 'image' | 'video' | 'audio' }>;
  /** Selected target protocols (minimum 1, maximum tier-dependent) */
  protocols: ProtocolId[];
  /** Optional ISO datetime for scheduled posting */
  scheduledAt?: string | null;
  /** Enable AI-optimized scheduling */
  aiOptimize?: boolean;
  /** Auto-split long posts into threads */
  autoThread?: boolean;
  /** Content warning / NSFW flag */
  contentWarning?: string;
  /** Mark as sensitive content */
  isSensitive?: boolean;
  /** Link card URL */
  linkCard?: { url: string; title?: string; description?: string; image?: string };
  /** Hashtags (without # prefix) */
  hashtags?: string[];
  /** Protocol-specific mentions */
  mentions?: Array<{ protocol: string; handle: string }>;
  /** Post language */
  lang?: string;
  /** Recurrence pattern (for recurring posts) */
  recurrence?: 'once' | 'daily' | 'weekly' | 'monthly' | 'weekdays';
  /** Mark as evergreen (auto-repost) */
  isEvergreen?: boolean;
  /** Evergreen repost frequency */
  evergreenFrequency?: 'every-7d' | 'every-14d' | 'every-30d' | 'every-90d';
}

export interface ComposerResult {
  ok: boolean;
  /** Generated queue entry ID */
  entryId?: string;
  /** Publish results per protocol (immediate publish only) */
  results?: Record<string, { success: boolean; nativeId?: string; error?: string }>;
  /** When the post is scheduled for */
  scheduledAt?: string | null;
  /** Engine used: native or postiz */
  engine?: 'native' | 'postiz';
  /** Status of the entry */
  status?: QueueStatus;
  /** Error message if failed */
  error?: string;
}

// ─── Composer Handler ─────────────────────────────────────────────────────

/**
 * POST /api/premium/composer
 *
 * The single endpoint for composing and publishing cross-platform posts.
 * - Immediate publish: publish now to all selected protocols
 * - Scheduled publish: store in KV queue, cron publishes later
 * - AI-optimized: auto-picks best time per protocol
 * - Premium-gated: free tier limited to 3 protocols + 10 scheduled
 *
 * Body: ComposerPost
 * Response: ComposerResult
 */
export async function handleComposerPost(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  try {
    const session = await requireSession(request, env);
    if (session instanceof Response) return session;

    const address = session.address.toLowerCase();

    // Basic tier is always allowed — premium gates are per-feature below (protocols, quota)
    // Premium+ features (AI optimize, analytics, unlimited protocols) are gated when used

    const body = (await request.json()) as ComposerPost;

    // ── Validate Input ──────────────────────────────────────────────────
    if (!body.text || body.text.length > 10000) {
      return jsonResponse({ error: 'Invalid or too long post text (max 10000 chars)' }, 400);
    }

    const protocols = sanitizeStringArray(body.protocols as string[], ALL_PROTOCOLS.length);
    if (protocols.length === 0) {
      return jsonResponse({ error: 'At least one protocol required' }, 400);
    }

    // Validate protocols are supported
    const invalidProtocols = protocols.filter((p) => !ALL_PROTOCOLS.includes(p as ProtocolId));
    if (invalidProtocols.length > 0) {
      return jsonResponse(
        {
          error: `Unsupported protocols: ${invalidProtocols.join(', ')}`,
          supported: ALL_PROTOCOLS,
        },
        400,
      );
    }

    // ── Premium Gating ──────────────────────────────────────────────────
    // Free: max 3 protocols, 10 scheduled
    // Premium (pro): all protocols, unlimited
    const protocolGate = await requireProtocolLimit(address, protocols, env);
    if (protocolGate) return protocolGate;

    // Check scheduled post quota if this is a scheduled post
    const isScheduled = !!body.scheduledAt || body.aiOptimize;
    const isImmediate = !isScheduled;

    if (isScheduled) {
      const quotaCheck = await requireQuota(address, env, 'queuedPosts', 1);
      if (quotaCheck) return quotaCheck;
    }

    // ── Parse Schedule Time ────────────────────────────────────────────
    let scheduledAt: string | null = null;

    if (body.scheduledAt) {
      const parsed = new Date(body.scheduledAt);
      if (Number.isNaN(parsed.getTime())) {
        return jsonResponse({ error: 'Invalid scheduledAt date. Use ISO 8601 format.' }, 400);
      }
      // Don't allow scheduling in the past
      if (parsed.getTime() <= Date.now()) {
        return jsonResponse({ error: 'scheduledAt must be in the future' }, 400);
      }
      scheduledAt = parsed.toISOString();
    }

    // ── AI-Optimized Scheduling ────────────────────────────────────────
    let aiOptimizedTime: string | undefined;
    let aiOptimized = false;

    if (body.aiOptimize && !scheduledAt) {
      const bestTimes = getBestPostingTime(protocols);
      if (bestTimes.length > 0) {
        const best = bestTimes[0];
        if (best) {
          const suggestedDate = getNextDateForDayAndHour(best.dayOfWeek, best.hourUTC);
          scheduledAt = suggestedDate.toISOString();
          aiOptimizedTime = scheduledAt;
          aiOptimized = true;
        }
      }
    }

    // ── Build Queue Entry ──────────────────────────────────────────────
    const id = `pq-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    const entry: QueueEntry = {
      id,
      walletAddress: address,
      masterPost: {
        text: sanitizeString(body.text, 10000),
        title: body.title ? sanitizeString(body.title, 500) : undefined,
        hashtags: body.hashtags,
        media: body.media,
        linkCard: body.linkCard,
        mentions: body.mentions as unknown as string[] | undefined,
        contentWarning: body.contentWarning,
        isSensitive: body.isSensitive,
        lang: body.lang,
      },
      protocols,
      scheduledAt,
      status: scheduledAt ? 'scheduled' : 'queued',
      position: 0,
      createdAt: now,
      updatedAt: now,
      autoThread: body.autoThread ?? false,
      aiOptimizedTime,
      aiOptimized,
      recurrence: body.recurrence,
      isEvergreen: body.isEvergreen,
      evergreenFrequency: body.evergreenFrequency,
    };

    // ── Handle Immediate Publish ────────────────────────────────────────
    if (isImmediate) {
      entry.status = 'publishing';

      // Save entry first so results can be updated
      if (env.CACHE) {
        await env.CACHE.put(`${PREFIX_QUEUE}${address}:${id}`, JSON.stringify(entry), {
          expirationTtl: 86400 * 90,
        });
      }

      // Publish to all selected protocols via cross-publish orchestrator
      try {
        const { executeCrossPublish } = await import('../../lib/cross-publish-orchestrator');
        const options: AutoFormatOptions = {
          autoThread: body.autoThread ?? false,
          optimizeHashtags: true,
          optimizeImages: true,
          optimizeLinks: true,
          adaptLanguage: true,
        };
        autoFormatForProtocols(entry.masterPost, protocols, options);

        const report = await executeCrossPublish(
          { masterPost: entry.masterPost, protocols: protocols as any, auth: {} },
          env,
        );

        entry.results = report.results.reduce(
          (acc: Record<string, { success: boolean; error?: string; nativeId?: string }>, r) => {
            acc[r.protocol] = {
              success: r.status === 'published',
              nativeId: r.postId,
              error: r.error,
            };
            return acc;
          },
          {},
        );
        entry.status = 'published';
        entry.updatedAt = new Date().toISOString();

        // Update stored entry
        if (env.CACHE) {
          await env.CACHE.put(`${PREFIX_QUEUE}${address}:${id}`, JSON.stringify(entry), {
            expirationTtl: 86400 * 90,
          });
        }

        // Record each protocol's result for analytics
        await incrementPremiumUsage(address, 'queuedPosts', 0, env); // touch usage
        for (const result of report.results) {
          const { recordBridgeOperation } = await import('../../lib/bridge-reliability');
          await recordBridgeOperation(
            env,
            result.protocol,
            result.status === 'published',
            0,
            result.error,
          ).catch(() => {});
        }

        return jsonResponse({
          ok: true,
          entryId: id,
          results: entry.results,
          scheduledAt: null,
          engine: 'native',
          status: 'published',
        });
      } catch (publishErr) {
        entry.status = 'failed';
        entry.error = publishErr instanceof Error ? publishErr.message : String(publishErr);
        entry.updatedAt = new Date().toISOString();
        if (env.CACHE) {
          await env.CACHE.put(`${PREFIX_QUEUE}${address}:${id}`, JSON.stringify(entry), {
            expirationTtl: 86400 * 30,
          });
        }
        return jsonResponse(
          {
            ok: false,
            entryId: id,
            error: entry.error,
            status: 'failed',
          },
          502,
        );
      }
    }

    // ── Handle Scheduled Post ──────────────────────────────────────────
    if (env.CACHE) {
      await env.CACHE.put(`${PREFIX_QUEUE}${address}:${id}`, JSON.stringify(entry), {
        expirationTtl: 86400 * 90,
      });

      // Index for cron executor
      if (scheduledAt) {
        await env.CACHE.put(
          `premium:scheduled:${id}`,
          JSON.stringify({ walletAddress: address, id }),
          {
            expirationTtl: 86400 * 90,
          },
        );
      }

      // Index for evergreen/recurring
      if (entry.isEvergreen) {
        const { PREFIX_EVERGREEN } = await import('./types');
        await env.CACHE.put(
          `${PREFIX_EVERGREEN}${id}`,
          JSON.stringify({ walletAddress: address, id }),
          {
            expirationTtl: 86400 * 365,
          },
        );
      }
      if (entry.recurrence && entry.recurrence !== 'once') {
        const { PREFIX_RECURRING } = await import('./types');
        await env.CACHE.put(
          `${PREFIX_RECURRING}${id}`,
          JSON.stringify({ walletAddress: address, id }),
          {
            expirationTtl: 86400 * 365,
          },
        );
      }
    }

    await incrementPremiumUsage(address, 'queuedPosts', 1, env);

    const engine = scheduledAt ? 'native' : 'native';

    return jsonResponse({
      ok: true,
      entryId: id,
      scheduledAt,
      engine,
      status: scheduledAt ? 'scheduled' : 'queued',
      aiOptimizedTime: aiOptimized ? aiOptimizedTime : undefined,
    });
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
}

// ─── Composer Preview ─────────────────────────────────────────────────────

/**
 * POST /api/premium/composer/preview
 *
 * Preview how a post will look on each selected protocol.
 * Returns per-platform adapted text, character counts, and media limits.
 * No publish happens — this is a read-only preview.
 */
export async function handleComposerPreview(request: Request, _env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  try {
    const body = (await request.json()) as {
      text?: string;
      title?: string;
      protocols?: string[];
      media?: Array<{ url: string; type?: string }>;
    };

    if (!body.text) {
      return jsonResponse({ error: 'text is required' }, 400);
    }

    const protocols = sanitizeStringArray(body.protocols as string[], ALL_PROTOCOLS.length);
    if (protocols.length === 0) {
      return jsonResponse({ error: 'At least one protocol required' }, 400);
    }

    // Import platform limits from cross-post-centralized
    const { PLATFORM_LIMITS, adaptContentForPlatform } = await import('../cross-post-centralized');

    const previews = protocols.map((protocol) => {
      const limits = PLATFORM_LIMITS[protocol];
      const adapted = adaptContentForPlatform(
        body.text!,
        protocol,
        body.media?.map((m) => m.url),
      );

      return {
        protocol,
        adaptedText: adapted.text,
        adaptedImageCount: adapted.images.length,
        originalLength: body.text!.length,
        adaptedLength: adapted.text.length,
        maxChars: limits?.maxChars ?? Infinity,
        maxImages: limits?.maxImages ?? 0,
        supportsVideo: limits?.supportsVideo ?? false,
        supportsMarkdown: limits?.supportsMarkdown ?? false,
        isLongForm: limits?.isLongForm ?? false,
        willTruncate: adapted.text.length < body.text!.length,
        truncatedBy: body.text!.length - adapted.text.length,
      };
    });

    return jsonResponse({
      ok: true,
      previews,
      totalChars: body.text.length,
      protocolsCount: protocols.length,
    });
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
}

// ─── Available Protocols ──────────────────────────────────────────────────

/**
 * GET /api/premium/composer/protocols
 *
 * List all available protocols with their capabilities and limits.
 * No auth required — this is informational.
 */
export async function handleComposerProtocols(request: Request, _env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  const { PLATFORM_LIMITS } = await import('../cross-post-centralized');

  const protocols = ALL_PROTOCOLS.map((id) => {
    const limits = PLATFORM_LIMITS[id];
    return {
      id,
      name: id.charAt(0).toUpperCase() + id.slice(1),
      ...(limits || {
        maxChars: Infinity,
        maxImages: 10,
        supportsVideo: true,
        supportsMarkdown: true,
        isLongForm: false,
        isVideo: false,
        isShortVideo: false,
        isNewsletter: false,
      }),
    };
  });

  return jsonResponse({
    ok: true,
    total: protocols.length,
    protocols,
  });
}
