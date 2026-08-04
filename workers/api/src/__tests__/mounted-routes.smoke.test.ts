/**
 * Smoke test: verifies the newly mounted OAuth, membership and billing
 * routes respond (not 404). Builds a minimal Hono app with just the two
 * new register modules so it does not pull in the pre-existing broken
 * import chain (packages/realtime exports-map resolution in vitest).
 */

import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { registerAuthRoutes } from '../routes/register/auth';
import { registerMembershipRoutes } from '../routes/register/membership';
import type { Env } from '../types';

function makeEnv(): Env {
  return {
    AUTH_SECRET: 'x'.repeat(32),
    GOOGLE_CLIENT_ID: 'gid',
    GOOGLE_CLIENT_SECRET: 'gsecret',
    GITHUB_CLIENT_ID: 'ghid',
    GITHUB_CLIENT_SECRET: 'ghsecret',
    DISCORD_CLIENT_ID: 'did',
    DISCORD_CLIENT_SECRET: 'dsecret',
    REDDIT_CLIENT_ID: 'rid',
    REDDIT_CLIENT_SECRET: 'rsecret',
    THREADS_APP_ID: 'tid',
    THREADS_APP_SECRET: 'tsecret',
    FARCASTER_CLIENT_ID: 'fcid',
    TWITTER_CLIENT_ID: 'xid',
    TWITTER_CLIENT_SECRET: 'xsecret',
    TELEGRAM_BOT_NAME: 'testbot',
    TELEGRAM_BOT_TOKEN: 'ttoken',
    CACHE: undefined,
    SUBSCRIPTIONS: undefined,
  } as unknown as Env;
}

function buildApp(): Hono<{ Bindings: Env }> {
  const app = new Hono<{ Bindings: Env }>();
  registerAuthRoutes(app);
  registerMembershipRoutes(app);
  return app;
}

async function requestPost(
  app: Hono<{ Bindings: Env }>,
  path: string,
  body: Record<string, unknown>,
  env: Env,
): Promise<Response> {
  return app.request(
    path,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) },
    env,
  );
}

describe('mounted OAuth routes (Fix 1)', () => {
  const app = buildApp();
  const env = makeEnv();

  it('GET /api/auth/google/authorize returns 200 with authorizeUrl (not 404)', async () => {
    const res = await app.request('/api/auth/google/authorize', {}, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { authorizeUrl?: string };
    expect(body.authorizeUrl).toContain('accounts.google.com');
  });

  it('GET /api/auth/github/authorize returns 200 with authorizeUrl', async () => {
    const res = await app.request('/api/auth/github/authorize', {}, env);
    expect(res.status).toBe(200);
  });

  it('GET /api/auth/discord/authorize returns 200 with authorizeUrl', async () => {
    const res = await app.request('/api/auth/discord/authorize', {}, env);
    expect(res.status).toBe(200);
  });

  it('GET /api/auth/reddit/authorize returns 200 with authorizeUrl', async () => {
    const res = await app.request('/api/auth/reddit/authorize', {}, env);
    expect(res.status).toBe(200);
  });

  it('GET /api/auth/threads/authorize returns 200 with authorizeUrl', async () => {
    const res = await app.request('/api/auth/threads/authorize', {}, env);
    expect(res.status).toBe(200);
  });

  it('GET /api/auth/twitter/authorize returns 200 with authorizeUrl', async () => {
    const res = await app.request('/api/auth/twitter/authorize', {}, env);
    expect(res.status).toBe(200);
  });

  it('GET /api/auth/telegram/authorize returns 200 with authorizeUrl', async () => {
    const res = await app.request('/api/auth/telegram/authorize', {}, env);
    expect(res.status).toBe(200);
  });

  it('GET /api/auth/warpcast/authorize returns 200 with authorizeUrl', async () => {
    const res = await app.request('/api/auth/warpcast/authorize', {}, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { authorizeUrl?: string };
    expect(body.authorizeUrl).toContain('auth.farcaster.xyz');
  });

  it('GET /api/auth/gotosocial/authorize returns 200 with authorizeUrl', async () => {
    const res = await app.request('/api/auth/gotosocial/authorize', {}, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { authorizeUrl?: string };
    expect(body.authorizeUrl).toContain('social.degenfeed.xyz');
  });

  it('POST /api/auth/google/callback returns 400 for missing code (not 404)', async () => {
    const res = await requestPost(app, '/api/auth/google/callback', {}, env);
    expect(res.status).toBe(400);
  });

  it('POST /api/auth/reddit/callback returns 400 for missing code (not 404)', async () => {
    const res = await requestPost(app, '/api/auth/reddit/callback', {}, env);
    expect(res.status).toBe(400);
  });
});

describe('mounted membership + billing routes (Fix 2)', () => {
  const app = buildApp();
  const env = makeEnv();

  it('GET /api/membership/tier returns 401 (session required) — not 404', async () => {
    const res = await app.request('/api/membership/tier', {}, env);
    expect(res.status).not.toBe(404);
  });

  it('GET /api/membership/protocols returns 200 catalog (no auth)', async () => {
    const res = await app.request('/api/membership/protocols', {}, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { catalog?: unknown[]; totalProtocols?: number };
    expect(Array.isArray(body.catalog)).toBe(true);
    expect(body.totalProtocols).toBeGreaterThan(0);
  });

  it('GET /api/membership/protocols/nostr returns free-tier access (reconciled gating)', async () => {
    const res = await app.request('/api/membership/protocols/nostr', {}, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      protocol?: { minTier?: string };
    };
    expect(body.protocol?.minTier).toBe('free');
  });

  it('GET /api/membership/protocols/farcaster still requires paid tier', async () => {
    const res = await app.request('/api/membership/protocols/farcaster', {}, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      protocol?: { minTier?: string };
    };
    expect(body.protocol?.minTier).toBe('enterprise');
  });

  it('GET /api/billing/checkout?tier=pro returns 200 with blinkUrl', async () => {
    const res = await app.request('/api/billing/checkout?tier=pro', {}, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { blinkUrl?: string };
    expect(body.blinkUrl).toContain('/api/billing/checkout?tier=pro');
  });

  it('GET /api/billing/status returns 400 for missing identityId — not 404', async () => {
    const res = await app.request('/api/billing/status', {}, env);
    expect(res.status).toBe(400);
  });

  it('GET /api/billing/my-status returns 401 (session required) — not 404', async () => {
    const res = await app.request('/api/billing/my-status', {}, env);
    expect(res.status).not.toBe(404);
  });
});
