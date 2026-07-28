/**
 * GoToSocial Routes — GTS as PRIMARY Sign-Up & Identity
 *
 * This module makes GTS/Mastodon the primary way users sign up for DegenFeed.
 * One GTS account = access to ALL ActivityPub services.
 *
 * Endpoints:
 *   POST /api/auth/register    — Create wallet + GTS account + auto-discover identities
 *   POST /api/gts/register     — Standalone GTS account creation
 *   POST /api/gts/auth         — Login with existing GTS account
 *   GET  /api/gts/account      — Get GTS account info
 *   GET  /api/gts/federation   — Show all federated identities for current user
 *   POST /api/gts/follow       — Follow an ActivityPub user from any instance
 *   GET  /api/gts/trending     — Trending content from fediverse
 *   GET  /api/gts/communities  — Discover popular fediverse communities
 *   GET  /api/gts/search       — Search fediverse accounts
 *   GET  /api/gts/export       — Export GTS data (ActivityPub standard)
 *   POST /api/gts/import       — Import data from another Mastodon instance
 *   POST /api/gts/migrate      - Initiate account migration to another instance
 *   GET  /api/gts/webringer    - Resolve a fediverse identity via WebFinger
 */

import type http from 'node:http';
import { GtSClient } from '@degenfeed/mastodon-sdk';
import { federationHub } from './federation-hub';
import {
  discoverPopularCommunities,
  fetchTrendingHashtags,
  fetchTrendingPosts,
  followFediverseAccount,
  lookupFediverseAccount,
  searchFediverseAccounts,
} from './fediverse-discovery';
import {
  authenticateUser,
  getClientCredentialsToken,
  registerGtsApp,
  verifyToken,
} from './gts-oauth';
import { provisionMeshAccounts } from './sso-routes';

// ─── Config ─────────────────────────────────────────────────────────

const GTS_BASE = process.env.GTS_BASE || 'http://127.0.0.1:8082';

// App credentials (from degenfeed_app.json or env)
const GTS_CLIENT_ID = process.env.GTS_CLIENT_ID || '';
const GTS_CLIENT_SECRET = process.env.GTS_CLIENT_SECRET || '';

// ─── Helpers ────────────────────────────────────────────────────────

function jsonOk(res: http.ServerResponse, data: unknown) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function jsonError(res: http.ServerResponse, status: number, code: string, message: string) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: { code, message, status } }));
}

/**
 * Get an app-level access token for server-to-server operations.
 * Falls back to env vars if available.
 */
async function getAppToken(): Promise<string | null> {
  if (GTS_CLIENT_ID && GTS_CLIENT_SECRET) {
    try {
      const token = await getClientCredentialsToken(GTS_CLIENT_ID, GTS_CLIENT_SECRET);
      return token.access_token;
    } catch {
      return null;
    }
  }
  return null;
}

// ─── Route Handlers ─────────────────────────────────────────────────

/**
 * POST /api/auth/register
 *
 * Full registration: creates wallet + GTS account + discovers fediverse identities.
 * This is the PRIMARY sign-up endpoint.
 *
 * Body: {
 *   username: string,     // Desired username
 *   email: string,        // Email address
 *   password: string,     // Password
 *   walletAddress?: string // Optional: pre-existing wallet
 *   reason?: string       // Optional: sign-up reason
 * }
 */
async function handleFullRegister(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  try {
    const body = await readBody(req);
    const { username, email, password, walletAddress, reason } = body;

    // Validate required fields
    if (!username || !email || !password) {
      return jsonError(res, 400, 'VALIDATION_ERROR', 'username, email, and password are required');
    }

    // Validate username format (alphanumeric + underscore, 1-64 chars)
    if (!/^[a-zA-Z0-9_]{1,64}$/.test(username)) {
      return jsonError(
        res,
        400,
        'VALIDATION_ERROR',
        'Username must be 1-64 alphanumeric characters or underscores',
      );
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonError(res, 400, 'VALIDATION_ERROR', 'Invalid email format');
    }

    // Validate password length
    if (password.length < 8) {
      return jsonError(res, 400, 'VALIDATION_ERROR', 'Password must be at least 8 characters');
    }

    // Step 1: Create GTS account
    const gtsAccount = await createGtsAccount(username, email, password, reason);
    if (!gtsAccount) {
      return jsonError(
        res,
        409,
        'ACCOUNT_CREATION_FAILED',
        'Could not create GTS account. Username may already be taken.',
      );
    }

    // Step 2: Get OAuth token for the new account
    let accessToken: string | null = null;
    try {
      const authResult = await authenticateUser(
        GTS_CLIENT_ID,
        GTS_CLIENT_SECRET,
        username,
        password,
      );
      accessToken = authResult.access_token;
    } catch {
      // Auth may fail if email confirmation is required
      accessToken = null;
    }

    // Step 3: Discover fediverse identities
    const fediverseIdentity = await federationHub.discoverIdentity(
      username,
      gtsAccount.id,
      accessToken || undefined,
    );

    // Step 5: Provision accounts on ALL other mesh services (async, non-blocking)
    provisionMeshAccounts(
      walletAddress || `0x${Buffer.from(username).toString('hex').slice(0, 40)}`,
      username,
      email,
      ['mastodon'],
    )
      .then(({ results, summary }) => {
        console.log(
          `[gts-routes] Post-registration provisioning for ${username}: ${summary.ok} ok, ${summary.failed} failed, ${summary.skipped} skipped`,
        );
        if (summary.failed > 0) {
          const failedList = results.filter((r) => !r.ok).map((r) => `${r.protocol}: ${r.error}`);
          console.warn(`[gts-routes] Provisioning failures for ${username}:`, failedList);
        }
      })
      .catch((err: unknown) => {
        console.error(
          `[gts-routes] Provisioning threw for ${username}:`,
          err instanceof Error ? err.message : err,
        );
      });

    // Step 4: Return complete registration result
    return jsonOk(res, {
      ok: true,
      user: {
        id: gtsAccount.id,
        username: gtsAccount.username,
        acct: gtsAccount.acct,
        display_name: gtsAccount.display_name,
        avatar: gtsAccount.avatar,
        avatar_static: gtsAccount.avatar_static,
        header: gtsAccount.header,
        header_static: gtsAccount.header_static,
        note: gtsAccount.note,
        url: gtsAccount.url,
        created_at: gtsAccount.created_at,
      },
      identity: {
        gtsHandle: `@${username}@social.degenfeed.xyz`,
        gtsId: gtsAccount.id,
        services: federationHub.summarizeIdentity(fediverseIdentity),
        walletAddress: walletAddress || null,
      },
      auth: accessToken
        ? {
            access_token: accessToken,
            token_type: 'Bearer',
            scope: 'read write follow push',
          }
        : null,
      message: accessToken
        ? 'Account created successfully. Check your email for confirmation.'
        : 'Account created. Please check your email to confirm before logging in.',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[gts-routes] Full register error:', msg);
    return jsonError(res, 500, 'INTERNAL_ERROR', 'Registration failed. Please try again.');
  }
}

/**
 * POST /api/gts/register
 *
 * Standalone GTS account creation (without wallet).
 *
 * Body: { username, email, password, reason? }
 */
async function handleGtsRegister(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  try {
    const body = await readBody(req);
    const { username, email, password, reason } = body;

    if (!username || !email || !password) {
      return jsonError(res, 400, 'VALIDATION_ERROR', 'username, email, and password are required');
    }

    const account = await createGtsAccount(username, email, password, reason);
    if (!account) {
      return jsonError(
        res,
        409,
        'ACCOUNT_CREATION_FAILED',
        'Could not create account. Username/email may already be taken.',
      );
    }

    // Auto-authenticate after registration
    let accessToken: string | null = null;
    try {
      const authResult = await authenticateUser(
        GTS_CLIENT_ID,
        GTS_CLIENT_SECRET,
        username,
        password,
      );
      accessToken = authResult.access_token;
    } catch {
      // email confirmation may be pending
    }

    // Fire-and-forget provisioning on mesh services
    provisionMeshAccounts(
      `0x${Buffer.from(username).toString('hex').slice(0, 40)}`,
      username,
      email,
      ['mastodon'],
    )
      .then(({ results, summary }) => {
        console.log(
          `[gts-routes] Post-register provisioning for ${username}: ${summary.ok} ok, ${summary.failed} failed, ${summary.skipped} skipped`,
        );
      })
      .catch((err: unknown) => {
        console.error(
          `[gts-routes] Post-register provisioning threw:`,
          err instanceof Error ? err.message : err,
        );
      });

    return jsonOk(res, {
      ok: true,
      account,
      access_token: accessToken,
      message: accessToken
        ? 'Account created successfully.'
        : 'Account created. Check your email to confirm.',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[gts-routes] Register error:', msg);
    return jsonError(res, 500, 'INTERNAL_ERROR', 'Registration failed.');
  }
}

/**
 * POST /api/gts/auth
 *
 * Login with existing GTS account.
 *
 * Body: { username, password }
 */
async function handleGtsAuth(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  try {
    const body = await readBody(req);
    const { username, password } = body;

    if (!username || !password) {
      return jsonError(res, 400, 'VALIDATION_ERROR', 'username and password are required');
    }

    const authResult = await authenticateUser(GTS_CLIENT_ID, GTS_CLIENT_SECRET, username, password);

    // Also discover fediverse identities
    const fediverseIdentity = authResult.user
      ? await federationHub.discoverIdentity(username, authResult.user.id, authResult.access_token)
      : null;

    return jsonOk(res, {
      ok: true,
      access_token: authResult.access_token,
      token_type: authResult.token_type,
      scope: authResult.scope,
      user: authResult.user || null,
      identity: fediverseIdentity
        ? {
            gtsHandle: `@${username}@social.degenfeed.xyz`,
            services: federationHub.summarizeIdentity(fediverseIdentity),
          }
        : null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    if (msg.includes('Invalid username or password') || msg.includes('401')) {
      return jsonError(res, 401, 'AUTH_FAILED', 'Invalid username or password');
    }
    console.error('[gts-routes] Auth error:', msg);
    return jsonError(res, 500, 'INTERNAL_ERROR', 'Authentication failed.');
  }
}

/**
 * GET /api/gts/account
 *
 * Get GTS account info for the authenticated user.
 * Requires Authorization: Bearer <token> header.
 */
async function handleGetAccount(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const token = extractBearerToken(req);
  if (!token) {
    return jsonError(res, 401, 'AUTH_REQUIRED', 'Authorization header required');
  }

  try {
    const account = await verifyToken(token);
    return jsonOk(res, { account });
  } catch {
    return jsonError(res, 401, 'INVALID_TOKEN', 'Invalid or expired token');
  }
}

/**
 * GET /api/gts/federation
 *
 * Show all federated identities for the current user.
 * Requires Authorization header.
 */
async function handleGetFederation(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const token = extractBearerToken(req);
  if (!token) {
    return jsonError(res, 401, 'AUTH_REQUIRED', 'Authorization header required');
  }

  try {
    const account = await verifyToken(token);
    const identity = federationHub.getIdentity(`@${account.username}@social.degenfeed.xyz`);

    if (identity) {
      return jsonOk(res, {
        identity: {
          gtsHandle: identity.gtsHandle,
          services: federationHub.summarizeIdentity(identity),
        },
      });
    }

    // Not yet discovered — do it now
    const discovered = await federationHub.discoverIdentity(account.username, account.id, token);
    return jsonOk(res, {
      identity: {
        gtsHandle: discovered.gtsHandle,
        services: federationHub.summarizeIdentity(discovered),
      },
    });
  } catch {
    return jsonError(res, 401, 'INVALID_TOKEN', 'Invalid or expired token');
  }
}

/**
 * POST /api/gts/follow
 *
 * Follow an ActivityPub user from any instance.
 * Body: { account_id: string } or { acct: string }
 */
async function handleFollow(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const token = extractBearerToken(req);
  if (!token) {
    return jsonError(res, 401, 'AUTH_REQUIRED', 'Authorization header required');
  }

  try {
    const body = await readBody(req);
    const { account_id, acct } = body;

    let targetId = account_id;
    if (acct && !targetId) {
      const lookedUp = await lookupFediverseAccount(acct, token);
      if (!lookedUp) {
        return jsonError(res, 404, 'NOT_FOUND', `Account ${acct} not found`);
      }
      targetId = lookedUp.id;
    }

    if (!targetId) {
      return jsonError(res, 400, 'VALIDATION_ERROR', 'account_id or acct is required');
    }

    const result = await followFediverseAccount(targetId, token);
    return jsonOk(res, { ok: true, account: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return jsonError(res, 500, 'FOLLOW_FAILED', msg);
  }
}

/**
 * GET /api/gts/trending
 *
 * Trending content from the fediverse.
 * Query params: limit (default 20), type (hashtags|posts)
 */
async function handleTrending(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const limit = Math.min(50, parseInt(url.searchParams.get('limit') || '20', 10));
  const type = url.searchParams.get('type') || 'posts';

  try {
    if (type === 'hashtags') {
      const tags = await fetchTrendingHashtags();
      return jsonOk(res, { data: tags, meta: { total: tags.length, type } });
    }

    const token = extractBearerToken(req);
    const posts = await fetchTrendingPosts(limit, token || undefined);
    return jsonOk(res, { data: posts, meta: { total: posts.length, type } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[gts-routes] Trending error:', msg);
    return jsonError(res, 500, 'FETCH_FAILED', 'Could not fetch trending content');
  }
}

/**
 * GET /api/gts/communities
 *
 * Discover popular fediverse communities (Lemmy).
 */
async function handleCommunities(
  _req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  try {
    const communities = await discoverPopularCommunities();
    return jsonOk(res, { data: communities, meta: { total: communities.length } });
  } catch {
    return jsonError(res, 500, 'FETCH_FAILED', 'Could not fetch communities');
  }
}

/**
 * GET /api/gts/search
 *
 * Search fediverse accounts.
 * Query params: q (query string), limit (default 10)
 */
async function handleSearch(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const q = url.searchParams.get('q') || '';
  const limit = Math.min(50, parseInt(url.searchParams.get('limit') || '10', 10));

  if (!q.trim()) {
    return jsonError(res, 400, 'VALIDATION_ERROR', 'q parameter is required');
  }

  try {
    const token = extractBearerToken(req);
    const accounts = await searchFediverseAccounts(q, limit, token || undefined);
    return jsonOk(res, { data: accounts, meta: { total: accounts.length, q } });
  } catch {
    return jsonError(res, 500, 'SEARCH_FAILED', 'Search failed');
  }
}

/**
 * GET /api/gts/export
 *
 * Export GTS data (ActivityPub standard — follows, blocks, etc.)
 * Requires Authorization header.
 */
async function handleExport(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const token = extractBearerToken(req);
  if (!token) {
    return jsonError(res, 401, 'AUTH_REQUIRED', 'Authorization header required');
  }

  try {
    const type =
      new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`).searchParams.get(
        'type',
      ) || 'all';

    const results: Record<string, unknown> = {};

    if (type === 'all' || type === 'following') {
      results.following = await fetchAllPages(`${GTS_BASE}/api/v1/accounts/relationships`, token);
    }
    if (type === 'all' || type === 'followers') {
      results.followers = await fetchAllPages(`${GTS_BASE}/api/v1/accounts/relationships`, token);
    }
    if (type === 'all' || type === 'blocks') {
      results.blocks = await fetchAllPages(`${GTS_BASE}/api/v1/blocks`, token);
    }
    if (type === 'all' || type === 'mutes') {
      results.mutes = await fetchAllPages(`${GTS_BASE}/api/v1/mutes`, token);
    }
    if (type === 'all' || type === 'bookmarks') {
      results.bookmarks = await fetchAllPages(`${GTS_BASE}/api/v1/bookmarks`, token);
    }

    return jsonOk(res, {
      ok: true,
      type,
      exported_at: new Date().toISOString(),
      account: `${GTS_BASE.replace(/http:\/\//, '').replace(/\/$/, '')}`,
      data: results,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return jsonError(res, 500, 'EXPORT_FAILED', msg);
  }
}

/**
 * POST /api/gts/migrate
 *
 * Initiate account migration to another Mastodon/GTS instance.
 * Body: { target_account_uri: string, target_account_password: string }
 * GTS supports the standard Mastodon migration flow.
 */
async function handleMigrate(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const token = extractBearerToken(req);
  if (!token) {
    return jsonError(res, 401, 'AUTH_REQUIRED', 'Authorization header required');
  }

  try {
    const body = await readBody(req);
    const { target_account_uri } = body;

    if (!target_account_uri) {
      return jsonError(res, 400, 'VALIDATION_ERROR', 'target_account_uri is required');
    }

    // POST /api/v1/migration — standard Mastodon migration endpoint
    const migrateRes = await fetch(`${GTS_BASE}/api/v1/migration`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        target_uri: target_account_uri,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!migrateRes.ok) {
      const text = await migrateRes.text().catch(() => '');
      return jsonError(res, migrateRes.status, 'MIGRATION_FAILED', text.slice(0, 200));
    }

    const result = await migrateRes.json();
    return jsonOk(res, {
      ok: true,
      migration: result,
      message: `Migration to ${target_account_uri} initiated. Followers will be redirected.`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return jsonError(res, 500, 'MIGRATION_FAILED', msg);
  }
}

/**
 * GET /api/gts/webfinger
 *
 * Resolve a fediverse identity via WebFinger.
 * Query: resource=acct:user@domain.com
 */
async function handleWebfinger(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const resource = url.searchParams.get('resource') || '';

  if (!resource) {
    return jsonError(
      res,
      400,
      'VALIDATION_ERROR',
      'resource parameter required (e.g., acct:user@domain.com)',
    );
  }

  try {
    const wfRes = await fetch(
      `${GTS_BASE}/.well-known/webfinger?resource=${encodeURIComponent(resource)}`,
      {
        signal: AbortSignal.timeout(5000),
      },
    );

    if (!wfRes.ok) {
      return jsonError(res, 404, 'NOT_FOUND', `WebFinger lookup failed for ${resource}`);
    }

    const data = await wfRes.json();
    return jsonOk(res, data);
  } catch {
    return jsonError(res, 500, 'WEBFINGER_FAILED', 'WebFinger lookup failed');
  }
}

/**
 * Lookup an ActivityPub account on the fediverse.
 * GET /api/gts/lookup?acct=user@instance.com
 */
async function handleLookup(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const acct = url.searchParams.get('acct') || '';

  if (!acct) {
    return jsonError(
      res,
      400,
      'VALIDATION_ERROR',
      'acct parameter required (e.g., user@instance.com)',
    );
  }

  const token = extractBearerToken(req);
  const account = await lookupFediverseAccount(acct, token || undefined);

  if (!account) {
    return jsonError(res, 404, 'NOT_FOUND', `Account ${acct} not found on fediverse`);
  }

  return jsonOk(res, { account });
}

// ─── Internal Helpers ────────────────────────────────────────────────

/**
 * Create a GTS account via the Mastodon-compatible API.
 * GTS must have accounts-registration-open: true (it does).
 */
async function createGtsAccount(
  username: string,
  email: string,
  password: string,
  reason?: string,
): Promise<{
  id: string;
  username: string;
  acct: string;
  display_name: string;
  avatar: string;
  avatar_static: string;
  header: string;
  header_static: string;
  note: string;
  url: string;
  created_at: string;
} | null> {
  const body: Record<string, string> = {
    username,
    email,
    password,
    agreement: 'true',
    locale: 'en',
  };
  if (reason) body.reason = reason;

  const res = await fetch(`${GTS_BASE}/api/v1/accounts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    // 422 = validation error (likely duplicate username/email)
    if (res.status === 422) return null;
    const text = await res.text().catch(() => '');
    console.error(`[gts-routes] Account creation failed (${res.status}):`, text.slice(0, 200));
    return null;
  }

  return res.json();
}

/**
 * Read JSON body from incoming request.
 */
function readBody(req: http.IncomingMessage): Promise<Record<string, any>> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        req.destroy(new Error('Body too large'));
        reject(new Error('Body too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
    // Timeout
    setTimeout(() => reject(new Error('Request timeout')), 15_000);
  });
}

/**
 * Extract Bearer token from Authorization header.
 */
function extractBearerToken(req: http.IncomingMessage): string | null {
  const auth = req.headers.authorization;
  if (!auth) return null;
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

/**
 * Fetch all pages from a GTS API endpoint.
 */
async function fetchAllPages(baseUrl: string, token: string): Promise<any[]> {
  const allItems: any[] = [];
  let url = `${baseUrl}?limit=80`;
  let fetched: any[] | null = null;

  do {
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) break;
      fetched = await res.json();

      if (Array.isArray(fetched)) {
        allItems.push(...fetched);
        // Mastodon-style pagination via Link header
        const linkHeader = res.headers.get('link');
        if (linkHeader) {
          const nextMatch = linkHeader.match(/<([^>]+)>\s*;\s*rel="next"/);
          url = nextMatch ? nextMatch[1] : '';
        } else {
          url = '';
        }
      } else {
        fetched = null;
      }
    } catch {
      break;
    }
  } while (url);

  return allItems;
}

// ─── Router ─────────────────────────────────────────────────────────

/**
 * Handle GTS-related HTTP requests.
 * Returns true if the path was handled, false otherwise.
 */
export async function handleGtsRoute(
  path: string,
  method: string,
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<boolean> {
  // Full registration (creates wallet + GTS + discovers identities)
  if (path === '/api/auth/register' && method === 'POST') {
    await handleFullRegister(req, res);
    return true;
  }

  // GTS-specific routes
  if (path === '/api/gts/register' && method === 'POST') {
    await handleGtsRegister(req, res);
    return true;
  }

  if (path === '/api/gts/auth' && method === 'POST') {
    await handleGtsAuth(req, res);
    return true;
  }

  if (path === '/api/gts/account' && method === 'GET') {
    await handleGetAccount(req, res);
    return true;
  }

  if (path === '/api/gts/federation' && method === 'GET') {
    await handleGetFederation(req, res);
    return true;
  }

  if (path === '/api/gts/follow' && method === 'POST') {
    await handleFollow(req, res);
    return true;
  }

  if (path === '/api/gts/trending' && method === 'GET') {
    await handleTrending(req, res);
    return true;
  }

  if (path === '/api/gts/communities' && method === 'GET') {
    await handleCommunities(req, res);
    return true;
  }

  if (path === '/api/gts/search' && method === 'GET') {
    await handleSearch(req, res);
    return true;
  }

  if (path === '/api/gts/export' && method === 'GET') {
    await handleExport(req, res);
    return true;
  }

  if (path === '/api/gts/migrate' && method === 'POST') {
    await handleMigrate(req, res);
    return true;
  }

  if (path === '/api/gts/webfinger' && method === 'GET') {
    await handleWebfinger(req, res);
    return true;
  }

  if (path === '/api/gts/lookup' && method === 'GET') {
    await handleLookup(req, res);
    return true;
  }

  return false;
}
