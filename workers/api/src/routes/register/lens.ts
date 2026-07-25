/**
 * @degenfeed/api-worker — Lens Protocol route registration
 *
 * Registers all Lens Protocol ownership routes on the Hono app instance.
 * Routes are organized by domain:
 *   Auth/Registration  → /api/lens/auth*, /api/lens/register
 *   Publish/Engage      → /api/lens/publish*, /api/lens/react
 *   Profile/Followers   → /api/lens/profile*, /api/lens/followers*, /api/lens/follow*
 *   Feed                → /api/lens/feed*, /api/lens/publications*
 *   Data Export         → /api/lens/export*
 *
 * Every provider integration has error handling and rate limiting.
 * No silent failures. No paid API dependency.
 */

import type { Hono } from 'hono';
import type { Env } from '../../index';
import { ok, serverError } from '../../response-helpers';
import { withSession } from '../../routes/route-registry';

// ─── Auth & Registration ────────────────────────────────────────────────────

import {
  handleLensAuth,
  handleLensAuthStatus,
  handleLensConfirmRegistration,
  handleLensRegister,
} from '../../routes/lens-auth';

// ─── Publications & Reactions ───────────────────────────────────────────────

import {
  handleLensCollect,
  handleLensComment,
  handleLensExplore,
  handleLensFeed,
  handleLensMirror,
  handleLensProfilePublications,
  handleLensPublish,
  handleLensPublishGasless,
  handleLensReact,
} from '../../routes/lens-publish';

// ─── Profile, Followers & Data Export ───────────────────────────────────────

import {
  handleLensExport,
  handleLensExportDownload,
  handleLensFollowers,
  handleLensFollowing,
  handleLensFollow,
  handleLensUnfollow,
  handleLensProfileGet,
  handleLensProfileResolve,
} from '../../routes/lens-profile';

export function registerLensRoutes(app: Hono<{ Bindings: Env }>): void {
  // ═══════════════════════════════════════════════════════════════════════
  // 1. AUTH & REGISTRATION
  // ═══════════════════════════════════════════════════════════════════════

  // POST /api/lens/register — Create a new Lens profile + handle
  app.post('/api/lens/register', async (c) => {
    try {
      return await withSession(c, () => handleLensRegister(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Lens register failed');
    }
  });

  // POST /api/lens/auth — Authenticate & link existing Lens profile
  app.post('/api/lens/auth', async (c) => {
    try {
      return await withSession(c, () => handleLensAuth(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Lens auth failed');
    }
  });

  // GET /api/lens/auth/status — Check Lens auth status
  app.get('/api/lens/auth/status', async (c) => {
    try {
      return await withSession(c, () => handleLensAuthStatus(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Lens auth status failed');
    }
  });

  // POST /api/lens/confirm — Confirm pending registration with signature
  app.post('/api/lens/confirm', async (c) => {
    try {
      return await withSession(c, () => handleLensConfirmRegistration(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Lens confirm failed');
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 2. PUBLICATIONS & REACTIONS
  // ═══════════════════════════════════════════════════════════════════════

  // POST /api/lens/publish — Create a post on Lens (on-chain)
  app.post('/api/lens/publish', async (c) => {
    try {
      return await withSession(c, () => handleLensPublish(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Lens publish failed');
    }
  });

  // POST /api/lens/publish/gasless — Create a post via Momoka (gasless)
  app.post('/api/lens/publish/gasless', async (c) => {
    try {
      return await withSession(c, () => handleLensPublishGasless(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Lens gasless publish failed');
    }
  });

  // POST /api/lens/publish/comment — Comment on a publication
  app.post('/api/lens/publish/comment', async (c) => {
    try {
      return await withSession(c, () => handleLensComment(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Lens comment failed');
    }
  });

  // POST /api/lens/publish/mirror — Mirror a publication
  app.post('/api/lens/publish/mirror', async (c) => {
    try {
      return await withSession(c, () => handleLensMirror(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Lens mirror failed');
    }
  });

  // POST /api/lens/publish/collect — Collect a publication (tx intent)
  app.post('/api/lens/publish/collect', async (c) => {
    try {
      return await withSession(c, () => handleLensCollect(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Lens collect failed');
    }
  });

  // POST /api/lens/react — Like/unlike a publication
  app.post('/api/lens/react', async (c) => {
    try {
      return await withSession(c, () => handleLensReact(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Lens react failed');
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 3. FEED
  // ═══════════════════════════════════════════════════════════════════════

  // GET /api/lens/feed — Timeline from local indexer (fallback to Lens API)
  app.get('/api/lens/feed', async (c) => {
    try {
      const result = await handleLensFeed(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Lens feed failed');
    }
  });

  // GET /api/lens/feed/explore — Explore trending content
  app.get('/api/lens/feed/explore', async (c) => {
    try {
      const result = await handleLensExplore(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Lens explore failed');
    }
  });

  // GET /api/lens/publications — Get publications for a profile
  app.get('/api/lens/publications', async (c) => {
    try {
      const result = await handleLensProfilePublications(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Lens publications failed');
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 4. PROFILE & FOLLOWERS
  // ═══════════════════════════════════════════════════════════════════════

  // GET /api/lens/profile/:id — Get Lens profile by ID
  app.get('/api/lens/profile/:id', async (c) => {
    try {
      const result = await handleLensProfileGet(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Lens profile failed');
    }
  });

  // GET /api/lens/profile/resolve — Resolve handle → profile
  app.get('/api/lens/profile/resolve', async (c) => {
    try {
      const result = await handleLensProfileResolve(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Lens resolve failed');
    }
  });

  // GET /api/lens/followers/:id — Get followers for a profile
  app.get('/api/lens/followers/:id', async (c) => {
    try {
      const result = await handleLensFollowers(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Lens followers failed');
    }
  });

  // GET /api/lens/following/:id — Get who a profile follows
  app.get('/api/lens/following/:id', async (c) => {
    try {
      const result = await handleLensFollowing(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Lens following failed');
    }
  });

  // POST /api/lens/follow — Follow a Lens profile
  app.post('/api/lens/follow', async (c) => {
    try {
      return await withSession(c, () => handleLensFollow(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Lens follow failed');
    }
  });

  // POST /api/lens/unfollow — Unfollow a Lens profile
  app.post('/api/lens/unfollow', async (c) => {
    try {
      return await withSession(c, () => handleLensUnfollow(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Lens unfollow failed');
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 5. DATA PORTABILITY
  // ═══════════════════════════════════════════════════════════════════════

  // GET /api/lens/export — Export all profile data as JSON
  app.get('/api/lens/export', async (c) => {
    try {
      return await withSession(c, () => handleLensExport(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Lens export failed');
    }
  });

  // GET /api/lens/export/download — Download full data export as JSON file
  app.get('/api/lens/export/download', async (c) => {
    try {
      return await withSession(c, () => handleLensExportDownload(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Lens download failed');
    }
  });
}
