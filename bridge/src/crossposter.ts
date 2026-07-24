/**
 * DegenFeed Cross-Poster v3
 *
 * Cross-platform posting engine — configurable source→target pairs with:
 *   - Transform pipelines per pair
 *   - Per-target rate limiting
 *   - Failure tracking with backoff
 *   - Configurable polling intervals per source
 */

import { DEFAULT_CONFIG } from './lib/crossposter-config';
import { PUBLISHERS } from './lib/crossposter-publishers';
import { SOURCE_POLLERS } from './lib/crossposter-sources';
import { TRANSFORMS } from './lib/crossposter-transforms';
import type {
  CrossPairConfig,
  PairStats,
  ProtocolName,
  PublishResult,
  TransformResult,
} from './lib/crossposter-types';
import { FailureTracker, RateLimiter } from './lib/rate-limiter';
import type { UnifiedPost } from './server/types';

export type { CrossPairConfig, PairStats, ProtocolName, PublishResult };

// ─── State ──────────────────────────────────────────────────────────────

const rateLimiter = new RateLimiter();
const failureTracker = new FailureTracker();
const lastSeenIds = new Map<string, string>();

// ─── Core Engine ────────────────────────────────────────────────────────

/**
 * Cross-post a single post from a source to all configured targets.
 */
export async function crossPost(
  post: UnifiedPost,
  config: CrossPairConfig,
): Promise<{
  success: boolean;
  results: PublishResult[];
}> {
  const results: PublishResult[] = [];

  for (const target of config.targets) {
    // Rate limit check
    if (config.rateLimit) {
      const key = `${config.id}:${target}`;
      if (!rateLimiter.allow(key, config.rateLimit.maxPosts, config.rateLimit.windowMs)) {
        results.push({
          success: false,
          target,
          latencyMs: 0,
          error: 'Rate limited',
          retryable: false,
        });
        continue;
      }
    }

    // Check backoff
    if (!failureTracker.shouldAttempt(config.id, target)) {
      results.push({
        success: false,
        target,
        latencyMs: 0,
        error: 'Backoff active',
        retryable: true,
      });
      continue;
    }

    // Get transform
    const transform = TRANSFORMS[target];
    if (!transform) {
      results.push({
        success: false,
        target,
        latencyMs: 0,
        error: `No transform for target: ${target}`,
        retryable: false,
      });
      continue;
    }

    // Transform
    const startTime = Date.now();
    let transformResult: TransformResult;
    try {
      transformResult = await transform(post, target as ProtocolName);
    } catch (err) {
      transformResult = {
        success: false,
        error: `Transform error: ${(err as Error).message}`,
      };
    }

    if (!transformResult.success) {
      const latencyMs = Date.now() - startTime;
      const result: PublishResult = {
        success: false,
        target,
        latencyMs,
        error: transformResult.error || 'Transform failed',
        retryable: false,
      };
      results.push(result);
      failureTracker.recordFailure(config.id, target, result.error!);
      continue;
    }

    // Publish
    const publisher = PUBLISHERS[target];
    if (!publisher) {
      results.push({
        success: false,
        target,
        latencyMs: Date.now() - startTime,
        error: `No publisher for target: ${target}`,
        retryable: false,
      });
      continue;
    }

    try {
      const publishOk = await publisher(transformResult.payload);
      const latencyMs = Date.now() - startTime;

      if (publishOk) {
        results.push({ success: true, target, latencyMs });
        failureTracker.recordSuccess(config.id, target);
        console.log(`[crossposter] ✓ ${config.id} → ${target} (${latencyMs}ms): ${post.id}`);
      } else {
        const result: PublishResult = {
          success: false,
          target,
          latencyMs,
          error: 'Publisher returned failure',
          retryable: true,
        };
        results.push(result);
        failureTracker.recordFailure(config.id, target, result.error!);
        console.log(`[crossposter] ✗ ${config.id} → ${target}: publisher failed`);
      }
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      const result: PublishResult = {
        success: false,
        target,
        latencyMs,
        error: (err as Error).message,
        retryable: true,
      };
      results.push(result);
      failureTracker.recordFailure(config.id, target, result.error!);
      console.log(`[crossposter] ✗ ${config.id} → ${target}: ${(err as Error).message}`);
    }
  }

  const allOk = results.every((r) => r.success);
  return { success: allOk, results };
}

/**
 * Poll a single source and cross-post to all configured targets.
 */
async function pollSource(config: CrossPairConfig): Promise<void> {
  const poller = SOURCE_POLLERS[config.source];
  if (!poller) {
    console.log(`[crossposter] No poller for source: ${config.source}`);
    return;
  }

  try {
    const post = await poller();
    if (!post) {
      console.log(`[crossposter] ${config.id}: no new posts from ${config.source}`);
      return;
    }

    const lastId = lastSeenIds.get(config.id);
    if (post.id === lastId) {
      return; // Already cross-posted
    }

    // Apply content filter
    if (config.contentFilter && !config.contentFilter(post)) {
      console.log(`[crossposter] ${config.id}: post filtered out`);
      return;
    }

    const { success, results } = await crossPost(post, config);

    if (success) {
      lastSeenIds.set(config.id, post.id);
      console.log(`[crossposter] ${config.id}: all targets succeeded (${results.length})`);
    } else {
      const failures = results.filter((r) => !r.success);
      console.log(
        `[crossposter] ${config.id}: ${failures.length}/${results.length} targets failed`,
      );
    }
  } catch (err) {
    console.log(`[crossposter] ${config.id}: poll error - ${(err as Error).message}`);
  }
}

// ─── Public API ─────────────────────────────────────────────────────────

/**
 * Start all cross-posting pairs.
 * Each pair runs on its own polling interval.
 */
export function startCrossPoster(customConfigs?: CrossPairConfig[]): Map<string, NodeJS.Timeout> {
  const configs = customConfigs || DEFAULT_CONFIG;
  const timers = new Map<string, NodeJS.Timeout>();

  for (const config of configs) {
    if (!config.enabled) {
      console.log(`[crossposter] ${config.id}: disabled, skipping`);
      continue;
    }

    const interval = config.pollIntervalMs || 60000;
    console.log(
      `[crossposter] ${config.id}: ${config.source} → ${config.targets.join(', ')} every ${interval}ms`,
    );

    // Run immediately
    pollSource(config);

    // Then every interval
    const timer = setInterval(() => pollSource(config), interval);
    timers.set(config.id, timer);
  }

  return timers;
}

/**
 * Get cross-poster statistics for all configured pairs.
 */
export function getCrossPosterStats(configs?: CrossPairConfig[]): PairStats[] {
  const cfgs = configs || DEFAULT_CONFIG;
  return cfgs.map((config) => {
    const stats = failureTracker.getPairStats(config.id);
    return {
      id: config.id,
      source: config.source,
      targets: config.targets.join(', '),
      totalAttempts: stats.totalAttempts,
      totalSuccesses: stats.totalSuccesses,
      totalFailures: stats.totalFailures,
      lastAttemptAt: stats.lastAttemptAt,
      lastSuccessAt: stats.lastSuccessAt,
      lastError: stats.lastError,
      consecutiveFailures: stats.consecutiveFailures,
      rateLimitRemaining: config.rateLimit
        ? rateLimiter.remaining(config.id, config.rateLimit.maxPosts, config.rateLimit.windowMs)
        : -1,
      enabled: config.enabled,
    };
  });
}

/**
 * Stop all cross-poster timers.
 */
export function stopCrossPoster(timers: Map<string, NodeJS.Timeout>): void {
  for (const [id, timer] of timers) {
    clearInterval(timer);
    console.log(`[crossposter] ${id}: stopped`);
  }
  timers.clear();
}

/**
 * Reset state for a specific pair or all pairs.
 */
export function resetCrossPosterState(pairId?: string): void {
  if (pairId) {
    lastSeenIds.delete(pairId);
    rateLimiter.reset(pairId);
  } else {
    lastSeenIds.clear();
  }
}
