/**
 * @degenfeed/api-worker — Vine routes registration
 *
 * Registers all Vine-like short-form video routes on the Hono app.
 */
import type { Hono } from 'hono';
import type { Env } from '../../types';

import {
  handleAttributeSound,
  handleRevine,
  handleVibeFeed,
  handleVineCategories,
  handleVineChallengeJoin,
  handleVineChallenges,
  handleVineFeatureSubmit,
  handleVineFeed,
  handleVineQueue,
  handleVineQueueRefresh,
  handleVineStars,
  handleVineTop,
  handleVineWatch,
} from '../vine-shorts';

export function registerVineRoutes(app: Hono<{ Bindings: Env }>): void {
  // ── Vine-style curated feed ──────────────────────────────────────────
  app.get('/api/shorts/vine', async (c) => handleVineFeed(c.req.raw, c.env));

  // ── Vibe-scored content ─────────────────────────────────────────────
  app.get('/api/shorts/vibe', async (c) => handleVibeFeed(c.req.raw, c.env));

  // ── Pre-loaded content queue ────────────────────────────────────────
  app.get('/api/shorts/queue', async (c) => handleVineQueue(c.req.raw, c.env));
  app.post('/api/shorts/queue/refresh', async (c) => handleVineQueueRefresh(c.req.raw, c.env));

  // ── Revine (repost) ─────────────────────────────────────────────────
  app.post('/api/shorts/revine', async (c) => handleRevine(c.req.raw, c.env));

  // ── Top Vines leaderboard ────────────────────────────────────────────
  app.get('/api/shorts/vine/top', async (c) => handleVineTop(c.req.raw, c.env));

  // ── Featured Vine submission ─────────────────────────────────────────
  app.post('/api/shorts/vine/feature', async (c) => handleVineFeatureSubmit(c.req.raw, c.env));

  // ── Vine Challenges ──────────────────────────────────────────────────
  app.get('/api/shorts/vine/challenges', async (c) => handleVineChallenges(c.req.raw, c.env));
  app.post('/api/shorts/vine/challenges/join', async (c) =>
    handleVineChallengeJoin(c.req.raw, c.env),
  );

  // ── Vine Stars leaderboard ──────────────────────────────────────────
  app.get('/api/shorts/vine/stars', async (c) => handleVineStars(c.req.raw, c.env));

  // ── Vine categories ──────────────────────────────────────────────────
  app.get('/api/shorts/vine/categories', async (c) => handleVineCategories(c.req.raw, c.env));

  // ── Sound attribution ────────────────────────────────────────────────
  app.post('/api/shorts/vine/sound/:id/attribute', async (c) =>
    handleAttributeSound(c.req.raw, c.env),
  );

  // ── Vine watch tracking ──────────────────────────────────────────────
  app.post('/api/shorts/vine/watch', async (c) => handleVineWatch(c.req.raw, c.env));
}
