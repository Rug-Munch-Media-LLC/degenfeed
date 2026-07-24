import { CircuitBreaker, CircuitBreakerError } from '@degenfeed/feed-core';
import type { Protocol, UnifiedPost } from '@degenfeed/types';
import type { FeedProvider, FeedResult, FetchOptions, SchemaGuard } from '../../types';
import {
  DEFAULT_TIMEOUT_MS,
  DEFAULT_USER_AGENT,
  fetchRss,
  withConcurrencyLimit,
  withTimeout,
} from '../../utils';
import type { RssFeedConfig, RssProviderOptions, ScoredRssPost } from './types';
import { DEFAULT_CRYPTO_FEEDS } from './config';
import { computeQualityScore } from './quality';
import { deduplicateRssPosts } from './dedup';
import { normalizeFeedInput } from './helpers';
import { feedToUnifiedPosts, parseRss } from './parsers';

export class RssProvider implements FeedProvider {
  readonly protocol: Protocol = 'rss';

  readonly schema: SchemaGuard = (): boolean => true;
  private readonly feedConfigs: RssFeedConfig[];
  private readonly breaker = new CircuitBreaker('rss');

  constructor(options: RssProviderOptions = {}) {
    // Normalize both string[] and RssFeedConfig[] inputs
    const raw = options.feeds ?? DEFAULT_CRYPTO_FEEDS;
    const normalized = raw.map(normalizeFeedInput);
    // Deduplicate by URL (keep first occurrence)
    const seen = new Set<string>();
    this.feedConfigs = normalized.filter((f) => {
      const key = f.url.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /** Returns the active feed configs (useful for introspection) */
  getFeeds(): RssFeedConfig[] {
    return this.feedConfigs;
  }

  async fetchFeed(opts: FetchOptions = {}): Promise<FeedResult> {
    if (this.feedConfigs.length === 0) return { posts: [] };
    try {
      return await this.breaker.execute(async () => {
        const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
        const concurrency = opts.concurrency ?? 4;
        const scored: ScoredRssPost[] = [];

        const results = await withConcurrencyLimit(
          this.feedConfigs,
          concurrency,
          async (feedConfig) => {
            try {
              const xml = await withTimeout(
                fetchRss(feedConfig.url, {
                  headers: { 'user-agent': DEFAULT_USER_AGENT, ...opts.headers },
                }),
                timeoutMs,
                `rss:${feedConfig.url}`,
              );
              const feed = parseRss(xml);
              return feedToUnifiedPosts(feedConfig, feed);
            } catch {
              return [] as ScoredRssPost[];
            }
          },
        );
        for (const r of results) scored.push(...r);

        // Apply tier-aware dedup
        const deduped = deduplicateRssPosts(scored);

        // Convert back to UnifiedPost[] with quality score stamped in raw
        const posts: UnifiedPost[] = deduped.map((s) => {
          const updated = { ...s.post };
          updated.raw = {
            ...(typeof updated.raw === 'object' && updated.raw !== null ? updated.raw : {}),
            qualityScore: s.quality,
          };
          return updated;
        });

        return {
          posts,
          notice: `RSS: ${deduped.length} posts from ${this.feedConfigs.length} feeds (${scored.length - deduped.length} deduped)`,
        };
      });
    } catch (err) {
      if (err instanceof CircuitBreakerError) {
        return { posts: [], notice: 'RSS: circuit breaker open — temporarily unavailable' };
      }
      return { posts: [], notice: 'RSS feed unavailable' };
    }
  }
}
