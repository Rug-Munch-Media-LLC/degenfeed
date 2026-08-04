/**
 * @degenfeed/api-worker — OAuth route registration
 *
 * Mounts every OAuth provider authorize/callback handler on the Hono app.
 * Without this module the handlers below were defined but never registered,
 * so every "Sign in with Google/GitHub/Discord/…" button returned 404.
 *
 * Handler sources:
 *   - routes/auth.ts           — GoToSocial, Threads, Warpcast, Reddit callback
 *   - routes/oauth-providers.ts — Google, GitHub, Discord, Twitter, Telegram,
 *                                 Reddit authorize
 *
 * Authorize endpoints return a JSON payload with `authorizeUrl` + `state`;
 * the frontend redirects the user to the provider. Callback endpoints accept
 * a JSON body ({ code, state }) and exchange it for a provider session.
 */

import type { Hono } from 'hono';
import type { Env } from '../../types';
import {
  handleGtSAuthorize,
  handleGtSCallback,
  handleGtSRegister,
  handleRedditCallback,
  handleThreadsAuthorize,
  handleThreadsCallback,
  handleWarpcastAuthorize,
  handleWarpcastCallback,
} from '../auth';
import {
  handleDiscordAuthorize,
  handleDiscordCallback,
  handleGitHubAuthorize,
  handleGitHubCallback,
  handleGoogleAuthorize,
  handleGoogleCallback,
  handleRedditAuthorize,
  handleTelegramAuthorize,
  handleTelegramCallback,
  handleTwitterAuthorize,
  handleTwitterCallback,
} from '../oauth-providers';

/**
 * Register all OAuth provider routes on the given Hono app.
 */
export function registerAuthRoutes(app: Hono<{ Bindings: Env }>): void {
  // ─── Google ────────────────────────────────────────────────
  app.get('/api/auth/google/authorize', async (c) => handleGoogleAuthorize(c.req.raw, c.env));
  app.post('/api/auth/google/callback', async (c) => handleGoogleCallback(c.req.raw, c.env));

  // ─── GitHub ────────────────────────────────────────────────
  app.get('/api/auth/github/authorize', async (c) => handleGitHubAuthorize(c.req.raw, c.env));
  app.post('/api/auth/github/callback', async (c) => handleGitHubCallback(c.req.raw, c.env));

  // ─── Discord ───────────────────────────────────────────────
  app.get('/api/auth/discord/authorize', async (c) => handleDiscordAuthorize(c.req.raw, c.env));
  app.post('/api/auth/discord/callback', async (c) => handleDiscordCallback(c.req.raw, c.env));

  // ─── Twitter / X ───────────────────────────────────────────
  app.get('/api/auth/twitter/authorize', async (c) => handleTwitterAuthorize(c.req.raw, c.env));
  app.post('/api/auth/twitter/callback', async (c) => handleTwitterCallback(c.req.raw, c.env));

  // ─── Telegram ──────────────────────────────────────────────
  app.get('/api/auth/telegram/authorize', async (c) => handleTelegramAuthorize(c.req.raw, c.env));
  app.post('/api/auth/telegram/callback', async (c) => handleTelegramCallback(c.req.raw, c.env));

  // ─── Reddit (authorize + callback live in different modules) ─
  app.get('/api/auth/reddit/authorize', async (c) => handleRedditAuthorize(c.req.raw, c.env));
  app.post('/api/auth/reddit/callback', async (c) => handleRedditCallback(c.req.raw, c.env));

  // ─── GoToSocial (ActivityPub / Mastodon-compatible) ────────
  app.get('/api/auth/gotosocial/authorize', async (c) => handleGtSAuthorize(c.req.raw, c.env));
  app.post('/api/auth/gotosocial/callback', async (c) => handleGtSCallback(c.req.raw, c.env));
  app.post('/api/auth/gotosocial/register', async (c) => handleGtSRegister(c.req.raw, c.env));

  // ─── Threads ────────────────────────────────────────────────
  app.get('/api/auth/threads/authorize', async (c) => handleThreadsAuthorize(c.req.raw, c.env));
  app.post('/api/auth/threads/callback', async (c) => handleThreadsCallback(c.req.raw, c.env));

  // ─── Warpcast (Farcaster) ───────────────────────────────────
  app.get('/api/auth/warpcast/authorize', async (c) => handleWarpcastAuthorize(c.req.raw, c.env));
  app.post('/api/auth/warpcast/callback', async (c) => handleWarpcastCallback(c.req.raw, c.env));
}
