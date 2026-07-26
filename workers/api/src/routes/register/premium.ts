/**
 * @degenfeed/api-worker — Premium Publishing Route Registration
 *
 * Registers all premium publishing routes on the Hono app:
 * - Cross-platform composer (Buffer-style)
 * - Schedule queue management
 * - Content calendar
 * - AI-optimized scheduling
 * - Comprehensive post analytics dashboard
 * - Content recycling & evergreen
 *
 * @see /srv/work/repos/degenfeed-web/workers/api/src/routes/premium-publish/
 * @see /srv/work/repos/degenfeed-web/workers/api/src/routes/post-analytics.ts
 */

import type { Hono } from 'hono';
import { serverError } from '../../response-helpers';
// Post-analytics dashboard (comprehensive analytics from all sources)
import {
  handleBestTimesAnalytics,
  handleAnalyticsSummary as handleComprehensiveAnalyticsSummary,
  handleContentTypeAnalytics,
  handleFollowerAnalytics,
  handleHashtagAnalytics,
  handlePostAnalyticsDetail,
  handlePostAnalyticsList,
  handleTopPosts,
} from '../../routes/post-analytics';
import {
  handleBatchPublish,
  handleBestTimes,
  handleCalendarView,
  handleComposerPost,
  handleComposerPreview,
  handleComposerProtocols,
  handleGetPostPerformance,
  handleListPostAnalytics,
  handleQueueAdd,
  handleQueueDelete,
  handleQueueList,
  handleQueueStats,
  handleQueueUpdate,
  handleRecordEngagement,
  handleRecyclePost,
  handleSetEvergreen,
  handleSetRecurring,
} from '../../routes/premium-publish';
import { withSession } from '../../routes/route-registry';
import type { Env } from '../../types';

export function registerPremiumRoutes(app: Hono<{ Bindings: Env }>): void {
  // ═════════════════════════════════════════════════════════════════════
  // CROSS-PLATFORM COMPOSER (Buffer-style one-composer to rule them all)
  // ═════════════════════════════════════════════════════════════════════

  // POST /api/premium/composer — Compose and publish/schedule to ALL protocols
  app.post('/api/premium/composer', async (c) => {
    try {
      return await withSession(c, () => handleComposerPost(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // POST /api/premium/composer/preview — Preview post adaptation per protocol
  app.post('/api/premium/composer/preview', async (c) => {
    try {
      return handleComposerPreview(c.req.raw, c.env);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // GET /api/premium/composer/protocols — List all available protocols + limits
  app.get('/api/premium/composer/protocols', async (c) => {
    try {
      return handleComposerProtocols(c.req.raw, c.env);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // ═════════════════════════════════════════════════════════════════════
  // SCHEDULE QUEUE MANAGEMENT (CRUD + batch + stats + analytics)
  // ═════════════════════════════════════════════════════════════════════

  // POST /api/premium/queue — Add a post to the publishing queue
  app.post('/api/premium/queue', async (c) => {
    try {
      return await withSession(c, () => handleQueueAdd(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // GET /api/premium/queue — List queue entries (filterable by status)
  app.get('/api/premium/queue', async (c) => {
    try {
      return handleQueueList(c.req.raw, c.env);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // PATCH /api/premium/queue/:id — Update a queue entry
  app.patch('/api/premium/queue/:id', async (c) => {
    try {
      return await withSession(c, () => handleQueueUpdate(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // DELETE /api/premium/queue/:id — Delete/cancel a queue entry
  app.delete('/api/premium/queue/:id', async (c) => {
    try {
      return await withSession(c, () => handleQueueDelete(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // POST /api/premium/queue/batch — Batch publish multiple entries
  app.post('/api/premium/queue/batch', async (c) => {
    try {
      return await withSession(c, () => handleBatchPublish(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // GET /api/premium/queue/stats — Get queue statistics (counts by status, usage, limits)
  app.get('/api/premium/queue/stats', async (c) => {
    try {
      return handleQueueStats(c.req.raw, c.env);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // POST /api/premium/queue/analytics/record — Record engagement for a queued post
  app.post('/api/premium/queue/analytics/record', async (c) => {
    try {
      return await withSession(c, () => handleRecordEngagement(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // GET /api/premium/queue/analytics/posts — List engagement analytics for queued posts
  app.get('/api/premium/queue/analytics/posts', async (c) => {
    try {
      return await withSession(c, () => handleListPostAnalytics(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // GET /api/premium/queue/analytics/posts/:entryId — Get single post engagement
  app.get('/api/premium/queue/analytics/posts/:entryId', async (c) => {
    try {
      return await withSession(c, () => handleGetPostPerformance(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // ═════════════════════════════════════════════════════════════════════
  // CONTENT CALENDAR (Buffer-style visual calendar)
  // ═════════════════════════════════════════════════════════════════════

  // GET /api/premium/calendar — View content calendar (date range + recurring entries)
  app.get('/api/premium/calendar', async (c) => {
    try {
      return handleCalendarView(c.req.raw, c.env);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // ═════════════════════════════════════════════════════════════════════
  // AI-OPTIMIZED SCHEDULING
  // ═════════════════════════════════════════════════════════════════════

  // GET /api/premium/optimize/best-times — AI-suggested best posting times per protocol
  app.get('/api/premium/optimize/best-times', async (c) => {
    try {
      return handleBestTimes(c.req.raw, c.env);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // POST /api/premium/optimize/recycle — Configure content recycling strategy
  app.post('/api/premium/optimize/recycle', async (c) => {
    try {
      return await withSession(c, () => handleRecyclePost(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // POST /api/premium/optimize/evergreen — Mark post as evergreen (auto-repost)
  app.post('/api/premium/optimize/evergreen', async (c) => {
    try {
      return await withSession(c, () => handleSetEvergreen(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // POST /api/premium/optimize/recurring — Set recurring post pattern
  app.post('/api/premium/optimize/recurring', async (c) => {
    try {
      return await withSession(c, () => handleSetRecurring(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // ═════════════════════════════════════════════════════════════════════
  // COMPREHENSIVE POST ANALYTICS DASHBOARD
  // (from post-analytics.ts — bridge reliability, engagement, follower data)
  // ═════════════════════════════════════════════════════════════════════

  // GET /api/premium/analytics/summary — Aggregate analytics summary
  app.get('/api/premium/analytics/summary', async (c) => {
    try {
      return await withSession(c, () => handleComprehensiveAnalyticsSummary(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // GET /api/premium/analytics/posts — Per-post analytics list (paginated)
  app.get('/api/premium/analytics/posts', async (c) => {
    try {
      return await withSession(c, () => handlePostAnalyticsList(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // GET /api/premium/analytics/posts/:id — Single post analytics detail
  app.get('/api/premium/analytics/posts/:id', async (c) => {
    try {
      return await withSession(c, () => handlePostAnalyticsDetail(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // GET /api/premium/analytics/top-posts — Top performing posts
  app.get('/api/premium/analytics/top-posts', async (c) => {
    try {
      return await withSession(c, () => handleTopPosts(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // GET /api/premium/analytics/best-times — AI best posting times (analytics-powered)
  app.get('/api/premium/analytics/best-times', async (c) => {
    try {
      return await withSession(c, () => handleBestTimesAnalytics(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // GET /api/premium/analytics/hashtags — Hashtag performance analytics
  app.get('/api/premium/analytics/hashtags', async (c) => {
    try {
      return await withSession(c, () => handleHashtagAnalytics(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // GET /api/premium/analytics/content-types — Content type performance
  app.get('/api/premium/analytics/content-types', async (c) => {
    try {
      return await withSession(c, () => handleContentTypeAnalytics(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // GET /api/premium/analytics/followers — Follower growth analytics
  app.get('/api/premium/analytics/followers', async (c) => {
    try {
      return await withSession(c, () => handleFollowerAnalytics(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
}
