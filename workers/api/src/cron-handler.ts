/**
 * @degenfeed/api-worker — Cron Job Handler
 *
 * Centralized cron dispatcher for Cloudflare Workers.
 * Called by the CF Workers cron trigger via app.ts.
 *
 * Schedules:
 *   every-1-min  — scheduled post executor
 *   every-30-min — trending content scraper
 *   daily-14:00  — daily digest + trending refresh
 *   sun-12:00    — weekly source discovery + health maintenance
 */

import { log } from './logger';
import type { Env } from './types';

/**
 * Handle a cron trigger event.
 * The controller.cron field tells us which cron matched.
 */
export async function scheduled(
  controller: { cron: string; scheduledTime: number; noRetry: () => void },
  env: Env,
): Promise<void> {
  const cron = controller.cron;

  // ── Every minute: scheduled post executor + sync queue processing ──
  if (cron === '* * * * *') {
    // Execute scheduled posts
    const { executeScheduledPosts } = await import('./routes/scheduled-executor');
    await executeScheduledPosts(env).catch((err) =>
      log('warn', '[scheduled] scheduled post executor failed', err),
    );

    // Execute content syndication queue
    try {
      const { executeDueSyndicationRules } = await import('./routes/content-syndication-routes');
      const synced = await executeDueSyndicationRules(env);
      if (synced > 0) {
        log('info', `[scheduled] executed ${synced} syndication rules`);
      }
    } catch (err) {
      log('warn', '[scheduled] syndication executor failed', err);
    }

    // Execute scheduled cross-posts
    const { executeDueScheduledCrossPosts } = await import('./routes/publish');
    const executed = await executeDueScheduledCrossPosts(env).catch((err) => {
      log('warn', '[scheduled] cross-post executor failed', err);
      return 0;
    });
    if (executed > 0) {
      log('info', `[scheduled] executed ${executed} scheduled cross-posts`);
    }

    // Execute premium scheduled posts (Buffer-style scheduling)
    const { executeDuePremiumPosts } = await import('./routes/premium-publish');
    const premiumExecuted = await executeDuePremiumPosts(env).catch((err) => {
      log('warn', '[scheduled] premium executor failed', err);
      return 0;
    });
    if (premiumExecuted > 0) {
      log('info', `[scheduled] executed ${premiumExecuted} premium scheduled posts`);
    }

    // Process realtime sync queue (every 30s effectively, since cron fires every min)
    try {
      const { processQueue } = await import('./lib/sync-queue');
      const { processSyncAction } = await import('./lib/realtime-sync');
      const result = await processQueue(env, processSyncAction, 25);
      if (result.processed > 0) {
        log(
          'info',
          `[scheduled] sync queue processed: ${result.succeeded} succeeded, ${result.failed} failed`,
        );
      }

      // Retry dead letters
      const retried = await retrySyncDeadLetters(env);
      if (retried > 0) {
        log('info', `[scheduled] retried ${retried} dead letter sync entries`);
      }
    } catch (err) {
      log('error', '[scheduled] sync queue processing failed', err);
    }

    // Clean up expired chat messages and files (auto-delete timers)
    try {
      const { handleCleanupCron } = await import('./routes/chat-features');
      const { cleanedMessages, cleanedFiles } = await handleCleanupCron(env);
      if (cleanedMessages > 0 || cleanedFiles > 0) {
        log('info', `[scheduled] chat cleanup: ${cleanedMessages} messages, ${cleanedFiles} files`);
      }
    } catch (err) {
      log('warn', '[scheduled] chat cleanup failed', err);
    }

    return; // No other work on the every-minute tick
  }

  // ── Feed cache warmup — every 5 minutes ────────────────────────────
  if (cron === '*/5 * * * *') {
    const { warmupFeedCache } = await import('../routes/feed');
    await warmupFeedCache(env).catch((err) =>
      log('warn', '[scheduled] feed cache warmup failed', err),
    );
    return;
  }

  // ── Trending scraper — 30-min and daily ticks ──────────────────────
  const { scrapeTrendingContent } = await import('./routes/trending-scraper');
  await scrapeTrendingContent(env).catch((err) =>
    log('warn', '[scheduled] trending scrape failed', err),
  );

  // ── Daily digest — 14:00 UTC ──────────────────────────────────────
  if (cron === '0 14 * * *') {
    const { handleCron } = await import('./routes/cron');
    await handleCron(env);

    // Process expired GDPR account deletion requests (24h grace period)
    try {
      const { processPendingDeletions } = await import('./routes/account-delete');
      const result = await processPendingDeletions(env);
      if (result.processed > 0 || result.errors > 0) {
        log('info', '[scheduled] GDPR deletion processing complete', result);
      }
    } catch (err) {
      log('error', '[scheduled] GDPR deletion processing failed', err);
    }

    // ── Curated podcast episode aggregation ──────────────────────
    try {
      const { handlePodcastAggregation } = await import('./routes/podcast-cron');
      const result = await handlePodcastAggregation(env);
      log('info', '[scheduled] curated podcast aggregation complete', {
        totalFetched: result.totalFetched,
        totalPodcasts: result.totalPodcasts,
        durationMs: result.durationMs,
        errors: result.errors.length > 0 ? result.errors : undefined,
      });
    } catch (err) {
      log('error', '[scheduled] podcast aggregation failed', err);
    }
  }

  // ── Weekly source discovery + health maintenance — Sunday 12:00 UTC ──
  if (cron === '0 12 * * 0') {
    // Run discovery
    try {
      const { handleSourcesDiscover } = await import('./routes/source-discovery');
      const discoverReq = new Request('http://localhost/api/sources/discover?platform=all');
      await handleSourcesDiscover(discoverReq, env);
      log('info', '[scheduled] weekly source discovery complete');
    } catch (err) {
      log('error', '[scheduled] source discovery failed', err);
    }

    // Initialize health tracking for newly discovered sources

    // ── Weekly identity re-discovery ────────────────────────────────
    try {
      const { discoverIdentities } = await import('./lib/identity-discovery');
      // Scan all wallets with linked identities and re-discover
      // This catches newly created protocol accounts that were linked after initial discovery
      let cursor: string | undefined;
      let rechecked = 0;
      do {
        const list = await env.IDENTITIES?.list({ cursor, limit: 100 });
        if (!list) break;
        cursor = list.cursor;
        for (const key of list.keys) {
          const wallet = key.name.replace('identity:', '');
          if (!wallet.startsWith('0x') && !wallet.startsWith('0x')) continue;
          try {
            await discoverIdentities(wallet, env, { forceRefresh: true });
            rechecked++;
          } catch {
            // Skip wallets that fail — likely stale entries
          }
        }
      } while (cursor);
      log('info', '[scheduled] identity re-discovery complete', { rechecked });
    } catch (err) {
      log('error', '[scheduled] identity re-discovery failed', err);
    }
    try {
      const { initSourceHealth } = await import('./routes/source-health');
      const allSourcesRaw = await env.CACHE?.get('discovered:sources:all');
      if (allSourcesRaw) {
        const allSources = JSON.parse(allSourcesRaw) as Array<{
          id: string;
          platform: string;
          weeklyActivity: number;
          relevanceScore: number;
          score: number;
        }>;
        for (const source of allSources) {
          await initSourceHealth(env, source as Parameters<typeof initSourceHealth>[1]);
        }
      }
      log('info', '[scheduled] health tracking initialized for sources');
    } catch (err) {
      log('error', '[scheduled] health init failed', err);
    }

    // Run health maintenance (stale detection + culling)
    try {
      const { runWeeklyHealthMaintenance } = await import('./routes/source-health');
      const result = await runWeeklyHealthMaintenance(env);
      log(
        'info',
        `[scheduled] health maintenance: ${result.checked} checked, ${result.stale} stale, ${result.culled} culled`,
      );
    } catch (err) {
      log('error', '[scheduled] health maintenance failed', err);
    }

    // Record KV last-run timestamp
    await env.CACHE?.put('discovered:sources:discovery:last-run', String(Date.now()));
  }
}

// ─── Helper: retry sync dead letters ─────────────────────────────────────

async function retrySyncDeadLetters(env: Env): Promise<number> {
  try {
    const { retryDeadLetters } = await import('./lib/sync-queue');
    return retryDeadLetters(env, 50);
  } catch {
    return 0;
  }
}
