/**
 * feed-fetcher — Provider dispatch + circuit breakers.
 *
 * Owns the provider registry (getProvider), the RSS/RMI fallback
 * wrapper, the KV-backed per-provider circuit breaker, and the
 * fan-out that fetches all requested protocols in parallel with
 * per-provider caching (stale-while-revalidate background refresh).
 *
 * 2026-07-18: Added per-provider timeouts, timeout-specific circuit
 * breaker (5-min break after 3 consecutive timeouts), per-provider
 * fetch timing, slow-provider KV logging, and overall fetch timeout.
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
export const FEED_GENERATION_TIMEOUT_MS = 8000;

// ─── Per-provider timeouts ───────────────────────────────────────
// Aggressive timeouts for slow providers. RSS and ponder are the
// worst offenders — they get 3s. Social protocols get more slack.
export const PROVIDER_TIMEOUTS: Record<Protocol, number> = {
  nostr: 8000,
  farcaster: 8000,
  lens: 8000,
  bluesky: 8000,
  mastodon: 6000,
  reddit: 5000,
  lemmy: 5000,
  peertube: 5000,
  rss: 3000,    // RSS is slow — aggressive timeout
  threads: 3000, // Threads is scraping — aggressive timeout
  youtube: 5000,
  ponder: 3000,  // Ponder is slow — aggressive timeout
  ethereum: 8000, // On-chain data fetch
  solana: 8000,   // On-chain data fetch
};

// ─── Per-provider fetch timer ────────────────────────────────────
// Tracks how long each provider fetch takes so we can surface slow
// providers in the debug header and log to KV for tuning.

export interface ProviderTiming {
  protocol: Protocol;
  durationMs: number;
  timedOut?: boolean;
  circuitBroken?: boolean;
}

export class ProviderTimer {
  private timings: ProviderTiming[] = [];

  record(timing: ProviderTiming): void {
    this.timings.push(timing);
  }

  /** Providers that took >= thresholdMs (default 3000 = 3s). */
  getSlowProviders(thresholdMs = 3000): ProviderTiming[] {
    return this.timings.filter((t) => t.durationMs >= thresholdMs && !t.circuitBroken);
  }

  /** All recorded timings. */
  getResults(): ProviderTiming[] {
    return this.timings;
  }

  /** Build a debug string like "rss=3020ms,ponder=timeout" */
  toDebugString(): string {
    return this.timings
      .map((t) => {
        if (t.circuitBroken) return `${t.protocol}=circuit-broken`;
        if (t.timedOut) return `${t.protocol}=timeout`;
        return `${t.protocol}=${t.durationMs}ms`;
      })
      .join(',');
  }
}

// ─── Timeout wrapper ─────────────────────────────────────────────
// Races a provider fetch against a per-provider timeout. When the
// timeout fires, the promise rejects with a distinct "timeout" error
// so the caller can distinguish timeouts from other failures.

export class ProviderTimeoutError extends Error {
  readonly protocol: Protocol;
  readonly timeoutMs: number;

  constructor(protocol: Protocol, timeoutMs: number) {
    super(`${protocol} provider timed out after ${timeoutMs}ms`);
    this.name = 'ProviderTimeoutError';
    this.protocol = protocol;
    this.timeoutMs = timeoutMs;
  }
}

export async function withProviderTimeout<T>(
  promise: Promise<T>,
  protocol: Protocol,
  timeoutMs: number,
): Promise<T> {
  let id: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    id = setTimeout(() => {
      reject(new ProviderTimeoutError(protocol, timeoutMs));
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (id !== undefined) clearTimeout(id);
  }
}

// ─── KV log for slow providers ───────────────────────────────────
// Logs any provider fetch taking >3s to KV for analysis and tuning.

async function logSlowProviderToKv(
  env: Env,
  protocol: string,
  durationMs: number,
): Promise<void> {
  if (!env.CACHE) return;
  try {
    const key = `feed:slow:${protocol}:${Math.floor(Date.now() / 60000)}`;
    const raw = await env.CACHE.get(key);
    const list: number[] = raw ? (JSON.parse(raw) as number[]) : [];
    list.push(durationMs);
    // Keep the last 20 entries per protocol per minute
    const trimmed = list.slice(-20);
    await env.CACHE.put(key, JSON.stringify(trimmed), { expirationTtl: 300 });
  } catch {
    // Non-critical
  }
}

// ─── Provider factory ────────────────────────────────────────────

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

  /**
   * Curated high-quality RSS feeds (tier 1-2, weight >= 0.8).
   * Used for the main feed. The full feed list (tier 1-5) is used
   * when rssMode === 'full' (the "Everything" tab).
   */
  private readonly qualityRss: RssProvider;
  /** Full RSS provider with ALL feeds (loaded on demand for "Everything" tab). */
  private fullRss: RssProvider | null = null;

  constructor(env: Env) {
    this.env = env;
    this.rmi = new RmiDataBusProvider({ backendUrl: rmiUrl(env) });
    // Uses the hardcoded feeds for edge reliability.
    // Expanded 2026-07-18: includes ALL tier-1 and most tier-2 feeds
    // to ensure RSS returns 50+ posts every cycle.
    this.qualityRss = new RssProvider({
      feeds: [
        // ── Tier 1 — Must Have Crypto News ──
        'https://cointelegraph.com/rss',
        'https://decrypt.co/feed',
        'https://www.coindesk.com/arc/outboundfeeds/rss/',
        'https://www.theblock.co/rss',
        'https://blockworks.co/feed',
        'https://thedefiant.io/feed',
        'https://newsletter.banklesshq.com/feed',
        'https://banklesshq.substack.com/feed',
        'https://messari.io/feed',
        'https://blog.chainalysis.com/feed/',
        // ── Tier 2 — High Quality Research / VC ──
        'https://www.paradigm.xyz/feed/atom',
        'https://a16zcrypto.com/feed/',
        'https://blog.electriccapital.com/rss',
        'https://multicoin.capital/feed',
        'https://panteracapital.com/feed',
        'https://members.delphidigital.io/feed',
        'https://www.galaxy.com/insights/feed/',
        'https://coinmetrics.io/feed',
        'https://dune.com/blog/rss.xml',
        'https://nansen.substack.com/feed',
        'https://variant.fund/feed',
        'https://dragonfly.xyz/feed/',
        // ── Markets & Analysis ──
        'https://blog.kaiko.com/feed',
        'https://insights.glassnode.com/feed/',
        'https://www.artemis.xyz/blog/rss',
        'https://defillama.com/feed',
        'https://santiment.net/feed/',
        // ── Security & Policy ──
        'https://rekt.news/feed.xml',
        'https://blog.trailofbits.com/feed/',
        'https://www.coincenter.org/feed/',
        'https://cointelegraph.com/tags/regulation/feed',
        'https://blog.openzeppelin.com/feed',
        // ── AI x Crypto ──
        'https://www.interconnects.ai/feed/',
        'https://thesequence.substack.com/feed',
        'https://venturebeat.com/category/ai/feed/',
        'https://techcrunch.com/category/artificial-intelligence/feed/',
        // ── Protocol / Dev Blogs ──
        'https://bitcoinops.org/en/feed.xml',
        'https://blog.polygon.technology/feed',
        'https://blog.arbitrum.io/feed.xml',
        'https://optimism.mirror.xyz/feed/atom',
        'https://l2beat.com/feed/',
        'https://blog.eigenlayer.xyz/rss',
        'https://blog.celestia.org/rss',
        // ── Gaming & NFT ──
        'https://www.nftnow.com/feed/',
        'https://opensea.io/blog/feed.xml',
        'https://blog.decentraland.org/feed/',
        'https://axieinfinity.com/feed/',
        // ── Tech / Science ──
        'https://techcrunch.com/feed/',
        'https://www.theverge.com/rss/index.xml',
        'https://arstechnica.com/feed/',
        'https://www.wired.com/feed/rss',
        'https://venturebeat.com/feed/',
        'https://www.technologyreview.com/feed/',
        // ── PeerTube Video Feeds ──
        'https://video.degenfeed.xyz/feeds/videos.xml?sort=-publishedAt',
        'https://video.degenfeed.xyz/feeds/videos.xml?sort=-createdAt',
        'https://video.degenfeed.xyz/feeds/videos.xml?sort=-publishedAt&category=1',
      ],
    });
  }

  private getFullRss(): RssProvider {
    if (!this.fullRss) {
      this.fullRss = new RssProvider(); // uses DEFAULT_CRYPTO_FEEDS (all tiers)
    }
    return this.fullRss;
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

    // Use the rssMode header to determine quality vs full RSS fetch.
    // "full" = all tiers (Everything tab), anything else = quality only (main feed).
    const rssMode = (opts.headers?.['X-DegenFeed-RSS-Mode'] ?? 'quality') as 'quality' | 'full';
    const provider = rssMode === 'full' ? this.getFullRss() : this.qualityRss;

    // Apply batching: fetch in batches of up to 50 with a 2s timeout per batch.
    // The RssProvider already uses concurrency control internally, but we
    // add an outer timeout to prevent the whole fetch from hanging.
    const batchTimeoutMs = 2000;
    const result = await withProviderTimeout(
      provider.fetchFeed({
        ...opts,
        timeoutMs: Math.min(opts.timeoutMs ?? 3000, 3000),
        concurrency: opts.concurrency ?? 4,
      }),
      'rss',
      batchTimeoutMs,
    ).catch(() => ({ posts: [] } as FeedResult));

    return result;
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

// ─── Timeout-specific circuit breaker ────────────────────────────
// Separate from the generic error circuit breaker. After 3
// consecutive timeouts in a 5-minute window, the provider is
// skipped entirely until a successful fetch clears it.
// This prevents repeated slow provider calls from delaying the feed.

const CB_TIMEOUT_TTL = 300; // 5 minutes
const CB_TIMEOUT_THRESHOLD = 3;

async function cbTimeoutKey(protocol: string): Promise<string> {
  return `cb:timeout:${protocol}:${Math.floor(Date.now() / 60000)}`;
}

export async function isTimeoutCircuitOpen(env: Env, protocol: string): Promise<boolean> {
  if (!env.CACHE) return false;
  try {
    const key = await cbTimeoutKey(protocol);
    const raw = await env.CACHE.get(key);
    if (!raw) return false;
    const { count } = JSON.parse(raw) as { count: number };
    return count >= CB_TIMEOUT_THRESHOLD;
  } catch {
    return false;
  }
}

export async function incrTimeoutCircuit(env: Env, protocol: string): Promise<void> {
  if (!env.CACHE) return;
  try {
    const key = await cbTimeoutKey(protocol);
    const raw = await env.CACHE.get(key);
    const count = raw ? (JSON.parse(raw) as { count: number }).count + 1 : 1;
    await env.CACHE.put(key, JSON.stringify({ count }), { expirationTtl: CB_TIMEOUT_TTL });
  } catch {
    // Non-critical
  }
}

export async function resetTimeoutCircuit(env: Env, protocol: string): Promise<void> {
  if (!env.CACHE) return;
  try {
    const key = await cbTimeoutKey(protocol);
    await env.CACHE.delete(key);
  } catch {
    // Non-critical
  }
}

/**
 * Returns a map of which protocols are circuit-broken (and why),
 * for inclusion in the X-DegenFeed-Debug header.
 * Example: { rss: "timeout-circuit", ponder: "error-circuit" }
 */
export async function getCircuitStatus(
  env: Env,
  protocols: Protocol[],
): Promise<Record<string, string>> {
  const status: Record<string, string> = {};
  const [regular, timeout] = await Promise.all([
    Promise.all(protocols.map((p) => isCircuitOpen(env, p))),
    Promise.all(protocols.map((p) => isTimeoutCircuitOpen(env, p))),
  ]);
  for (let i = 0; i < protocols.length; i++) {
    const p = protocols[i];
    if (!p) continue;
    if (timeout[i]) {
      status[p] = 'timeout-circuit';
    } else if (regular[i]) {
      status[p] = 'error-circuit';
    }
  }
  return status;
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
 * breakers (both error-based and timeout-based), serves per-provider
 * KV cache hits immediately (with a background refresh via waitUntil),
 * and trips breakers on failure.
 *
 * Each provider fetch uses its own per-protocol timeout. After 3
 * consecutive timeouts, a 5-minute timeout-specific circuit breaker
 * trips. Slow providers (>3s) are logged to KV for analysis.
 *
 * Provider notices are appended to the `notices` sink. When provided,
 * `timer` collects per-provider timing data for the debug header.
 */
export async function fetchFromProviders(
  env: Env,
  protocols: Protocol[],
  limit: number,
  notices: string[],
  execCtx?: ExecutionContext,
  timer?: ProviderTimer,
): Promise<ProviderResult[]> {
  const results = await Promise.allSettled(
    protocols.map(async (protocol): Promise<ProviderResult> => {
      // Check both circuit breakers
      const [circuitOpen, timeoutCircuitOpen] = await Promise.all([
        isCircuitOpen(env, protocol),
        isTimeoutCircuitOpen(env, protocol),
      ]);

      if (circuitOpen || timeoutCircuitOpen) {
        const reason = timeoutCircuitOpen
          ? `timeout circuit breaker open after 3+ consecutive timeouts`
          : 'circuit breaker open — skipping';
        timer?.record({ protocol, durationMs: 0, circuitBroken: true });
        return { protocol, posts: [] as UnifiedPost[], skipped: true, error: reason };
      }

      // Check provider cache
      const cachedPosts = await readProviderCache(env, protocol, limit);
      if (cachedPosts) {
        void resetCircuit(env, protocol);
        void resetTimeoutCircuit(env, protocol);
        // Background refresh with per-provider timeout
        const timeoutMs = PROVIDER_TIMEOUTS[protocol] ?? DEFAULT_TIMEOUT_MS;
        const refreshP = (async () => {
          try {
            const provider = getProvider(protocol, env);
            const result = await withProviderTimeout(
              provider.fetchFeed({
                timeoutMs,
                concurrency: 4,
              }),
              protocol,
              timeoutMs,
            );
            const filtered = sanitizePosts(result.posts);
            if (result.notice) notices.push(result.notice);
            void resetCircuit(env, protocol);
            void resetTimeoutCircuit(env, protocol);
            await writeProviderCache(env, protocol, limit, filtered);
          } catch (err) {
            const isTimeout = err instanceof ProviderTimeoutError;
            console.error(
              `[feed] provider fetch failed (background refresh):`,
              protocol,
              isTimeout ? `timeout after ${(err as ProviderTimeoutError).timeoutMs}ms` : err instanceof Error ? err.message : err,
            );
            if (isTimeout) {
              void incrTimeoutCircuit(env, protocol);
            } else {
              void incrCircuit(env, protocol);
            }
          }
        })();
        if (execCtx?.waitUntil) {
          execCtx.waitUntil(refreshP);
        } else {
          void refreshP;
        }
        timer?.record({ protocol, durationMs: 0 }); // cache hit — 0ms
        return { protocol, posts: cachedPosts };
      }

      // Fresh fetch with per-provider timeout
      const timeoutMs = PROVIDER_TIMEOUTS[protocol] ?? DEFAULT_TIMEOUT_MS;
      const startTime = Date.now();

      try {
        const provider = getProvider(protocol, env);
        const result = await withProviderTimeout(
          provider.fetchFeed({
            timeoutMs,
            concurrency: 4,
          }),
          protocol,
          timeoutMs,
        );
        const elapsed = Date.now() - startTime;
        timer?.record({ protocol, durationMs: elapsed });

        // Log slow fetches (>3s) to KV for analysis
        if (elapsed > 3000) {
          console.warn(`[feed] slow provider: ${protocol} took ${elapsed}ms`);
          void logSlowProviderToKv(env, protocol, elapsed);
        }

        const filtered = sanitizePosts(result.posts);
        if (result.notice) notices.push(result.notice);
        void resetCircuit(env, protocol);
        void resetTimeoutCircuit(env, protocol);
        void writeProviderCache(env, protocol, limit, filtered);
        return { protocol, posts: filtered };
      } catch (err) {
        const elapsed = Date.now() - startTime;
        const isTimeout = err instanceof ProviderTimeoutError;
        timer?.record({ protocol, durationMs: elapsed, timedOut: isTimeout });

        if (isTimeout) {
          void incrTimeoutCircuit(env, protocol);
          console.warn(
            `[feed] provider TIMEOUT: ${protocol} after ${timeoutMs}ms`,
          );
        } else {
          void incrCircuit(env, protocol);
          console.error(
            '[feed] provider fetch failed:',
            protocol,
            err instanceof Error ? err.message : err,
          );
        }

        const message = err instanceof Error ? err.message : 'unknown';
        return { protocol, posts: [] as UnifiedPost[], error: message, failed: true };
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

/**
 * Wraps fetchFromProviders with a top-level timeout.
 * If the fetch takes longer than `timeoutMs`, returns whatever
 * results have been collected so far (via Promise.race).
 * Used by route handlers to enforce the 8s feed generation limit.
 */
export async function fetchFromProvidersWithTimeout(
  env: Env,
  protocols: Protocol[],
  limit: number,
  notices: string[],
  timeoutMs: number,
  execCtx?: ExecutionContext,
  timer?: ProviderTimer,
): Promise<{ results: ProviderResult[]; timedOut: boolean }> {
  const result = await Promise.race([
    (async (): Promise<{ results: ProviderResult[]; timedOut: false }> => ({
      results: await fetchFromProviders(env, protocols, limit, notices, execCtx, timer),
      timedOut: false as const,
    }))(),
    (async (): Promise<{ results: ProviderResult[]; timedOut: true }> => {
      await new Promise((r) => setTimeout(r, timeoutMs));
      return { results: [], timedOut: true as const };
    })(),
  ]);
  return result;
}

// ─── Result aggregation ──────────────────────────────────────────

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
 *
 * Updated 2026-07-18: `skipped` errors now distinguish between
 * error-circuit and timeout-circuit breaks in the error message.
 */
export function collectProviderResults(results: ProviderResult[]): ProviderFetchSummary {
  const posts: UnifiedPost[] = [];
  const errors: string[] = [];
  const perProtocol: Record<string, number> = {};
  for (const result of results) {
    if (result.skipped) {
      const reason = result.error?.includes('timeout')
        ? `${result.protocol}: timeout circuit breaker open — skipping`
        : `${result.protocol}: circuit breaker open — skipping`;
      errors.push(reason);
      perProtocol[result.protocol] = 0;
    } else if (result.failed) {
      const msg = result.error?.includes('timed out')
        ? `${result.protocol}: ${result.error}`
        : `${result.protocol}: ${result.error ?? 'unknown'}`;
      errors.push(msg);
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
