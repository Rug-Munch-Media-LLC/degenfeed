/**
 * @degenfeed/feed-providers — PixelfedProvider
 *
 * Feed provider for Pixelfed — the federated Instagram alternative.
 *
 * Pixelfed uses the Mastodon-compatible REST API, so we reuse patterns
 * from the MastodonProvider but scoped specifically to Pixelfed instances.
 *
 * Fetch strategies (in priority order):
 * 1. Our self-hosted Pixelfed instance (photos.degenfeed.xyz → 127.0.0.1:8087)
 * 2. Federated Pixelfed instances (pixelfed.social, pixelfed.de, etc.)
 * 3. Hashtag searches for crypto/tech/photography content
 *
 * Health check: /api/v1/instance or /api/v1/apps/verify_credentials
 */

import { CircuitBreaker, CircuitBreakerError } from '@degenfeed/feed-core';
import {
  getPublicTimeline,
  getTagTimeline,
  normalizePixelfedPost,
  PIXELFED_LOCAL_INSTANCE,
  type PixelfedStatus,
  PUBLIC_PIXELFED_INSTANCES,
} from '@degenfeed/pixelfed-sdk';
import type { Protocol, UnifiedPost } from '@degenfeed/types';
import type { FeedProvider, FeedResult, FetchOptions, HealthResult, SchemaGuard } from '../types';
import {
  buildUrl,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_USER_AGENT,
  fetchJson,
  withConcurrencyLimit,
  withTimeout,
} from '../utils';

// ─── Instance Health Tracking ──────────────────────────────────────

interface InstanceHealth {
  url: string;
  successes: number;
  failures: number;
  avgLatencyMs: number;
  lastSuccess: number;
  lastFailure: number;
}

const instanceHealth = new Map<string, InstanceHealth>();

function recordSuccess(url: string, latencyMs: number): void {
  const existing = instanceHealth.get(url) ?? {
    url,
    successes: 0,
    failures: 0,
    avgLatencyMs: 0,
    lastSuccess: 0,
    lastFailure: 0,
  };
  existing.successes++;
  existing.avgLatencyMs =
    existing.successes === 1
      ? latencyMs
      : (existing.avgLatencyMs * (existing.successes - 1) + latencyMs) / existing.successes;
  existing.lastSuccess = Date.now();
  instanceHealth.set(url, existing);
}

function recordFailure(url: string): void {
  const existing = instanceHealth.get(url) ?? {
    url,
    successes: 0,
    failures: 0,
    avgLatencyMs: 0,
    lastSuccess: 0,
    lastFailure: 0,
  };
  existing.failures++;
  existing.lastFailure = Date.now();
  instanceHealth.set(url, existing);
}

// ─── Crypto & Photo hashtags for Pixelfed search ───────────────────

const CRYPTO_HASHTAGS = [
  'bitcoin',
  'ethereum',
  'solana',
  'crypto',
  'nft',
  'defi',
  'web3',
  'blockchain',
  'ai',
  'art',
  'photography',
];

const PHOTO_HASHTAGS = [
  'photography',
  'photo',
  'picture',
  'landscape',
  'portrait',
  'streetphotography',
  'nature',
  'architecture',
  'travel',
  'art',
  'design',
  'fashion',
];

// ─── Provider ──────────────────────────────────────────────────────

export interface PixelfedProviderOptions {
  /** Primary Pixelfed instance URL (default: self-hosted) */
  instanceUrl?: string;
  /** Fallback Pixelfed instances */
  fallbackInstances?: string[];
  /** Max posts to fetch per source */
  limit?: number;
}

export class PixelfedProvider implements FeedProvider {
  readonly protocol: Protocol = 'pixelfed';
  readonly schema: SchemaGuard = (): boolean => true;

  private readonly primaryUrl: string;
  private readonly fallbackUrls: string[];
  private readonly breaker = new CircuitBreaker('pixelfed');

  constructor(options: PixelfedProviderOptions = {}) {
    this.primaryUrl = options.instanceUrl ?? PIXELFED_LOCAL_INSTANCE;
    this.fallbackUrls =
      options.fallbackInstances ??
      PUBLIC_PIXELFED_INSTANCES.map((i) => i.url).filter((u) => u !== this.primaryUrl);
  }

  async fetchFeed(opts: FetchOptions = {}): Promise<FeedResult> {
    try {
      return await this.breaker.execute(async () => {
        const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
        const limit = opts.timeoutMs ? 20 : 50;
        const allStatuses: PixelfedStatus[] = [];

        // ── 1. Self-hosted instance public timeline (media only) ──
        try {
          const localStart = performance.now();
          const localPosts = await withTimeout(
            getPublicTimeline(this.primaryUrl, { limit: Math.ceil(limit / 3), onlyMedia: true }),
            Math.min(timeoutMs, 5000),
            'pixelfed:local',
          );
          recordSuccess(this.primaryUrl, performance.now() - localStart);
          allStatuses.push(...localPosts);
        } catch {
          recordFailure(this.primaryUrl);
        }

        // ── 2. Federated Pixelfed instances public timelines ──
        const fedStart = performance.now();
        const fedResults = await Promise.allSettled(
          this.fallbackUrls.map(async (url) => {
            try {
              return await withTimeout(
                getPublicTimeline(url, {
                  limit: Math.ceil(limit / this.fallbackUrls.length / 2),
                  onlyMedia: true,
                  local: true,
                }),
                5000,
                `pixelfed:federated:${new URL(url).hostname}`,
              );
            } catch {
              recordFailure(url);
              return [] as PixelfedStatus[];
            }
          }),
        );
        for (const r of fedResults) {
          if (r.status === 'fulfilled') allStatuses.push(...r.value);
        }

        // ── 3. Hashtag searches for crypto + photo content ──
        const allTags = [...CRYPTO_HASHTAGS.slice(0, 6), ...PHOTO_HASHTAGS.slice(0, 6)];
        const tagTargets: Array<{ instanceUrl: string; tag: string }> = [];

        const searchableInstances = [this.primaryUrl, ...this.fallbackUrls.slice(0, 3)];
        for (const instanceUrl of searchableInstances) {
          for (const tag of allTags) {
            tagTargets.push({ instanceUrl, tag });
          }
        }

        const tagResults = await withConcurrencyLimit(
          tagTargets,
          5,
          async ({ instanceUrl, tag }) => {
            try {
              return await withTimeout(
                getTagTimeline(instanceUrl, tag, 5),
                4000,
                `pixelfed:tag:${tag}@${new URL(instanceUrl).hostname}`,
              );
            } catch {
              return [] as PixelfedStatus[];
            }
          },
        );
        for (const r of tagResults) allStatuses.push(...r);

        if (allStatuses.length === 0) {
          return { posts: [], notice: 'Pixelfed feed unavailable — all instances failed' };
        }

        // ── 4. Deduplicate by ID ──
        const seen = new Set<string>();
        const unique = allStatuses.filter((s) => {
          if (seen.has(s.id)) return false;
          seen.add(s.id);
          return true;
        });

        // ── 5. Normalize to UnifiedPost ──
        const posts: UnifiedPost[] = unique.map((s) => {
          const normalized = normalizePixelfedPost(s, this.primaryUrl);
          // Stamp content type as 'image' for Pixelfed posts (primary image platform)
          normalized.contentType = s.media_attachments?.some((m) => m.type === 'video')
            ? 'video'
            : 'image';
          return normalized;
        });

        return {
          posts,
          notice: `Pixelfed: ${posts.length} posts from ${searchableInstances.length} instances`,
        };
      });
    } catch (err) {
      if (err instanceof CircuitBreakerError) {
        return {
          posts: [],
          notice: 'Pixelfed: circuit breaker open — temporarily unavailable',
        };
      }
      return { posts: [], notice: 'Pixelfed feed unavailable' };
    }
  }

  async healthCheck(opts: FetchOptions = {}): Promise<HealthResult> {
    const start = performance.now();
    try {
      await withTimeout(
        fetchJson(buildUrl(this.primaryUrl, '/api/v1/instance')),
        opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        'pixelfed:health',
      );
      return { healthy: true, latencyMs: Math.round(performance.now() - start) };
    } catch (err) {
      return {
        healthy: false,
        latencyMs: Math.round(performance.now() - start),
        error: err instanceof Error ? err.message : 'unknown',
      };
    }
  }
}
