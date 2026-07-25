/**
 * @degenfeed/api-worker — Social/Lemmy route registration
 *
 * Registers ALL Lemmy-related routes on the Hono app:
 *   - Registration & Auth
 *   - Community Management
 *   - Community Discovery (via existing routes)
 *   - Federation Management (admin)
 *   - Voting, Commenting, Following
 *
 * This is the centralized place where all /api/lemmy/* endpoints
 * are registered.
 */

import type { Hono } from 'hono';
import type { Env } from '../../index';
import { jsonResponse } from '../../index';

// ─── Import route handlers ─────────────────────────────────────────────

// Existing Lemmy routes
import {
  handleLemmyCommentCreate as handleLemmyCommentCreateExisting,
  handleLemmyCommunity,
  handleLemmyFeed,
  handleLemmyInstances,
  handleLemmyPostById,
  handleLemmyPostCreate,
  handleLemmyTrending,
} from '../lemmy';
import {
  handleLemmyBridgeCrossPost,
  handleLemmyBridgeShare,
  handleLemmyBridgeStatus,
} from '../lemmy-bridge';
// Community management
import {
  handleLemmyCommentCreate,
  handleLemmyCommunityCreate,
  handleLemmyCommunityFollow,
  handleLemmyCommunityModerate,
  handleLemmyCommunitySettings,
  handleLemmyCommunityUpdate,
  handleLemmyPostVote,
} from '../lemmy-community';
import { handleLemmyDiscover } from '../lemmy-discover';
// Federation management (admin)
import {
  handleLemmyFederationAllowlist,
  handleLemmyFederationAllowlistAdd,
  handleLemmyFederationAllowlistRemove,
  handleLemmyFederationBlocklist,
  handleLemmyFederationBlocklistAdd,
  handleLemmyFederationBlocklistRemove,
  handleLemmyFederationHealth,
  handleLemmyFederationInstances,
  handleLemmyFederationStats,
  handleLemmyFederationStatus,
} from '../lemmy-federation';
// Registration & Auth
import {
  handleLemmyAuth,
  handleLemmyAuthStatus,
  handleLemmyFederatedInstances,
  handleLemmyLogout,
  handleLemmyRegister,
  handleLemmyRegistrationCheck,
} from '../lemmy-registration';

// ─── Route Registration ────────────────────────────────────────────────

export function registerSocialLemmyRoutes(app: Hono<{ Bindings: Env }>): void {
  // ── 1. Registration & Auth ─────────────────────────────────────────
  // POST /api/lemmy/register — Create a Lemmy account
  app.post('/api/lemmy/register', async (c) => handleLemmyRegister(c.req.raw, c.env));

  // POST /api/lemmy/auth — Login to existing account
  app.post('/api/lemmy/auth', async (c) => handleLemmyAuth(c.req.raw, c.env));

  // POST /api/lemmy/logout — Invalidate session
  app.post('/api/lemmy/logout', async (c) => handleLemmyLogout(c.req.raw, c.env));

  // GET /api/lemmy/auth/status — Check account status
  app.get('/api/lemmy/auth/status', async (c) => handleLemmyAuthStatus(c.req.raw, c.env));

  // GET /api/lemmy/registration/check — Check username availability
  app.get('/api/lemmy/registration/check', async (c) =>
    handleLemmyRegistrationCheck(c.req.raw, c.env),
  );

  // ── 2. Feed & Posts ────────────────────────────────────────────────
  // GET /api/lemmy/feed — Discussion feed
  app.get('/api/lemmy/feed', async (c) => handleLemmyFeed(c.req.raw, c.env));

  // GET /api/lemmy/trending — Trending across instances
  app.get('/api/lemmy/trending', async (c) => handleLemmyTrending(c.req.raw, c.env));

  // GET /api/lemmy/post/:id — Single post with comments
  app.get('/api/lemmy/post/:id', async (c) =>
    handleLemmyPostById(c.req.raw, c.env, c.req.param('id')),
  );

  // POST /api/lemmy/post — Create post (cross-post from DegenFeed)
  app.post('/api/lemmy/post', async (c) => handleLemmyPostCreate(c.req.raw, c.env));

  // POST /api/lemmy/post/vote — Upvote/downvote a post
  app.post('/api/lemmy/post/vote', async (c) => handleLemmyPostVote(c.req.raw, c.env));

  // ── 3. Comments ────────────────────────────────────────────────────
  // POST /api/lemmy/comment — Comment on a post
  app.post('/api/lemmy/comment', async (c) => handleLemmyCommentCreateExisting(c.req.raw, c.env));

  // POST /api/lemmy/comment/create — Alternative comment endpoint
  app.post('/api/lemmy/comment/create', async (c) => handleLemmyCommentCreate(c.req.raw, c.env));

  // ── 4. Communities ─────────────────────────────────────────────────
  // POST /api/lemmy/community/create — Create community on our instance
  app.post('/api/lemmy/community/create', async (c) =>
    handleLemmyCommunityCreate(c.req.raw, c.env),
  );

  // POST /api/lemmy/community/follow — Subscribe/unsubscribe
  app.post('/api/lemmy/community/follow', async (c) =>
    handleLemmyCommunityFollow(c.req.raw, c.env),
  );

  // POST /api/lemmy/community/moderate — Moderate community
  app.post('/api/lemmy/community/moderate', async (c) =>
    handleLemmyCommunityModerate(c.req.raw, c.env),
  );

  // GET /api/lemmy/community/:name — Community info + posts
  app.get('/api/lemmy/community/:name', async (c) =>
    handleLemmyCommunity(c.req.raw, c.env, c.req.param('name')),
  );

  // GET /api/lemmy/community/:name/settings — Community settings
  app.get('/api/lemmy/community/:name/settings', async (c) =>
    handleLemmyCommunitySettings(c.req.raw, c.env, c.req.param('name')),
  );

  // PUT /api/lemmy/community/:name/settings — Update community settings
  app.put('/api/lemmy/community/:name/settings', async (c) =>
    handleLemmyCommunityUpdate(c.req.raw, c.env, c.req.param('name')),
  );

  // ── 5. Community Discovery ─────────────────────────────────────────
  // GET /api/lemmy/communities — Discover communities across fediverse
  app.get('/api/lemmy/communities', async (c) => handleLemmyDiscover(c.req.raw, c.env));

  // GET /api/lemmy/communities/trending — Trending communities
  app.get('/api/lemmy/communities/trending', async (c) => handleLemmyTrending(c.req.raw, c.env));

  // GET /api/lemmy/discover — Federated community discovery (existing)
  app.get('/api/lemmy/discover', async (c) => handleLemmyDiscover(c.req.raw, c.env));

  // ── 6. Instances ───────────────────────────────────────────────────
  // GET /api/lemmy/instances — List known healthy instances
  app.get('/api/lemmy/instances', async (c) => handleLemmyInstances(c.req.raw, c.env));

  // GET /api/lemmy/instances/federated — All federated instances
  app.get('/api/lemmy/instances/federated', async (c) =>
    handleLemmyFederatedInstances(c.req.raw, c.env),
  );

  // ── 7. Cross-Protocol Bridge ──────────────────────────────────────
  // POST /api/lemmy/bridge/cross-post — Cross-post content to Lemmy
  app.post('/api/lemmy/bridge/cross-post', async (c) =>
    handleLemmyBridgeCrossPost(c.req.raw, c.env),
  );

  // POST /api/lemmy/bridge/share — Share Lemmy post to other protocols
  app.post('/api/lemmy/bridge/share', async (c) => handleLemmyBridgeShare(c.req.raw, c.env));

  // GET /api/lemmy/bridge/status — Bridge status
  app.get('/api/lemmy/bridge/status', async (c) => handleLemmyBridgeStatus(c.req.raw, c.env));

  // ── 8. Federation Management (Admin) ──────────────────────────────
  // GET /api/lemmy/federation/status — Federation health overview
  app.get('/api/lemmy/federation/status', async (c) =>
    handleLemmyFederationStatus(c.req.raw, c.env),
  );

  // GET /api/lemmy/federation/instances — Connected instances
  app.get('/api/lemmy/federation/instances', async (c) =>
    handleLemmyFederationInstances(c.req.raw, c.env),
  );

  // GET /api/lemmy/federation/health — Detailed per-instance health
  app.get('/api/lemmy/federation/health', async (c) =>
    handleLemmyFederationHealth(c.req.raw, c.env),
  );

  // GET /api/lemmy/federation/stats — Federation stats
  app.get('/api/lemmy/federation/stats', async (c) => handleLemmyFederationStats(c.req.raw, c.env));

  // Allowlist management
  app.get('/api/lemmy/federation/allowlist', async (c) =>
    handleLemmyFederationAllowlist(c.req.raw, c.env),
  );
  app.post('/api/lemmy/federation/allowlist/add', async (c) =>
    handleLemmyFederationAllowlistAdd(c.req.raw, c.env),
  );
  app.post('/api/lemmy/federation/allowlist/remove', async (c) =>
    handleLemmyFederationAllowlistRemove(c.req.raw, c.env),
  );

  // Blocklist management
  app.get('/api/lemmy/federation/blocklist', async (c) =>
    handleLemmyFederationBlocklist(c.req.raw, c.env),
  );
  app.post('/api/lemmy/federation/blocklist/add', async (c) =>
    handleLemmyFederationBlocklistAdd(c.req.raw, c.env),
  );
  app.post('/api/lemmy/federation/blocklist/remove', async (c) =>
    handleLemmyFederationBlocklistRemove(c.req.raw, c.env),
  );
}
