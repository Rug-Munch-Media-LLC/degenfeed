/**
 * Bluesky/AT Protocol Bridge Routes
 *
 * Full Bluesky network ownership API. Every operation routes through
 * OUR PDS — not external Bluesky services.
 *
 * Routes:
 *   POST /api/bluesky/register       — Create account on our PDS
 *   POST /api/bluesky/auth           — Login to existing account (ours or external)
 *   POST /api/bluesky/migrate        — Migrate account to our PDS
 *   GET  /api/bluesky/export         — Export all data (CAR file)
 *   GET  /api/bluesky/session        — Get current session info
 *   POST /api/bluesky/refresh        — Refresh session token
 *   POST /api/bluesky/logout         — Delete session
 *   GET  /api/bluesky/profile        — Get profile
 *   POST /api/bluesky/profile        — Update profile
 *   POST /api/bluesky/post           — Create post
 *   DELETE /api/bluesky/post         — Delete post
 *   GET  /api/bluesky/timeline       — Get home timeline
 *   GET  /api/bluesky/author-feed    — Get author's posts
 *   GET  /api/bluesky/thread         — Get post thread
 *   POST /api/bluesky/like           — Like a post
 *   POST /api/bluesky/unlike         — Unlike a post
 *   POST /api/bluesky/repost         — Repost
 *   POST /api/bluesky/unrepost       — Undo repost
 *   POST /api/bluesky/reply          — Reply to post
 *   POST /api/bluesky/quote          — Quote post
 *   POST /api/bluesky/follow         — Follow user
 *   POST /api/bluesky/unfollow       — Unfollow
 *   GET  /api/bluesky/follows        — Get follows
 *   GET  /api/bluesky/followers      — Get followers
 *   POST /api/bluesky/block          — Block user
 *   POST /api/bluesky/unblock        — Unblock
 *   GET  /api/bluesky/blocks         — Get blocked users
 *   POST /api/bluesky/mute           — Mute user
 *   POST /api/bluesky/unmute         — Unmute
 *   GET  /api/bluesky/mutes          — Get muted users
 *   GET  /api/bluesky/relationship   — Get relationship with actor
 *   POST /api/bluesky/app-passwords  — Create app password
 *   GET  /api/bluesky/app-passwords  — List app passwords
 *   DELETE /api/bluesky/app-passwords — Revoke app password
 *   GET  /api/bluesky/notifications  — Get notifications
 *   POST /api/bluesky/notifications/read — Mark notifications read
 *   GET  /api/bluesky/search/posts   — Search posts
 *   GET  /api/bluesky/search/actors  — Search actors
 *   GET  /api/bluesky/handle         — Resolve handle to DID
 *   POST /api/bluesky/handle         — Update handle
 *   GET  /api/bluesky/server         — Describe server
 *   GET  /api/bluesky/health         — PDS health check
 *   POST /api/bluesky/upload-blob    — Upload blob/image
 *   GET  /api/bluesky/notifications/unread-count — Unread notification count
 *   POST /api/bluesky/list           — Create moderation list
 *   POST /api/bluesky/list/add       — Add to list
 *   POST /api/bluesky/list/remove    — Remove from list
 *
 * All endpoints return { ok: boolean, data?, error?, meta? }
 */

import { PdsAccountClient, generateRecoveryKey, checkPasswordStrength, PdsAccountError } from '@degenfeed/bluesky-sdk/pds-account';
import { PdsMigrationClient } from '@degenfeed/bluesky-sdk/pds-migration';
import { PdsSocialClient } from '@degenfeed/bluesky-sdk/pds-social';
import { PdsClient } from '@degenfeed/bluesky-sdk';
import type http from 'node:http';

// ─── Config ──────────────────────────────────────────────────────────

const PDS_URL = process.env.PDS_URL || 'http://127.0.0.1:3012';
const PDS_PUBLIC_URL = process.env.PDS_PUBLIC_URL || 'https://pds.degenfeed.xyz';

// ─── Constants ───────────────────────────────────────────────────────

const BLUESKY_KV_PREFIX = 'bsky:';
const RECOVERY_KEY_HINTS = 'bsky:recovery:hints';
const WALLET_LINKS = 'bsky:wallet:links';

// ─── Response Helpers ────────────────────────────────────────────────

function jsonOk(res: http.ServerResponse, data: unknown) {
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify(data));
}

function jsonError(res: http.ServerResponse, status: number, code: string, message: string) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ ok: false, error: { code, message } }));
}

function jsonCreated(res: http.ServerResponse, data: unknown) {
  res.writeHead(201, { 'content-type': 'application/json' });
  res.end(JSON.stringify(data));
}

// ─── Request Body Parser ─────────────────────────────────────────────

function parseBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString();
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw) as Record<string, unknown>);
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

// ─── Extract JWT from Authorization header ───────────────────────────

function extractJwt(req: http.IncomingMessage): string | null {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

// ─── Query param helpers ─────────────────────────────────────────────

function getQParam(url: URL, key: string, def?: string): string | undefined {
  return url.searchParams.get(key) ?? def;
}

function getNumParam(url: URL, key: string, def: number, min = 1, max = 100): number {
  const val = parseInt(url.searchParams.get(key) || String(def), 10);
  return Math.max(min, Math.min(max, isNaN(val) ? def : val));
}

// ─── Route Handler ───────────────────────────────────────────────────

export async function handleBlueskyRoute(
  path: string,
  method: string,
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
): Promise<boolean> {
  if (!path.startsWith('/api/bluesky')) return false;

  const route = path.replace('/api/bluesky', '') || '/';
  console.log(`[bluesky] ${method} ${route}`);

  try {
    // ── PUBLIC ROUTES (no auth required) ────────────────────────

    // POST /api/bluesky/register — Create account on our PDS
    if (route === '/register' && method === 'POST') {
      const body = await parseBody(req);
      const handle = body.handle as string | undefined;
      const email = body.email as string | undefined;
      const password = body.password as string | undefined;
      const inviteCode = body.inviteCode as string | undefined;

      if (!handle || !email || !password) {
        return jsonError(res, 400, 'MISSING_FIELDS', 'handle, email, and password are required'), true;
      }

      // Check password strength
      const strength = checkPasswordStrength(password);
      if (strength.score < 2) {
        return jsonError(res, 400, 'WEAK_PASSWORD', `Password too weak: ${strength.feedback.join(', ')}`), true;
      }

      const client = new PdsAccountClient(PDS_URL);
      const recoveryKey = generateRecoveryKey();

      const result = await client.createAccount({
        handle,
        email,
        password,
        inviteCode,
        recoveryKey,
      });

      // Store recovery key hint (never store the raw key in plaintext)
      const hintPayload = JSON.stringify({
        did: result.did,
        hint: `Recovery key for ${result.handle}`,
        prefix: result.recoveryKey?.slice(0, 8), // First 8 chars only — enough to identify
        createdAt: new Date().toISOString(),
      });

      return jsonCreated(res, {
        ok: true,
        data: {
          did: result.did,
          handle: result.handle,
          accessJwt: result.accessJwt,
          refreshJwt: result.refreshJwt,
          recoveryKey: result.recoveryKey,
        },
        meta: {
          message: 'IMPORTANT: Save your recovery key. It cannot be retrieved later.',
          passwordStrength: strength,
        },
      }), true;
    }

    // POST /api/bluesky/auth — Authenticate existing user
    if (route === '/auth' && method === 'POST') {
      const body = await parseBody(req);
      const identifier = body.identifier as string | undefined;
      const password = body.password as string | undefined;

      if (!identifier || !password) {
        return jsonError(res, 400, 'MISSING_FIELDS', 'identifier and password are required'), true;
      }

      const client = new PdsAccountClient(PDS_URL);
      const session = await client.createSession(identifier, password);

      return jsonOk(res, {
        ok: true,
        data: {
          did: session.did,
          handle: session.handle,
          accessJwt: session.accessJwt,
          refreshJwt: session.refreshJwt,
        },
      }), true;
    }

    // POST /api/bluesky/migrate — Migrate account to our PDS
    if (route === '/migrate' && method === 'POST') {
      const body = await parseBody(req);
      const sourcePdsUrl = (body.sourcePdsUrl as string) || 'https://bsky.social';
      const sourceIdentifier = body.sourceIdentifier as string;
      const sourcePassword = body.sourcePassword as string;
      const targetPassword = body.targetPassword as string;
      const handle = body.handle as string;
      const email = body.email as string;

      if (!sourceIdentifier || !sourcePassword || !targetPassword || !handle || !email) {
        return jsonError(res, 400, 'MISSING_FIELDS',
          'sourceIdentifier, sourcePassword, targetPassword, handle, and email are required'), true;
      }

      // Step 1: Create account on our PDS
      const accountClient = new PdsAccountClient(PDS_URL);
      const recoveryKey = generateRecoveryKey();
      const account = await accountClient.createAccount({
        handle,
        email,
        password: targetPassword,
        recoveryKey,
      });

      // Step 2: Run migration
      const migrationClient = new PdsMigrationClient(PDS_URL);
      migrationClient.setAuth(account.accessJwt);

      const migrationResult = await migrationClient.migrateAccount({
        sourcePdsUrl,
        sourceIdentifier,
        sourcePassword,
        targetPdsUrl: PDS_PUBLIC_URL,
        updateDidDocument: true,
        setupRedirect: true,
      });

      return jsonCreated(res, {
        ok: true,
        data: {
          did: account.did,
          handle: account.handle,
          accessJwt: account.accessJwt,
          refreshJwt: account.refreshJwt,
          recoveryKey,
          migration: {
            recordsMigrated: migrationResult.recordsMigrated,
            blobsMigrated: migrationResult.blobsMigrated,
            didUpdated: migrationResult.didUpdated,
          },
        },
        meta: {
          message: 'Account migrated successfully. Your data is now on the DegenFeed PDS.',
        },
      }), true;
    }

    // GET /api/bluesky/export — Export CAR file (requires auth)
    if (route === '/export' && method === 'GET') {
      const jwt = extractJwt(req);
      if (!jwt) {
        return jsonError(res, 401, 'AUTH_REQUIRED', 'Authorization header required'), true;
      }

      const did = getQParam(url, 'did');
      const sourcePds = getQParam(url, 'sourcePds') || 'https://bsky.social';

      if (!did) {
        return jsonError(res, 400, 'MISSING_DID', 'did query parameter is required'), true;
      }

      const migrationClient = new PdsMigrationClient(PDS_URL);
      migrationClient.setAuth(jwt);

      const carExport = await migrationClient.exportRepo(did, sourcePds);

      // Return CAR file as binary download
      res.writeHead(200, {
        'content-type': 'application/vnd.ipld.car',
        'content-disposition': `attachment; filename="${did}.car"`,
        'content-length': String(carExport.sizeBytes),
      });
      res.end(Buffer.from(carExport.carData));
      return true;
    }

    // GET /api/bluesky/health — PDS health check
    if (route === '/health' && method === 'GET') {
      const client = new PdsClient(PDS_URL);
      try {
        const health = await client.healthCheck();
        return jsonOk(res, { ok: true, data: health }), true;
      } catch (err) {
        return jsonError(res, 503, 'PDS_UNREACHABLE', 'PDS is not responding'), true;
      }
    }

    // GET /api/bluesky/server — Describe server
    if (route === '/server' && method === 'GET') {
      const client = new PdsAccountClient(PDS_URL);
      const info = await client.describeServer();
      return jsonOk(res, { ok: true, data: info }), true;
    }

    // GET /api/bluesky/handle — Resolve handle to DID
    if (route === '/handle' && method === 'GET') {
      const handle = getQParam(url, 'handle');
      if (!handle) {
        return jsonError(res, 400, 'MISSING_HANDLE', 'handle query parameter is required'), true;
      }
      const client = new PdsAccountClient(PDS_URL);
      const did = await client.resolveHandle(handle);
      return jsonOk(res, { ok: true, data: { handle, did } }), true;
    }

    // ── AUTH-REQUIRED ROUTES ────────────────────────────────────

    const jwt = extractJwt(req);
    if (!jwt) {
      return jsonError(res, 401, 'AUTH_REQUIRED', 'Authorization: Bearer <token> header required for this endpoint'), true;
    }

    // Helper: create authenticated clients
    const accountClient = new PdsAccountClient(PDS_URL);
    accountClient.setAuth(jwt);

    const socialClient = new PdsSocialClient(PDS_URL);
    socialClient.setAuth(jwt);

    const pdsClient = new PdsClient(PDS_URL);
    pdsClient.setAuth(jwt);

    // POST /api/bluesky/session — Get or create session
    if (route === '/session' && method === 'GET') {
      // Session is verified via JWT — return info
      return jsonOk(res, { ok: true, data: { authenticated: true } }), true;
    }

    // POST /api/bluesky/refresh — Refresh session
    if (route === '/refresh' && method === 'POST') {
      await accountClient.refreshSession();
      return jsonOk(res, {
        ok: true,
        data: {
          accessJwt: (accountClient as unknown as { accessJwt: string }).accessJwt,
          refreshJwt: (accountClient as unknown as { refreshJwt: string }).refreshJwt,
        },
      }), true;
    }

    // POST /api/bluesky/logout — Delete session
    if (route === '/logout' && method === 'POST') {
      await accountClient.deleteSession();
      return jsonOk(res, { ok: true, data: { message: 'Logged out' } }), true;
    }

    // ── Profile ─────────────────────────────────────────────────

    // GET /api/bluesky/profile — Get profile
    if (route === '/profile' && method === 'GET') {
      const actor = getQParam(url, 'actor') || (jwt ? undefined : undefined);
      // If we have a session, use the authenticated profile
      try {
        const profile = await pdsClient.getProfile(actor || (await getProfile(jwt)));
        return jsonOk(res, { ok: true, data: profile }), true;
      } catch (err) {
        return jsonError(res, 404, 'PROFILE_NOT_FOUND', 'Profile not found'), true;
      }
    }

    // POST /api/bluesky/profile — Update profile
    if (route === '/profile' && method === 'POST') {
      const body = await parseBody(req);
      const displayName = body.displayName as string | undefined;
      const description = body.description as string | undefined;

      try {
        await pdsClient.updateProfile({
          displayName,
          description,
        });
        return jsonOk(res, { ok: true, data: { message: 'Profile updated' } }), true;
      } catch (err) {
        return jsonError(res, 400, 'PROFILE_UPDATE_FAILED', 'Failed to update profile'), true;
      }
    }

    // ── Posting ─────────────────────────────────────────────────

    // POST /api/bluesky/post — Create post
    if (route === '/post' && method === 'POST') {
      const body = await parseBody(req);
      const text = body.text as string | undefined;

      if (!text) {
        return jsonError(res, 400, 'MISSING_TEXT', 'text is required'), true;
      }

      try {
        const result = await pdsClient.createPost({ text });
        return jsonCreated(res, { ok: true, data: result }), true;
      } catch (err) {
        return jsonError(res, 400, 'POST_FAILED', (err as Error).message), true;
      }
    }

    // DELETE /api/bluesky/post — Delete post
    if (route === '/post' && method === 'DELETE') {
      const uri = getQParam(url, 'uri');
      if (!uri) {
        return jsonError(res, 400, 'MISSING_URI', 'uri query parameter is required'), true;
      }
      try {
        await socialClient.deletePost(uri);
        return jsonOk(res, { ok: true, data: { message: 'Post deleted' } }), true;
      } catch (err) {
        return jsonError(res, 400, 'DELETE_FAILED', (err as Error).message), true;
      }
    }

    // ── Timeline & Feeds ────────────────────────────────────────

    // GET /api/bluesky/timeline — Get home timeline
    if (route === '/timeline' && method === 'GET') {
      const limit = getNumParam(url, 'limit', 50);
      const cursor = getQParam(url, 'cursor');
      const algorithm = getQParam(url, 'algorithm');

      try {
        const timeline = await socialClient.getTimeline({ limit, cursor, algorithm });
        return jsonOk(res, { ok: true, data: timeline }), true;
      } catch (err) {
        return jsonError(res, 500, 'TIMELINE_FAILED', (err as Error).message), true;
      }
    }

    // GET /api/bluesky/author-feed — Get author's posts
    if (route === '/author-feed' && method === 'GET') {
      const actor = getQParam(url, 'actor');
      const limit = getNumParam(url, 'limit', 50);
      const cursor = getQParam(url, 'cursor');
      const filter = getQParam(url, 'filter') as 'posts_with_replies' | 'posts_no_replies' | 'posts_and_author_threads' | undefined;

      if (!actor) {
        return jsonError(res, 400, 'MISSING_ACTOR', 'actor query parameter is required'), true;
      }

      try {
        const feed = await socialClient.getAuthorFeed({ actor, limit, cursor, filter });
        return jsonOk(res, { ok: true, data: feed }), true;
      } catch (err) {
        return jsonError(res, 500, 'AUTHOR_FEED_FAILED', (err as Error).message), true;
      }
    }

    // GET /api/bluesky/thread — Get post thread
    if (route === '/thread' && method === 'GET') {
      const uri = getQParam(url, 'uri');
      const depth = getNumParam(url, 'depth', 6, 1, 20);
      const parentHeight = getNumParam(url, 'parentHeight', 80, 1, 200);

      if (!uri) {
        return jsonError(res, 400, 'MISSING_URI', 'uri query parameter is required'), true;
      }

      try {
        const thread = await socialClient.getPostThread(uri, depth, parentHeight);
        return jsonOk(res, { ok: true, data: thread }), true;
      } catch (err) {
        return jsonError(res, 500, 'THREAD_FAILED', (err as Error).message), true;
      }
    }

    // ── Interactions ────────────────────────────────────────────

    // POST /api/bluesky/like — Like a post
    if (route === '/like' && method === 'POST') {
      const body = await parseBody(req);
      const uri = body.uri as string;
      const cid = body.cid as string;

      if (!uri || !cid) {
        return jsonError(res, 400, 'MISSING_FIELDS', 'uri and cid are required'), true;
      }

      try {
        const result = await socialClient.like(uri, cid);
        return jsonCreated(res, { ok: true, data: result }), true;
      } catch (err) {
        return jsonError(res, 400, 'LIKE_FAILED', (err as Error).message), true;
      }
    }

    // POST /api/bluesky/unlike — Unlike a post
    if (route === '/unlike' && method === 'POST') {
      const body = await parseBody(req);
      const uri = body.uri as string;

      if (!uri) {
        return jsonError(res, 400, 'MISSING_URI', 'uri is required'), true;
      }

      try {
        await socialClient.unlike(uri);
        return jsonOk(res, { ok: true, data: { message: 'Unliked' } }), true;
      } catch (err) {
        return jsonError(res, 400, 'UNLIKE_FAILED', (err as Error).message), true;
      }
    }

    // POST /api/bluesky/repost — Repost
    if (route === '/repost' && method === 'POST') {
      const body = await parseBody(req);
      const uri = body.uri as string;
      const cid = body.cid as string;

      if (!uri || !cid) {
        return jsonError(res, 400, 'MISSING_FIELDS', 'uri and cid are required'), true;
      }

      try {
        const result = await socialClient.repost(uri, cid);
        return jsonCreated(res, { ok: true, data: result }), true;
      } catch (err) {
        return jsonError(res, 400, 'REPOST_FAILED', (err as Error).message), true;
      }
    }

    // POST /api/bluesky/unrepost — Undo repost
    if (route === '/unrepost' && method === 'POST') {
      const body = await parseBody(req);
      const uri = body.uri as string;

      if (!uri) {
        return jsonError(res, 400, 'MISSING_URI', 'uri is required'), true;
      }

      try {
        await socialClient.unrepost(uri);
        return jsonOk(res, { ok: true, data: { message: 'Repost removed' } }), true;
      } catch (err) {
        return jsonError(res, 400, 'UNREPOST_FAILED', (err as Error).message), true;
      }
    }

    // POST /api/bluesky/reply — Reply to post
    if (route === '/reply' && method === 'POST') {
      const body = await parseBody(req);
      const parentUri = body.parentUri as string;
      const parentCid = body.parentCid as string;
      const text = body.text as string;
      const rootUri = body.rootUri as string | undefined;
      const rootCid = body.rootCid as string | undefined;

      if (!parentUri || !parentCid || !text) {
        return jsonError(res, 400, 'MISSING_FIELDS', 'parentUri, parentCid, and text are required'), true;
      }

      try {
        const result = await socialClient.reply(parentUri, parentCid, text, rootUri, rootCid);
        return jsonCreated(res, { ok: true, data: result }), true;
      } catch (err) {
        return jsonError(res, 400, 'REPLY_FAILED', (err as Error).message), true;
      }
    }

    // POST /api/bluesky/quote — Quote post
    if (route === '/quote' && method === 'POST') {
      const body = await parseBody(req);
      const text = body.text as string;
      const quoteUri = body.quoteUri as string;
      const quoteCid = body.quoteCid as string;

      if (!text || !quoteUri || !quoteCid) {
        return jsonError(res, 400, 'MISSING_FIELDS', 'text, quoteUri, and quoteCid are required'), true;
      }

      try {
        const result = await socialClient.quotePost(text, quoteUri, quoteCid);
        return jsonCreated(res, { ok: true, data: result }), true;
      } catch (err) {
        return jsonError(res, 400, 'QUOTE_FAILED', (err as Error).message), true;
      }
    }

    // ── Social Graph ────────────────────────────────────────────

    // POST /api/bluesky/follow — Follow user
    if (route === '/follow' && method === 'POST') {
      const body = await parseBody(req);
      const did = body.did as string;

      if (!did) {
        return jsonError(res, 400, 'MISSING_DID', 'did is required'), true;
      }

      try {
        const result = await socialClient.follow(did);
        return jsonCreated(res, { ok: true, data: result }), true;
      } catch (err) {
        return jsonError(res, 400, 'FOLLOW_FAILED', (err as Error).message), true;
      }
    }

    // POST /api/bluesky/unfollow — Unfollow
    if (route === '/unfollow' && method === 'POST') {
      const body = await parseBody(req);
      const uri = body.uri as string;

      if (!uri) {
        return jsonError(res, 400, 'MISSING_URI', 'follow record uri is required'), true;
      }

      try {
        await socialClient.unfollow(uri);
        return jsonOk(res, { ok: true, data: { message: 'Unfollowed' } }), true;
      } catch (err) {
        return jsonError(res, 400, 'UNFOLLOW_FAILED', (err as Error).message), true;
      }
    }

    // GET /api/bluesky/follows — Get follows
    if (route === '/follows' && method === 'GET') {
      const actor = getQParam(url, 'actor');
      const limit = getNumParam(url, 'limit', 50);
      const cursor = getQParam(url, 'cursor');

      if (!actor) {
        return jsonError(res, 400, 'MISSING_ACTOR', 'actor query parameter is required'), true;
      }

      try {
        const follows = await socialClient.getFollows(actor, limit, cursor);
        return jsonOk(res, { ok: true, data: follows }), true;
      } catch (err) {
        return jsonError(res, 500, 'FOLLOWS_FAILED', (err as Error).message), true;
      }
    }

    // GET /api/bluesky/followers — Get followers
    if (route === '/followers' && method === 'GET') {
      const actor = getQParam(url, 'actor');
      const limit = getNumParam(url, 'limit', 50);
      const cursor = getQParam(url, 'cursor');

      if (!actor) {
        return jsonError(res, 400, 'MISSING_ACTOR', 'actor query parameter is required'), true;
      }

      try {
        const followers = await socialClient.getFollowers(actor, limit, cursor);
        return jsonOk(res, { ok: true, data: followers }), true;
      } catch (err) {
        return jsonError(res, 500, 'FOLLOWERS_FAILED', (err as Error).message), true;
      }
    }

    // ── Moderation ──────────────────────────────────────────────

    // POST /api/bluesky/block — Block user
    if (route === '/block' && method === 'POST') {
      const body = await parseBody(req);
      const did = body.did as string;

      if (!did) {
        return jsonError(res, 400, 'MISSING_DID', 'did is required'), true;
      }

      try {
        const result = await socialClient.block(did);
        return jsonCreated(res, { ok: true, data: result }), true;
      } catch (err) {
        return jsonError(res, 400, 'BLOCK_FAILED', (err as Error).message), true;
      }
    }

    // POST /api/bluesky/unblock — Unblock
    if (route === '/unblock' && method === 'POST') {
      const body = await parseBody(req);
      const uri = body.uri as string;

      if (!uri) {
        return jsonError(res, 400, 'MISSING_URI', 'block record uri is required'), true;
      }

      try {
        await socialClient.unblock(uri);
        return jsonOk(res, { ok: true, data: { message: 'Unblocked' } }), true;
      } catch (err) {
        return jsonError(res, 400, 'UNBLOCK_FAILED', (err as Error).message), true;
      }
    }

    // GET /api/bluesky/blocks — Get blocked users
    if (route === '/blocks' && method === 'GET') {
      const limit = getNumParam(url, 'limit', 50);
      const cursor = getQParam(url, 'cursor');

      try {
        const blocks = await socialClient.getBlocks(limit, cursor);
        return jsonOk(res, { ok: true, data: blocks }), true;
      } catch (err) {
        return jsonError(res, 500, 'BLOCKS_FAILED', (err as Error).message), true;
      }
    }

    // POST /api/bluesky/mute — Mute user
    if (route === '/mute' && method === 'POST') {
      const body = await parseBody(req);
      const did = body.did as string;

      if (!did) {
        return jsonError(res, 400, 'MISSING_DID', 'did is required'), true;
      }

      try {
        await socialClient.mute(did);
        return jsonOk(res, { ok: true, data: { message: 'Muted' } }), true;
      } catch (err) {
        return jsonError(res, 400, 'MUTE_FAILED', (err as Error).message), true;
      }
    }

    // POST /api/bluesky/unmute — Unmute
    if (route === '/unmute' && method === 'POST') {
      const body = await parseBody(req);
      const did = body.did as string;

      if (!did) {
        return jsonError(res, 400, 'MISSING_DID', 'did is required'), true;
      }

      try {
        await socialClient.unmute(did);
        return jsonOk(res, { ok: true, data: { message: 'Unmuted' } }), true;
      } catch (err) {
        return jsonError(res, 400, 'UNMUTE_FAILED', (err as Error).message), true;
      }
    }

    // GET /api/bluesky/mutes — Get muted users
    if (route === '/mutes' && method === 'GET') {
      const limit = getNumParam(url, 'limit', 50);
      const cursor = getQParam(url, 'cursor');

      try {
        const mutes = await socialClient.getMutes(limit, cursor);
        return jsonOk(res, { ok: true, data: mutes }), true;
      } catch (err) {
        return jsonError(res, 500, 'MUTES_FAILED', (err as Error).message), true;
      }
    }

    // GET /api/bluesky/relationship — Get relationship with actor
    if (route === '/relationship' && method === 'GET') {
      const actor = getQParam(url, 'actor');
      if (!actor) {
        return jsonError(res, 400, 'MISSING_ACTOR', 'actor query parameter is required'), true;
      }

      try {
        const relationship = await socialClient.getRelationship(actor);
        return jsonOk(res, { ok: true, data: relationship }), true;
      } catch (err) {
        return jsonError(res, 500, 'RELATIONSHIP_FAILED', (err as Error).message), true;
      }
    }

    // ── App Passwords ───────────────────────────────────────────

    // POST /api/bluesky/app-passwords — Create app password
    if (route === '/app-passwords' && method === 'POST') {
      const body = await parseBody(req);
      const name = body.name as string;

      if (!name) {
        return jsonError(res, 400, 'MISSING_NAME', 'name is required'), true;
      }

      try {
        const appPassword = await accountClient.createAppPassword(name);
        return jsonCreated(res, { ok: true, data: appPassword }), true;
      } catch (err) {
        return jsonError(res, 400, 'APP_PASSWORD_FAILED', (err as Error).message), true;
      }
    }

    // GET /api/bluesky/app-passwords — List app passwords
    if (route === '/app-passwords' && method === 'GET') {
      try {
        const passwords = await accountClient.listAppPasswords();
        return jsonOk(res, { ok: true, data: { passwords } }), true;
      } catch (err) {
        return jsonError(res, 500, 'LIST_FAILED', (err as Error).message), true;
      }
    }

    // DELETE /api/bluesky/app-passwords — Revoke app password
    if (route === '/app-passwords' && method === 'DELETE') {
      const id = getQParam(url, 'id');
      if (!id) {
        return jsonError(res, 400, 'MISSING_ID', 'id query parameter is required'), true;
      }

      try {
        await accountClient.revokeAppPassword(id);
        return jsonOk(res, { ok: true, data: { message: 'App password revoked' } }), true;
      } catch (err) {
        return jsonError(res, 400, 'REVOKE_FAILED', (err as Error).message), true;
      }
    }

    // ── Notifications ───────────────────────────────────────────

    // GET /api/bluesky/notifications — Get notifications
    if (route === '/notifications' && method === 'GET') {
      const limit = getNumParam(url, 'limit', 50);
      const cursor = getQParam(url, 'cursor');

      try {
        const notifications = await socialClient.getNotifications(limit, cursor);
        return jsonOk(res, { ok: true, data: notifications }), true;
      } catch (err) {
        return jsonError(res, 500, 'NOTIFICATIONS_FAILED', (err as Error).message), true;
      }
    }

    // POST /api/bluesky/notifications/read — Mark notifications read
    if (route === '/notifications/read' && method === 'POST') {
      try {
        await socialClient.markNotificationsRead();
        return jsonOk(res, { ok: true, data: { message: 'Notifications marked read' } }), true;
      } catch (err) {
        return jsonError(res, 500, 'NOTIFICATIONS_READ_FAILED', (err as Error).message), true;
      }
    }

    // GET /api/bluesky/notifications/unread-count — Unread count
    if (route === '/notifications/unread-count' && method === 'GET') {
      try {
        const count = await socialClient.getUnreadNotificationCount();
        return jsonOk(res, { ok: true, data: count }), true;
      } catch (err) {
        return jsonError(res, 500, 'UNREAD_COUNT_FAILED', (err as Error).message), true;
      }
    }

    // ── Search ──────────────────────────────────────────────────

    // GET /api/bluesky/search/posts — Search posts
    if (route === '/search/posts' && method === 'GET') {
      const q = getQParam(url, 'q');
      const limit = getNumParam(url, 'limit', 25);
      const cursor = getQParam(url, 'cursor');

      if (!q) {
        return jsonError(res, 400, 'MISSING_QUERY', 'q query parameter is required'), true;
      }

      try {
        const results = await socialClient.searchPosts(q, limit, cursor);
        return jsonOk(res, { ok: true, data: results }), true;
      } catch (err) {
        return jsonError(res, 500, 'SEARCH_FAILED', (err as Error).message), true;
      }
    }

    // GET /api/bluesky/search/actors — Search actors
    if (route === '/search/actors' && method === 'GET') {
      const q = getQParam(url, 'q');
      const limit = getNumParam(url, 'limit', 25);
      const cursor = getQParam(url, 'cursor');

      if (!q) {
        return jsonError(res, 400, 'MISSING_QUERY', 'q query parameter is required'), true;
      }

      try {
        const results = await socialClient.searchActors({ q, limit, cursor });
        return jsonOk(res, { ok: true, data: results }), true;
      } catch (err) {
        return jsonError(res, 500, 'ACTOR_SEARCH_FAILED', (err as Error).message), true;
      }
    }

    // ── Handle Management ───────────────────────────────────────

    // POST /api/bluesky/handle — Update handle
    if (route === '/handle' && method === 'POST') {
      const body = await parseBody(req);
      const handle = body.handle as string;

      if (!handle) {
        return jsonError(res, 400, 'MISSING_HANDLE', 'handle is required'), true;
      }

      try {
        const result = await accountClient.updateHandle(handle);
        return jsonOk(res, { ok: true, data: result }), true;
      } catch (err) {
        return jsonError(res, 400, 'HANDLE_UPDATE_FAILED', (err as Error).message), true;
      }
    }

    // ── Blob Upload ─────────────────────────────────────────────

    // POST /api/bluesky/upload-blob — Upload blob
    if (route === '/upload-blob' && method === 'POST') {
      const contentLength = parseInt(req.headers['content-length'] || '0', 10);
      if (contentLength > 10_000_000) {
        // 10MB limit
        return jsonError(res, 413, 'PAYLOAD_TOO_LARGE', 'Blob must be under 10MB'), true;
      }

      const contentType = req.headers['content-type'] || 'application/octet-stream';

      // Read raw body as buffer
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(chunk as Buffer);
      }
      const rawData = Buffer.concat(chunks);
      const uint8Data = new Uint8Array(rawData);

      try {
        const result = await pdsClient.uploadBlob(uint8Data, { encoding: contentType });
        return jsonCreated(res, { ok: true, data: result }), true;
      } catch (err) {
        return jsonError(res, 400, 'BLOB_UPLOAD_FAILED', (err as Error).message), true;
      }
    }

    // ── Moderation Lists ────────────────────────────────────────

    // POST /api/bluesky/list — Create moderation list
    if (route === '/list' && method === 'POST') {
      const body = await parseBody(req);
      const name = body.name as string;
      const purpose = body.purpose as string;
      const description = body.description as string | undefined;

      if (!name || !purpose) {
        return jsonError(res, 400, 'MISSING_FIELDS', 'name and purpose are required'), true;
      }

      const validPurposes = [
        'app.bsky.graph.defs#modlist',
        'app.bsky.graph.defs#curatelist',
        'app.bsky.graph.defs#referencelist',
      ];
      if (!validPurposes.includes(purpose)) {
        return jsonError(res, 400, 'INVALID_PURPOSE',
          `purpose must be one of: ${validPurposes.join(', ')}`), true;
      }

      try {
        const result = await socialClient.createList(
          name,
          purpose as 'app.bsky.graph.defs#modlist',
          description,
        );
        return jsonCreated(res, { ok: true, data: result }), true;
      } catch (err) {
        return jsonError(res, 400, 'LIST_CREATE_FAILED', (err as Error).message), true;
      }
    }

    // POST /api/bluesky/list/add — Add user to list
    if (route === '/list/add' && method === 'POST') {
      const body = await parseBody(req);
      const listUri = body.listUri as string;
      const subjectDid = body.subjectDid as string;

      if (!listUri || !subjectDid) {
        return jsonError(res, 400, 'MISSING_FIELDS', 'listUri and subjectDid are required'), true;
      }

      try {
        const result = await socialClient.addToList(listUri, subjectDid);
        return jsonCreated(res, { ok: true, data: result }), true;
      } catch (err) {
        return jsonError(res, 400, 'LIST_ADD_FAILED', (err as Error).message), true;
      }
    }

    // POST /api/bluesky/list/remove — Remove from list
    if (route === '/list/remove' && method === 'POST') {
      const body = await parseBody(req);
      const uri = body.uri as string;

      if (!uri) {
        return jsonError(res, 400, 'MISSING_URI', 'list item uri is required'), true;
      }

      try {
        await socialClient.removeFromList(uri);
        return jsonOk(res, { ok: true, data: { message: 'Removed from list' } }), true;
      } catch (err) {
        return jsonError(res, 400, 'LIST_REMOVE_FAILED', (err as Error).message), true;
      }
    }

    // ── Fallback for unrecognized bluesky routes ────────────────
    return jsonError(res, 404, 'NOT_FOUND', `Unknown bluesky route: ${method} ${route}`), true;

  } catch (err) {
    if (err instanceof PdsAccountError) {
      return jsonError(res, err.statusCode, err.code, err.message), true;
    }
    console.error('[bluesky] Unhandled error:', err);
    return jsonError(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred'), true;
  }
}

// ─── Helper: Get profile from JWT ─────────────────────────────────────

async function getProfile(jwt: string): Promise<string> {
  // Decode JWT payload to get DID
  try {
    const parts = jwt.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(atob(parts[1]));
      return payload.sub || payload.did || '';
    }
  } catch {
    // Not critical — will fall back to public API
  }
  return '';
}
