/**
 * feed-fetcher — Provider dispatch + circuit breakers.
 *
 * Owns the provider registry (getProvider), the RSS/RMI fallback
 * wrapper, the KV-backed per-provider circuit breaker, and the
 * fan-out that fetches all requested protocols in parallel with
 * per-provider caching (stale-while-revalidate background refresh).
 */

import {
  BlueskyProvider,
  FarcasterProvider,
  type FeedProvider,
  type FeedResult,
  type FetchOptions,
  type HealthResult,
  LemmyProvider,
  LensProvider,
  MastodonProvider,
  NostrProvider,
  PonderProvider,
  RedditProvider,
  RmiDataBusProvider,
  RssProvider,
  ThreadsProvider,
} from '@degenfeed/feed-providers';
import type { Protocol, UnifiedPost } from '@degenfeed/types';
import { rmiUrl } from '@degenfeed/utils';
import type { Env } from '../index';
import { readProviderCache, writeProviderCache } from './feed-cache';
import { sanitizePosts } from './feed-enricher';

export const DEFAULT_PROTOCOLS: Protocol[] = [
  'rss',
  'reddit',
  'nostr',
  'farcaster',
  'lens',
  'bluesky',
  'mastodon',
  'lemmy',
  'ponder',
];

export const DEFAULT_TIMEOUT_MS = 6000;

export function getProvider(protocol: Protocol, env: Env): FeedProvider {
  switch (protocol) {
    case 'nostr':
      return new NostrProvider({
        relays: (env.RELAY_URLS ?? '').split(',').filter(Boolean),
      });
    case 'farcaster':
      return new FarcasterProvider({ hubUrl: env.FARCASTER_HUB_URL });
    case 'lens':
      return new LensProvider({ apiUrl: env.LENS_API_URL });
    case 'bluesky':
      return new BlueskyProvider({ baseUrl: env.BSKY_PUBLIC_URL });
    case 'mastodon':
      return new MastodonProvider({ instanceUrl: env.GTS_INSTANCE_URL });
    case 'lemmy':
      return new LemmyProvider();
    case 'threads':
      return new ThreadsProvider();
    case 'reddit':
      return new RedditProvider({ redlibUrl: env.REDLIB_URL });
    case 'ponder':
      return new PonderProvider();
    case 'rss':
      return new RssWithFallbackProvider(env);
    default:
      throw new Error(`Unknown protocol: ${protocol}`);
  }
}

// Wrapper that tries RMI first, falls back to public RSS.
// This is needed because RMI is only reachable from Talos internal
// network, not from the Cloudflare edge.
class RssWithFallbackProvider implements FeedProvider {
  readonly protocol: Protocol = 'rss';
  private readonly env: Env;
  private readonly rmi: RmiDataBusProvider;
  private readonly rss: RssProvider;

  constructor(env: Env) {
    this.env = env;
    this.rmi = new RmiDataBusProvider({ backendUrl: rmiUrl(env) });
    // Use a small curated set for edge reliability — the full 40+ feed
    // list is too slow from Cloudflare Workers.
    this.rss = new RssProvider({
      feeds: [
        'https://cointelegraph.com/rss',
        'https://decrypt.co/feed',
        'https://bitcoinmagazine.com/.rss/full/',
        'https://blog.ethereum.org/feed.xml',
        'https://blog.chain.link/feed/',
        'https://bankless.substack.com/feed',
        'https://weekinethereumnews.com/feed',
      ],
    });
  }

  async fetchFeed(opts: FetchOptions = {}): Promise<FeedResult> {
    const rmiUrlValue = rmiUrl(this.env);
    const rmiConfigured =
      rmiUrlValue && !rmiUrlValue.includes('127.0.0.1') && !rmiUrlValue.includes('localhost');
    if (rmiConfigured) {
      try {
        const result = await this.rmi.fetchFeed({
          ...opts,
          timeoutMs: Math.min(opts.timeoutMs ?? 2000, 2000),
        });
        if (result.posts.length > 0) return result;
      } catch (err) {
        console.warn(
          '[feed] RMI unavailable — falling back to RSS:',
          err instanceof Error ? err.message : err,
        );
      }
    }
    return this.rss.fetchFeed(opts);
  }

  async healthCheck(opts: FetchOptions = {}): Promise<HealthResult> {
    if (!this.rmi.healthCheck) {
      return { healthy: false, latencyMs: 0, error: 'No health check implemented' };
    }
    return this.rmi.healthCheck(opts);
  }
}

// ─── Circuit breaker ─────────────────────────────────────────────
// Per-provider KV-backed failure counter. After 3 consecutive
// failures in a 60s window, the provider is skipped on subsequent
// feed requests until a successful probe clears the breaker.

const CB_TTL = 60;
const CB_THRESHOLD = 3;

async function cbKey(protocol: string): Promise<string> {
  return `cb:${protocol}:${Math.floor(Date.now() / 60000)}`;
}

export async function isCircuitOpen(env: Env, protocol: string): Promise<boolean> {
  if (!env.CACHE) return false;
  try {
    const key = await cbKey(protocol);
    const raw = await env.CACHE.get(key);
    if (!raw) return false;
    const { count } = JSON.parse(raw) as { count: number };
    return count >= CB_THRESHOLD;
  } catch (err) {
    console.warn('[feed] isCircuitOpen failed:', err instanceof Error ? err.message : err);
    return false;
  }
}

export async function incrCircuit(env: Env, protocol: string): Promise<void> {
  if (!env.CACHE) return;
  try {
    const key = await cbKey(protocol);
    const raw = await env.CACHE.get(key);
    const count = raw ? (JSON.parse(raw) as { count: number }).count + 1 : 1;
    await env.CACHE.put(key, JSON.stringify({ count }), { expirationTtl: CB_TTL });
  } catch (err) {
    // Non-critical cache write — log and continue
    console.warn('[feed] incrCircuit KV write failed:', err instanceof Error ? err.message : err);
  }
}

export async function resetCircuit(env: Env, protocol: string): Promise<void> {
  if (!env.CACHE) return;
  try {
    const key = await cbKey(protocol);
    await env.CACHE.delete(key);
  } catch (err) {
    // Non-critical cache write — log and continue
    console.warn('[feed] resetCircuit KV delete failed:', err instanceof Error ? err.message : err);
  }
}

// ─── Provider fan-out ────────────────────────────────────────────

export interface ProviderResult {
  protocol: Protocol;
  posts: UnifiedPost[];
  /** Provider was skipped because its circuit breaker is open. */
  skipped?: boolean;
  /** The fan-out promise itself rejected (counted in `errors`). */
  failed?: boolean;
  error?: string;
}

export interface ExecutionContext {
  waitUntil: (p: Promise<unknown>) => void;
}

/**
 * Fetches all requested protocols in parallel. Respects open circuit
 * breakers, serves per-provider KV cache hits immediately (with a
 * background refresh via waitUntil), and trips breakers on failure.
 * Provider notices are appended to the `notices` sink.
 */
export async function fetchFromProviders(
  env: Env,
  protocols: Protocol[],
  limit: number,
  notices: string[],
  execCtx?: ExecutionContext,
): Promise<ProviderResult[]> {
  const results = await Promise.allSettled(
    protocols.map(async (protocol): Promise<ProviderResult> => {
      if (await isCircuitOpen(env, protocol)) {
        return { protocol, posts: [] as UnifiedPost[], skipped: true };
      }

      const cachedPosts = await readProviderCache(env, protocol, limit);
      if (cachedPosts) {
        void resetCircuit(env, protocol);
        const refreshP = (async () => {
          try {
            const provider = getProvider(protocol, env);
            const result = await provider.fetchFeed({
              timeoutMs: DEFAULT_TIMEOUT_MS,
              concurrency: 4,
            });
            const filtered = sanitizePosts(result.posts);
            if (result.notice) notices.push(result.notice);
            void resetCircuit(env, protocol);
            await writeProviderCache(env, protocol, limit, filtered);
          } catch (err) {
            console.error(
              '[feed] provider fetch failed (background refresh):',
              protocol,
              err instanceof Error ? err.message : err,
            );
            void incrCircuit(env, protocol);
          }
        })();
        if (execCtx?.waitUntil) {
          execCtx.waitUntil(refreshP);
        } else {
          void refreshP;
        }
        return { protocol, posts: cachedPosts };
      }

      try {
        const provider = getProvider(protocol, env);
        const result = await provider.fetchFeed({
          timeoutMs: DEFAULT_TIMEOUT_MS,
          concurrency: 4,
        });
        const filtered = sanitizePosts(result.posts);
        if (result.notice) notices.push(result.notice);
        void resetCircuit(env, protocol);
        void writeProviderCache(env, protocol, limit, filtered);
        return { protocol, posts: filtered };
      } catch (err) {
        void incrCircuit(env, protocol);
        const message = err instanceof Error ? err.message : 'unknown';
        console.error('[feed] provider fetch failed:', err instanceof Error ? err.message : err);
        return { protocol, posts: [] as UnifiedPost[], error: message };
      }
    }),
  );

  const collected: ProviderResult[] = [];
  for (const [index, result] of results.entries()) {
    const protocol = protocols[index];
    if (!protocol) continue;
    if (result.status === 'fulfilled') {
      collected.push(result.value);
    } else {
      const message = result.reason instanceof Error ? result.reason.message : 'unknown';
      collected.push({ protocol, posts: [], failed: true, error: message });
    }
  }
  return collected;
}

export interface ProviderFetchSummary {
  posts: UnifiedPost[];
  errors: string[];
  perProtocol: Record<string, number>;
}

/**
 * Aggregates fan-out results into the flat post list plus the
 * `errors`/`perProtocol` meta fields. Matches the legacy semantics:
 * a fulfilled-but-errored provider contributes 0 posts silently,
 * only breaker skips and outright rejections surface in `errors`.
 */
export function collectProviderResults(results: ProviderResult[]): ProviderFetchSummary {
  const posts: UnifiedPost[] = [];
  const errors: string[] = [];
  const perProtocol: Record<string, number> = {};
  for (const result of results) {
    if (result.skipped) {
      errors.push(`${result.protocol}: circuit breaker open — skipping`);
      perProtocol[result.protocol] = 0;
    } else if (result.failed) {
      errors.push(`${result.protocol}: ${result.error ?? 'unknown'}`);
      perProtocol[result.protocol] = 0;
    } else {
      perProtocol[result.protocol] = result.posts.length;
      posts.push(...result.posts);
    }
  }
  return { posts, errors, perProtocol };
}

// ─── Single-provider helpers for auxiliary routes ────────────────

export async function fetchRedditPosts(env: Env, subreddit: string | null): Promise<FeedResult> {
  const provider = subreddit
    ? new RedditProvider({ subreddits: [subreddit], redlibUrl: env.REDLIB_URL })
    : new RedditProvider({ redlibUrl: env.REDLIB_URL });
  return provider.fetchFeed({ timeoutMs: 5000 });
}

export interface ProviderHealth {
  healthy: boolean;
  latencyMs: number;
  error?: string;
}

export async function checkProvidersHealth(env: Env): Promise<Record<string, ProviderHealth>> {
  const results = await Promise.allSettled(
    DEFAULT_PROTOCOLS.map(async (protocol) => {
      const provider = getProvider(protocol, env);
      if (!provider.healthCheck) {
        return { protocol, healthy: false, latencyMs: 0, error: 'No health check implemented' };
      }
      const health = await provider.healthCheck({ timeoutMs: 3000 });
      return { protocol, ...health };
    }),
  );

  const health: Record<string, ProviderHealth> = {};
  for (const [index, result] of results.entries()) {
    const protocol = DEFAULT_PROTOCOLS[index];
    if (!protocol) continue;
    if (result.status === 'fulfilled') {
      health[protocol] = result.value;
    } else {
      health[protocol] = {
        healthy: false,
        latencyMs: 0,
        error: result.reason instanceof Error ? result.reason.message : 'unknown',
      };
    }
  }
  return health;
}
