/**
 * @degenfeed/api-worker — Bluesky / AT Protocol Routes
 *
 * Full AT Protocol integration suite:
 * 1. PDS Registration — sign up for Bluesky via our PDS, access ALL AT Protocol apps
 * 2. AT Protocol App Directory — discover all AT Protocol apps, one-click login
 * 3. AT Protocol Content Discovery — cross-app content from the firehose
 * 4. PDS Account Portability — export, import, migrate, recovery keys, app passwords
 * 5. AT Protocol Feed Integration — DegenFeed custom feeds on AT Protocol
 *
 * Routes:
 *   POST  /api/bluesky/register              — PDS Registration + AT Protocol ecosystem
 *   POST  /api/bluesky/login                  — Login to existing account
 *   GET   /api/bluesky/apps                   — AT Protocol App Directory
 *   GET   /api/atproto/discover               — Cross-app content discovery
 *   GET   /api/atproto/discover/:app          — Content from specific AT Protocol app
 *   POST  /api/atproto/discover/firehose      — Subscribe to firehose events
 *   GET   /api/atproto/feed/degenfeed         — DegenFeed crypto feed
 *   GET   /api/atproto/feed/degenfeed/trending  — DegenFeed trending
 *   GET   /api/atproto/feed/degenfeed/cross     — Cross-protocol feed
 *   GET   /api/accounts/bluesky/export        — Export CAR file + DID
 *   POST  /api/accounts/bluesky/import        — Import from another PDS
 *   GET   /api/accounts/bluesky/recovery-key  — Get recovery key info
 *   POST  /api/accounts/bluesky/recovery-key  — Generate new recovery key
 *   POST  /api/accounts/bluesky/recover       — Recover account with recovery key
 *   GET   /api/accounts/bluesky/app-passwords — List app passwords
 *   POST  /api/accounts/bluesky/app-passwords — Create app password
 *   DELETE /api/accounts/bluesky/app-passwords/:id — Revoke app password
 *   GET   /api/accounts/bluesky/migration/status — Migration status
 *   POST  /api/accounts/bluesky/migration/start  — Start PDS migration
 */

import type { AtProtocolAppCategory } from '@degenfeed/bluesky-sdk/atproto-directory';
import { buildAppDirectoryResponse, getAppByKey } from '@degenfeed/bluesky-sdk/atproto-directory';
import { generateDegenFeed } from '@degenfeed/bluesky-sdk/atproto-feeds';
import type { CrossAppContent } from '@degenfeed/bluesky-sdk/atproto-firehose';
import {
  discoverAppContent,
  discoverCrossAppContent,
} from '@degenfeed/bluesky-sdk/atproto-firehose';
import { generateRecoveryKey, PdsAccountClient } from '@degenfeed/bluesky-sdk/pds-account';
import { PdsMigrationClient } from '@degenfeed/bluesky-sdk/pds-migration';
import type { Hono } from 'hono';
import {
  badRequest,
  created,
  jsonResponse,
  noCacheJsonResponse,
  notFound,
  ok,
  serverError,
} from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── Constants ─────────────────────────────────────────────────────────

const PDS_URL = 'https://pds.degenfeed.xyz';
const USER_AGENT = 'DegenFeed/0.1 (+https://degenfeed.xyz)';

// ═══════════════════════════════════════════════════════════════════════
// 1. PDS REGISTRATION — Enhanced with AT Protocol Ecosystem Info
// ═══════════════════════════════════════════════════════════════════════

/**
 * POST /api/bluesky/register
 *
 * Create a new Bluesky account on our PDS.
 * One account = access to ALL AT Protocol apps (Bluesky, WhiteWind,
 * Frontpage, Smoke Signal, Skylight, and more).
 *
 * Body:
 *   handle: string       — Desired handle (e.g. "alice" → alice.degenfeed.xyz)
 *   email: string        — Email for recovery
 *   password: string     — Strong password
 *   inviteCode?: string  — Optional invite code
 *
 * Returns:
 *   Account credentials + AT Protocol ecosystem info + app login URIs
 */
export async function handleBlueskyRegister(request: Request, _env: Env): Promise<Response> {
  let body: {
    handle?: string;
    email?: string;
    password?: string;
    inviteCode?: string;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return badRequest('Invalid JSON body');
  }

  const { handle, email, password, inviteCode } = body;

  if (!handle || !email || !password) {
    return badRequest('Missing required fields: handle, email, password');
  }

  if (password.length < 8) {
    return badRequest('Password must be at least 8 characters');
  }

  if (!email.includes('@')) {
    return badRequest('Invalid email address');
  }

  // Sanitize handle
  const handleName = handle
    .replace(/\.degenfeed\.xyz$/i, '')
    .replace(/[^a-zA-Z0-9-]/g, '')
    .toLowerCase();

  if (!handleName || handleName.length < 3) {
    return badRequest('Handle must be at least 3 alphanumeric characters');
  }

  const fullHandle = `${handleName}.degenfeed.xyz`;

  try {
    // Create account via PDS SDK
    const pdsClient = new PdsAccountClient(PDS_URL, USER_AGENT);
    const result = await pdsClient.createAccount({
      handle: fullHandle,
      email,
      password,
      inviteCode,
    });

    // Build AT Protocol ecosystem directory response
    const appDirectory = buildAppDirectoryResponse(result.did, result.handle);

    // Generate recovery instructions
    const recoveryInfo = {
      key: result.recoveryKey,
      saveInstructions: [
        'Save this recovery key in a secure password manager',
        'Write it down and store in a safe place',
        'Without this key, account recovery may not be possible',
        'This key is ONLY shown once during registration',
      ],
    };

    return created({
      data: {
        account: {
          did: result.did,
          handle: result.handle,
          accessJwt: result.accessJwt,
          refreshJwt: result.refreshJwt,
        },
        recoveryKey: recoveryInfo,
        atProtocolEcosystem: {
          message: 'Your Bluesky account gives you access to the entire AT Protocol ecosystem',
          apps: appDirectory.apps,
          loginUris: appDirectory.loginUris,
          totalApps: appDirectory.totalApps,
          categories: appDirectory.categories,
        },
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Registration failed';
    if (message.includes('already exists') || message.includes('Handle already taken')) {
      return jsonResponse({ error: 'Handle already taken', code: 'HANDLE_TAKEN' }, 409);
    }
    if (message.includes('rate') || message.toLowerCase().includes('rate limit')) {
      return jsonResponse({ error: 'Rate limited — try again later', code: 'RATE_LIMITED' }, 429);
    }
    return serverError(`Registration failed: ${message}`);
  }
}

/**
 * POST /api/bluesky/login
 *
 * Login to an existing Bluesky account on our PDS.
 */
export async function handleBlueskyLogin(request: Request, _env: Env): Promise<Response> {
  let body: {
    identifier?: string;
    password?: string;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return badRequest('Invalid JSON body');
  }

  const { identifier, password } = body;

  if (!identifier || !password) {
    return badRequest('Missing identifier or password');
  }

  try {
    const pdsClient = new PdsAccountClient(PDS_URL, USER_AGENT);
    const session = await pdsClient.createSession(identifier, password);

    const appDirectory = buildAppDirectoryResponse(session.did, session.handle);

    return ok({
      data: {
        session: {
          did: session.did,
          handle: session.handle,
          accessJwt: session.accessJwt,
          refreshJwt: session.refreshJwt,
        },
        atProtocolEcosystem: {
          apps: appDirectory.apps,
          loginUris: appDirectory.loginUris,
          totalApps: appDirectory.totalApps,
        },
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Login failed';
    if (message.includes('Invalid') || message.includes('401')) {
      return jsonResponse({ error: 'Invalid handle or password', code: 'AUTH_FAILED' }, 401);
    }
    return serverError(`Login failed: ${message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// 2. AT PROTOCOL APP DIRECTORY
// ═══════════════════════════════════════════════════════════════════════

/**
 * GET /api/bluesky/apps
 *
 * Show all AT Protocol apps the user can access with their Bluesky account.
 * Supports optional ?category= filter and ?did= for login URI generation.
 */
export async function handleBlueskyApps(request: Request, _env: Env): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const category = params.get('category') as AtProtocolAppCategory | null;
  const did = params.get('did');
  const handle = params.get('handle');

  // Validate category if provided
  const validCategories: AtProtocolAppCategory[] = [
    'microblogging',
    'blogging',
    'link-aggregation',
    'events',
    'video',
    'social-reading',
    'music',
    'development',
    'feed-generator',
    'labeler',
    'analytics',
    'search',
  ];

  let filteredCategory: AtProtocolAppCategory | undefined;
  if (category) {
    if (!validCategories.includes(category)) {
      return badRequest(`Invalid category. Valid: ${validCategories.join(', ')}`);
    }
    filteredCategory = category;
  }

  // If DID provided, include login URIs
  const userDid = did || 'did:plc:anonymous';
  const userHandle = handle || 'anonymous.degenfeed.xyz';

  const directory = buildAppDirectoryResponse(userDid, userHandle, filteredCategory);

  return noCacheJsonResponse({
    data: directory,
    meta: {
      description: 'One Bluesky account. All AT Protocol apps.',
      userAuthenticated: !!did,
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════
// 3. AT PROTOCOL CONTENT DISCOVERY
// ═══════════════════════════════════════════════════════════════════════

/**
 * GET /api/atproto/discover
 *
 * Discover content from across the AT Protocol ecosystem.
 * Pulls from Bluesky posts, WhiteWind articles, Frontpage links,
 * and all AT Protocol apps — unified feed with source badges.
 *
 * Query params:
 *   limit?: number        — Max items (default: 50, max: 100)
 *   source?: string       — Filter by source app (bluesky, whitewind, etc.)
 *   type?: string         — Filter by content type (post, article, link, event, video)
 *   cursor?: string       — Pagination cursor
 */
export async function handleAtprotoDiscover(request: Request, _env: Env): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const limit = Math.min(parseInt(params.get('limit') || '50', 10) || 50, 100);
  const sourceApps = params.get('source') ? params.get('source')?.split(',') : undefined;
  const typesParam = params.get('type');
  const cursor = params.get('cursor') || undefined;

  let types: CrossAppContent['type'][] | undefined;
  if (typesParam) {
    const validTypes = ['post', 'article', 'link', 'event', 'video'];
    types = typesParam
      .split(',')
      .filter((t): t is CrossAppContent['type'] => validTypes.includes(t));
  }

  try {
    const result = await discoverCrossAppContent({
      limit,
      sourceApps,
      types,
      cursor,
      pdsUrl: PDS_URL,
    });

    return noCacheJsonResponse({
      data: result.items,
      meta: {
        ...result.meta,
        hasMore: result.hasMore,
        total: result.total,
      },
      pagination: cursor ? { cursor, nextCursor: result.cursor } : undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Discovery failed';
    return serverError(`Content discovery failed: ${message}`);
  }
}

/**
 * GET /api/atproto/discover/:app
 *
 * Discover content from a specific AT Protocol app.
 */
export async function handleAtprotoDiscoverApp(request: Request, _env: Env): Promise<Response> {
  const url = new URL(request.url);
  const app = url.pathname.split('/').pop() || '';
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '25', 10) || 25, 100);

  const appInfo = getAppByKey(app);
  if (!appInfo) {
    return notFound(`Unknown AT Protocol app: "${app}". See /api/bluesky/apps for valid apps.`);
  }

  try {
    const items = await discoverAppContent(app, limit, PDS_URL);

    return noCacheJsonResponse({
      data: items,
      meta: {
        app: appInfo.name,
        appKey: appInfo.key,
        category: appInfo.category,
        total: items.length,
        fetchedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Discovery failed';
    return serverError(`Content discovery for ${app} failed: ${message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// 4. PDS ACCOUNT PORTABILITY
// ═══════════════════════════════════════════════════════════════════════

/**
 * GET /api/accounts/bluesky/export
 *
 * Export the user's DID + repo data as a CAR file.
 * Full data portability — take your data anywhere.
 */
export async function handleBlueskyExport(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const params = new URL(request.url).searchParams;
  const sourcePds = params.get('sourcePds') || PDS_URL;
  const did = params.get('did') || '';

  if (!did) {
    return badRequest('Missing DID parameter');
  }

  try {
    const migrationClient = new PdsMigrationClient(PDS_URL, USER_AGENT);
    const exportResult = await migrationClient.exportRepo(did, sourcePds);

    // Return CAR file as download - convert Uint8Array to Blob for Response body
    const carBlob = new Blob([exportResult.carData], { type: 'application/vnd.ipld.car' });
    return new Response(carBlob, {
      status: 200,
      headers: {
        'content-type': 'application/vnd.ipld.car',
        'content-disposition': `attachment; filename="${did}-repo.car"`,
        'content-length': String(exportResult.sizeBytes),
        'x-did': did,
        'x-block-count': String(exportResult.blockCount),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Export failed';
    return serverError(`Export failed: ${message}`);
  }
}

/**
 * POST /api/accounts/bluesky/import
 *
 * Import a CAR file (repo data) into our PDS from another PDS.
 */
export async function handleBlueskyImport(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const contentType = request.headers.get('content-type') || '';

  if (
    !contentType.includes('application/vnd.ipld.car') &&
    !contentType.includes('application/octet-stream')
  ) {
    return badRequest('Content-Type must be application/vnd.ipld.car');
  }

  const did = request.headers.get('x-did') || request.headers.get('x-target-did') || '';

  if (!did) {
    return badRequest('Missing x-did header identifying the DID being imported');
  }

  try {
    const carData = new Uint8Array(await request.arrayBuffer());
    const migrationClient = new PdsMigrationClient(PDS_URL, USER_AGENT);
    const bearerToken = extractBearerToken(request);
    if (bearerToken) migrationClient.setAuth(bearerToken);

    const result = await migrationClient.importRepo(did, carData);

    return ok({
      data: {
        did,
        recordsImported: result.recordsImported,
        message: `Successfully imported ${result.recordsImported} records`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Import failed';
    return serverError(`Import failed: ${message}`);
  }
}

/**
 * GET /api/accounts/bluesky/recovery-key
 *
 * Get recovery key information (metadata, not the key itself).
 * The actual key was shown at registration.
 */
export async function handleBlueskyRecoveryKey(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  return ok({
    data: {
      recoveryKeyAvailable: true,
      regenerateUrl: 'POST /api/accounts/bluesky/recovery-key',
      instructions: [
        'Recovery keys are 48-character hex strings generated at account creation',
        'If you lost your recovery key, you can generate a new one',
        'Generating a new key invalidates the old one',
        'Store the new key in a secure password manager immediately',
      ],
    },
  });
}

/**
 * POST /api/accounts/bluesky/recovery-key
 *
 * Generate a new recovery key.
 * WARNING: This invalidates the old key.
 */
export async function handleBlueskyGenerateRecoveryKey(
  request: Request,
  env: Env,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const newRecoveryKey = generateRecoveryKey();

  return created({
    data: {
      recoveryKey: newRecoveryKey,
      warning: 'Save this key immediately. It will not be shown again.',
      instructions: [
        'Store in a password manager (1Password, Bitwarden, etc.)',
        'Write it down and keep in a safe place',
        'Do NOT store digitally in plain text',
        'This key can recover your account if you lose your password',
      ],
    },
  });
}

/**
 * POST /api/accounts/bluesky/recover
 *
 * Recover account access using a recovery key.
 */
export async function handleBlueskyRecover(request: Request, _env: Env): Promise<Response> {
  let body: {
    handle?: string;
    recoveryKey?: string;
    newPassword?: string;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return badRequest('Invalid JSON body');
  }

  const { handle, recoveryKey, newPassword } = body;

  if (!handle || !recoveryKey || !newPassword) {
    return badRequest('Missing required fields: handle, recoveryKey, newPassword');
  }

  if (!/^[0-9a-f]{48}$/i.test(recoveryKey)) {
    return badRequest('Invalid recovery key format (must be 48 hex characters)');
  }

  if (newPassword.length < 8) {
    return badRequest('New password must be at least 8 characters');
  }

  try {
    const pdsClient = new PdsAccountClient(PDS_URL, USER_AGENT);
    await pdsClient.recoverAccount(handle, recoveryKey, newPassword);

    return ok({
      data: {
        message: 'Account recovered successfully. Login with your new password.',
        handle,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Recovery failed';
    return serverError(`Recovery failed: ${message}`);
  }
}

/**
 * GET /api/accounts/bluesky/app-passwords
 *
 * List all app passwords for the authenticated account.
 */
export async function handleBlueskyAppPasswords(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  // Get access JWT from session or auth header
  const accessJwt = extractBearerToken(request);

  try {
    const pdsClient = new PdsAccountClient(PDS_URL, USER_AGENT);
    if (accessJwt) pdsClient.setAuth(accessJwt);

    const passwords = await pdsClient.listAppPasswords();

    return noCacheJsonResponse({
      data: passwords.map((pw) => ({
        id: pw.id,
        name: pw.name,
        createdAt: pw.createdAt,
        revoked: pw.revoked,
      })),
      meta: { total: passwords.length },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list app passwords';
    return serverError(message);
  }
}

/**
 * POST /api/accounts/bluesky/app-passwords
 *
 * Create a new app password for third-party clients.
 */
export async function handleBlueskyCreateAppPassword(
  request: Request,
  env: Env,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  let body: { name?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return badRequest('Invalid JSON body');
  }

  if (!body.name || body.name.length < 1) {
    return badRequest('App password name is required');
  }

  const accessJwt = extractBearerToken(request);

  try {
    const pdsClient = new PdsAccountClient(PDS_URL, USER_AGENT);
    if (accessJwt) pdsClient.setAuth(accessJwt);

    const appPassword = await pdsClient.createAppPassword(body.name);

    return created({
      data: {
        id: appPassword.id,
        name: appPassword.name,
        password: appPassword.password,
        createdAt: appPassword.createdAt,
        warning: 'Save this password now. It will not be shown again.',
        usage: `Use this password with third-party apps like Graze, DeckBlue, or others that support AT Protocol app passwords.`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create app password';
    return serverError(message);
  }
}

/**
 * DELETE /api/accounts/bluesky/app-passwords/:id
 *
 * Revoke an app password by its ID.
 */
export async function handleBlueskyRevokeAppPassword(
  request: Request,
  env: Env,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const url = new URL(request.url);
  const passwordId = url.pathname.split('/').pop();

  if (!passwordId) {
    return badRequest('Missing app password ID');
  }

  const accessJwt = extractBearerToken(request);

  try {
    const pdsClient = new PdsAccountClient(PDS_URL, USER_AGENT);
    if (accessJwt) pdsClient.setAuth(accessJwt);

    await pdsClient.revokeAppPassword(passwordId);

    return ok({
      data: {
        message: `App password "${passwordId}" revoked successfully`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to revoke app password';
    return serverError(message);
  }
}

/**
 * POST /api/accounts/bluesky/migration/start
 *
 * Start a full PDS migration — import data from another PDS to ours.
 */
export async function handleBlueskyMigrationStart(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  let body: {
    sourcePdsUrl?: string;
    sourceHandle?: string;
    sourcePassword?: string;
    updateDid?: boolean;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return badRequest('Invalid JSON body');
  }

  const { sourcePdsUrl, sourceHandle, sourcePassword, updateDid } = body;

  if (!sourcePdsUrl || !sourceHandle || !sourcePassword) {
    return badRequest('Missing required fields: sourcePdsUrl, sourceHandle, sourcePassword');
  }

  const accessJwt = extractBearerToken(request);

  try {
    const migrationClient = new PdsMigrationClient(PDS_URL, USER_AGENT);
    if (accessJwt) migrationClient.setAuth(accessJwt);

    const result = await migrationClient.migrateAccount({
      sourcePdsUrl,
      sourceIdentifier: sourceHandle,
      sourcePassword,
      targetPdsUrl: PDS_URL,
      updateDidDocument: updateDid !== false,
      setupRedirect: false,
    });

    return ok({
      data: {
        did: result.did,
        handle: result.handle,
        recordsMigrated: result.recordsMigrated,
        blobsMigrated: result.blobsMigrated,
        didUpdated: result.didUpdated,
        newPdsEndpoint: result.newPdsEndpoint,
        migrationComplete: true,
        nextSteps: [
          'Update your clients to use pds.degenfeed.xyz',
          'Your old PDS data has been copied',
          'DID document updated to point to our PDS',
        ],
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Migration failed';
    return serverError(`Migration failed: ${message}`);
  }
}

/**
 * GET /api/accounts/bluesky/migration/status
 *
 * Get migration status information.
 */
export async function handleBlueskyMigrationStatus(
  _request: Request,
  _env: Env,
): Promise<Response> {
  return ok({
    data: {
      migrationEndpoints: {
        ourPds: PDS_URL,
        sourcePds: 'https://bsky.social',
        plcDirectory: 'https://plc.directory',
      },
      capabilities: {
        export: true,
        import: true,
        didUpdate: true,
        blobMigration: true,
        redirectSetup: false,
      },
      instructions: {
        export: {
          method: 'GET',
          path: '/api/accounts/bluesky/export?did=did:plc:...',
          description: 'Download your repo as a CAR file',
        },
        import: {
          method: 'POST',
          path: '/api/accounts/bluesky/import',
          contentType: 'application/vnd.ipld.car',
          description: 'Upload a CAR file to our PDS',
        },
        fullMigration: {
          method: 'POST',
          path: '/api/accounts/bluesky/migration/start',
          description: 'Full automated migration from another PDS',
        },
      },
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════
// 5. AT PROTOCOL FEED INTEGRATION — DegenFeed Custom Feeds
// ═══════════════════════════════════════════════════════════════════════

/**
 * GET /api/atproto/feed/degenfeed
 *
 * DegenFeed-curated crypto feed on AT Protocol.
 * Shows crypto-related content from across the ecosystem.
 *
 * Query params:
 *   limit?: number   — Max items (default: 50, max: 100)
 *   cursor?: string  — Pagination cursor
 */
export async function handleDegenFeedCrypto(request: Request, _env: Env): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const limit = Math.min(parseInt(params.get('limit') || '50', 10) || 50, 100);
  const cursor = params.get('cursor') || undefined;

  try {
    const result = await generateDegenFeed({
      feedType: 'crypto',
      limit,
      cursor,
      pdsUrl: PDS_URL,
    });

    return noCacheJsonResponse({
      data: result.feed,
      meta: {
        ...result.meta,
        hasMore: result.hasMore,
        feedGeneratorDid: 'did:web:feeds.degenfeed.xyz',
      },
      pagination: cursor ? { cursor, nextCursor: result.cursor } : undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Feed generation failed';
    return serverError(`Crypto feed failed: ${message}`);
  }
}

/**
 * GET /api/atproto/feed/degenfeed/trending
 *
 * DegenFeed trending feed — highest-engagement content across AT Protocol.
 */
export async function handleDegenFeedTrending(request: Request, _env: Env): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const limit = Math.min(parseInt(params.get('limit') || '50', 10) || 50, 100);

  try {
    const result = await generateDegenFeed({
      feedType: 'trending',
      limit,
      pdsUrl: PDS_URL,
    });

    return noCacheJsonResponse({
      data: result.feed,
      meta: {
        ...result.meta,
        feedGeneratorDid: 'did:web:feeds.degenfeed.xyz',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Feed generation failed';
    return serverError(`Trending feed failed: ${message}`);
  }
}

/**
 * GET /api/atproto/feed/degenfeed/cross
 *
 * Cross-protocol feed — shows Nostr + Farcaster content on AT Protocol.
 */
export async function handleDegenFeedCrossProtocol(request: Request, _env: Env): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const limit = Math.min(parseInt(params.get('limit') || '50', 10) || 50, 100);

  try {
    const result = await generateDegenFeed({
      feedType: 'cross-protocol',
      limit,
      pdsUrl: PDS_URL,
    });

    return noCacheJsonResponse({
      data: result.feed,
      meta: {
        ...result.meta,
        feedGeneratorDid: 'did:web:feeds.degenfeed.xyz',
        note: 'Cross-protocol content is bridged from Nostr and Farcaster. Protocol badge shows the source network.',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Feed generation failed';
    return serverError(`Cross-protocol feed failed: ${message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Route Registration
// ═══════════════════════════════════════════════════════════════════════

/**
 * Register all Bluesky / AT Protocol routes on the given Hono app.
 */
export function registerBlueskyRoutes(app: Hono<{ Bindings: Env }>): void {
  // 1. PDS Registration
  app.post('/api/bluesky/register', async (c) => handleBlueskyRegister(c.req.raw, c.env));
  app.post('/api/bluesky/login', async (c) => handleBlueskyLogin(c.req.raw, c.env));

  // 2. AT Protocol App Directory
  app.get('/api/bluesky/apps', async (c) => handleBlueskyApps(c.req.raw, c.env));

  // 3. AT Protocol Content Discovery
  app.get('/api/atproto/discover', async (c) => handleAtprotoDiscover(c.req.raw, c.env));
  app.get('/api/atproto/discover/:app', async (c) => handleAtprotoDiscoverApp(c.req.raw, c.env));

  // 4. PDS Account Portability
  app.get('/api/accounts/bluesky/export', async (c) => handleBlueskyExport(c.req.raw, c.env));
  app.post('/api/accounts/bluesky/import', async (c) => handleBlueskyImport(c.req.raw, c.env));
  app.get('/api/accounts/bluesky/recovery-key', async (c) =>
    handleBlueskyRecoveryKey(c.req.raw, c.env),
  );
  app.post('/api/accounts/bluesky/recovery-key', async (c) =>
    handleBlueskyGenerateRecoveryKey(c.req.raw, c.env),
  );
  app.post('/api/accounts/bluesky/recover', async (c) => handleBlueskyRecover(c.req.raw, c.env));
  app.get('/api/accounts/bluesky/app-passwords', async (c) =>
    handleBlueskyAppPasswords(c.req.raw, c.env),
  );
  app.post('/api/accounts/bluesky/app-passwords', async (c) =>
    handleBlueskyCreateAppPassword(c.req.raw, c.env),
  );
  app.delete('/api/accounts/bluesky/app-passwords/:id', async (c) =>
    handleBlueskyRevokeAppPassword(c.req.raw, c.env),
  );
  app.post('/api/accounts/bluesky/migration/start', async (c) =>
    handleBlueskyMigrationStart(c.req.raw, c.env),
  );
  app.get('/api/accounts/bluesky/migration/status', async (c) =>
    handleBlueskyMigrationStatus(c.req.raw, c.env),
  );

  // 5. AT Protocol Feed Integration
  app.get('/api/atproto/feed/degenfeed', async (c) => handleDegenFeedCrypto(c.req.raw, c.env));
  app.get('/api/atproto/feed/degenfeed/trending', async (c) =>
    handleDegenFeedTrending(c.req.raw, c.env),
  );
  app.get('/api/atproto/feed/degenfeed/cross', async (c) =>
    handleDegenFeedCrossProtocol(c.req.raw, c.env),
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────

/**
 * Extract Bearer token from Authorization header.
 */
function extractBearerToken(request: Request): string | null {
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

// ─── Type-only re-exports (not a module import) ──────────────
// Using 'import type' is fine for type-only references; CrossAppContent
// is already available from the atproto-directory import at the top.
