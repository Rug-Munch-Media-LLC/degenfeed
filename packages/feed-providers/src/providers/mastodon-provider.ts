import { CircuitBreaker, CircuitBreakerError } from '@degenfeed/feed-core';
import type { Protocol } from '@degenfeed/types';
import type { FeedProvider, FeedResult, FetchOptions, HealthResult, SchemaGuard } from '../types';
import {
  buildUrl,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_USER_AGENT,
  fetchJson,
  withConcurrencyLimit,
  withTimeout,
} from '../utils';
import {
  fetchHashtagTimeline,
  fetchMisskeyLocalTimeline,
  fetchMisskeyTrendingNotes,
  fetchPublicTimeline,
  type GtSStatus,
  instanceHealth,
  instanceHealthScore,
  type MastodonProviderOptions,
  recordInstanceFailure,
  recordInstanceSuccess,
  statusToUnifiedPost,
  stripHtml,
} from './mastodon-adapter';
import {
  CRYPTO_HASHTAGS,
  DEFAULT_GTS_INSTANCE,
  type FediverseSoftware,
  PUBLIC_MASTODON_INSTANCES,
  RELEVANCE_THRESHOLD,
  scoreFediverseRelevance,
  TECH_HASHTAGS,
  TRENDING_INSTANCES,
} from './mastodon-data';
export class MastodonProvider implements FeedProvider {
  readonly protocol: Protocol = 'mastodon';
  readonly schema: SchemaGuard = (): boolean => true;
  private readonly primaryUrl: string;
  private readonly fallbackUrls: string[];
  private readonly breaker = new CircuitBreaker('mastodon');

  constructor(options: MastodonProviderOptions = {}) {
    this.primaryUrl = options.instanceUrl || DEFAULT_GTS_INSTANCE;
    this.fallbackUrls =
      options.fallbackInstances ?? PUBLIC_MASTODON_INSTANCES.filter((u) => u !== this.primaryUrl);
  }

  async fetchFeed(opts: FetchOptions = {}): Promise<FeedResult> {
    try {
      return await this.breaker.execute(async () => {
        const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
        const limit = 50;
        const endpoints = [this.primaryUrl, ...this.fallbackUrls];
        const allStatuses: GtSStatus[] = [];

        // 0. Trending API — free public endpoint with high-engagement posts.
        //    Expanded 2026-07-18: 45+ instances across Mastodon, Pleroma, Misskey.
        const trendingStart = performance.now();
        const trendingResults = await Promise.allSettled(
          TRENDING_INSTANCES.map((inst) => {
            const healthAdjWeight = instanceHealthScore(inst.url, inst.weight);
            // Skip instances that have proven unhealthy
            if (healthAdjWeight < 0.2) return Promise.resolve([] as GtSStatus[]);

            const isMisskey = inst.software === 'misskey' || inst.software === 'firefish';
            const fetcher = isMisskey
              ? fetchMisskeyTrendingNotes(inst.url, 10)
              : fetchJson<GtSStatus[]>(
                  `${inst.url}/api/v1/trends/statuses?limit=${Math.ceil(10 * inst.weight)}`,
                  { headers: { 'user-agent': DEFAULT_USER_AGENT } },
                );

            return withTimeout(
              fetcher,
              Math.min(timeoutMs, 4000),
              `fediverse:trending:${inst.label}`,
            )
              .then((result) => {
                const latency = performance.now() - trendingStart;
                recordInstanceSuccess(inst.url, latency);
                return result;
              })
              .catch(() => {
                recordInstanceFailure(inst.url);
                return [] as GtSStatus[];
              });
          }),
        );
        for (const r of trendingResults) {
          if (r.status === 'fulfilled' && Array.isArray(r.value)) {
            allStatuses.push(...r.value);
          }
        }

        // 1. Misskey/Firefish instances: also try local timeline for fresh content
        const misskeyInstances = TRENDING_INSTANCES.filter(
          (i) => i.software === 'misskey' || i.software === 'firefish',
        );
        if (misskeyInstances.length > 0) {
          const misskeyTimelines = await Promise.allSettled(
            misskeyInstances.slice(0, 3).map(async (inst) => {
              try {
                return await withTimeout(
                  fetchMisskeyLocalTimeline(inst.url, 10),
                  4000,
                  `fediverse:misskey:${inst.label}`,
                );
              } catch {
                return [] as GtSStatus[];
              }
            }),
          );
          for (const r of misskeyTimelines) {
            if (r.status === 'fulfilled') allStatuses.push(...r.value);
          }
        }

        // 2. Primary public timeline
        const primaryStart = performance.now();
        try {
          const primaryPublic = await withTimeout(
            fetchPublicTimeline(this.primaryUrl, Math.ceil(limit / 2)),
            timeoutMs,
            `fediverse:public:${this.primaryUrl}`,
          );
          recordInstanceSuccess(this.primaryUrl, performance.now() - primaryStart);
          allStatuses.push(...primaryPublic);
        } catch {
          recordInstanceFailure(this.primaryUrl);
        }

        // 3. Hashtag searches across top instances for crypto+tech topics
        //    Expanded from 5 tags to 15 for broader coverage.
        const allHashes = [...CRYPTO_HASHTAGS.slice(0, 8), ...TECH_HASHTAGS.slice(0, 7)];
        const hashtagTargets: Array<{ instanceUrl: string; tag: string }> = [];
        const topEndpoints = endpoints.slice(0, 5);
        for (const instanceUrl of topEndpoints) {
          for (const tag of allHashes) {
            hashtagTargets.push({ instanceUrl, tag });
          }
        }
        const tagResults = await withConcurrencyLimit(
          hashtagTargets,
          6,
          async ({ instanceUrl, tag }) => {
            try {
              return await withTimeout(
                fetchHashtagTimeline(instanceUrl, tag, 5),
                Math.min(timeoutMs, 3000),
                `fediverse:${new URL(instanceUrl).hostname}#${tag}`,
              );
            } catch {
              return [];
            }
          },
        );
        for (const r of tagResults) allStatuses.push(...r);

        // 4. Public timelines from top instances for variety
        const generalResults = await withConcurrencyLimit(
          endpoints.slice(0, 5),
          3,
          async (instanceUrl) => {
            try {
              const start = performance.now();
              const posts = await withTimeout(
                fetchPublicTimeline(instanceUrl, 8),
                Math.min(timeoutMs, 3000),
                `fediverse:${instanceUrl}`,
              );
              recordInstanceSuccess(instanceUrl, performance.now() - start);
              return posts;
            } catch {
              recordInstanceFailure(instanceUrl);
              return [] as GtSStatus[];
            }
          },
        );
        for (const r of generalResults) allStatuses.push(...r);

        if (allStatuses.length === 0) {
          return { posts: [], notice: 'Fediverse feed unavailable — all instances failed' };
        }

        // 5. Deduplicate by native ID
        const seen = new Set<string>();
        const unique = allStatuses.filter((s) => {
          if (seen.has(s.id)) return false;
          seen.add(s.id);
          return true;
        });

        // 6. Content relevance filtering — keep only crypto/tech/web3 posts
        const relevanceFiltered = unique.filter((s) => {
          const text = s.content ?? '';
          const tags = (s.tags ?? []).map((t) => t.name);
          const relevance = scoreFediverseRelevance(stripHtml(text), tags);
          // Stamp relevance score on raw metadata for downstream ranking
          (s as unknown as Record<string, unknown>)._fediverseRelevance = relevance;
          return relevance >= RELEVANCE_THRESHOLD;
        });

        // 7. Detect fediverse software for each instance for proper badge
        const instanceToSoftware = new Map<string, FediverseSoftware>();
        for (const inst of TRENDING_INSTANCES) {
          try {
            instanceToSoftware.set(new URL(inst.url).hostname, inst.software);
          } catch {
            /* ignore */
          }
        }

        // Pick a sensible instance URL for each status
        const instanceMap = new Map<string, string>();
        for (const u of endpoints) {
          try {
            instanceMap.set(new URL(u).hostname, u);
          } catch {
            /* ignore */
          }
        }
        const pickInstance = (acct: string): string => {
          if (acct.includes('@')) {
            const host = acct.split('@')[1];
            if (host && instanceMap.has(host)) return instanceMap.get(host) ?? this.primaryUrl;
          }
          return endpoints[0] ?? this.primaryUrl;
        };

        const posts = relevanceFiltered.map((s) => {
          const post = statusToUnifiedPost(s, pickInstance(s.account.acct));
          // Stamp fediverse software type on raw for badge rendering
          const hostname = pickInstance(s.account.acct);
          const software = instanceToSoftware.get(new URL(hostname).hostname) ?? 'mastodon';
          (post.raw as Record<string, unknown>)._fediverseSoftware = software;
          return post;
        });

        return {
          posts,
          notice: `Fediverse: ${posts.length} posts from ${instanceHealth.size} instances (${relevanceFiltered.length} after relevance filter)`,
        };
      });
    } catch (err) {
      if (err instanceof CircuitBreakerError) {
        return {
          posts: [],
          notice: 'Mastodon/Fediverse: circuit breaker open — temporarily unavailable',
        };
      }
      return { posts: [], notice: 'Fediverse feed unavailable' };
    }
  }

  async healthCheck(opts: FetchOptions = {}): Promise<HealthResult> {
    const start = performance.now();
    try {
      await withTimeout(
        fetchJson(buildUrl(this.primaryUrl, '/api/v1/instance')),
        opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        'mastodon:health',
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
