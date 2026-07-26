/**
 * @degenfeed/api-worker — SSO Routes & Dashboard
 *
 * Single Sign-On across ALL self-hosted networks.
 * One wallet sign-in → auto-provisioned accounts on every protocol.
 *
 * Routes:
 *   POST   /api/sso/provision          — Provision all missing protocol accounts
 *   GET    /api/sso/dashboard           — Get account status across all protocols
 *   POST   /api/sso/session/create      — Create a cross-network session
 *   POST   /api/sso/session/verify      — Verify a cross-network session token
 *   POST   /api/sso/session/refresh     — Refresh the session TTL
 *   POST   /api/sso/session/revoke      — Revoke a specific session
 *   POST   /api/sso/session/revoke-all  — Revoke ALL sessions
 *   GET    /api/sso/activity            — Get cross-network activity feed
 *   POST   /api/sso/activity/record     — Record an activity event
 *   GET    /api/sso/export              — Export identity bundle
 *   POST   /api/sso/import              — Import identity bundle
 *   POST   /api/sso/recovery/generate   — Generate recovery code
 *   POST   /api/sso/recovery/restore    — Restore from recovery code
 *   GET    /api/sso/health              — Check health of all protocol instances
 *   POST   /api/sso/provision/:protocol — Provision a specific protocol account
 *
 * Authentication: All routes except /health require a valid session.
 */

import { log } from '../index';
import {
  ALL_SSO_PROTOCOLS,
  checkProtocolsHealth,
  createCrossNetworkSession,
  exportIdentityBundle,
  generateRecoveryCode,
  getActivityFeed,
  getLastActive,
  getOrInitWalletState,
  importIdentityBundle,
  isSessionRevoked,
  provisionAllProtocols,
  provisionSingleProtocol,
  recordActivity,
  recoverWithCode,
  refreshCrossNetworkSession,
  revokeAllSessions,
  revokeSession as revokeCrossNetworkSession,
  type SSOExportBundle,
  type SSOProvisioningResult,
  signSessionToken,
  verifySessionToken,
} from '../lib/sso-bridge';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

// ────────────────────────────────────────────────────────────────────────────
// POST /api/sso/provision — Provision all missing protocol accounts
// ────────────────────────────────────────────────────────────────────────────

export async function handleSSOProvision(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const wallet = session.address;

  let _body: { username?: string };
  try {
    _body = (await request.json()) as { username?: string };
  } catch {
    _body = {};
  }

  try {
    const result: SSOProvisioningResult = await provisionAllProtocols(wallet, env);

    log('info', 'SSO provisioning complete', {
      wallet: wallet.slice(0, 8),
      created: result.created,
      alreadyExisted: result.alreadyExisted,
      failed: result.failed,
    });

    return jsonResponse({ data: result }, result.failed > 0 && result.created === 0 ? 200 : 201);
  } catch (err) {
    log('error', 'SSO provisioning failed', { wallet: wallet.slice(0, 8), error: String(err) });
    return jsonResponse({ error: `Provisioning failed: ${String(err)}` }, 500);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// POST /api/sso/provision/:protocol — Provision a single protocol
// ────────────────────────────────────────────────────────────────────────────

export async function handleSSOProvisionSingle(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const wallet = session.address;
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  // pathParts = ['api', 'sso', 'provision', '{protocol}']
  const protocolId = pathParts[3];

  if (!protocolId) {
    return jsonResponse({ error: 'Missing protocol ID in path' }, 400);
  }

  const protoDef = ALL_SSO_PROTOCOLS.find((p) => p.id === protocolId);
  if (!protoDef) {
    return jsonResponse(
      {
        error: `Unknown protocol: ${protocolId}`,
        supported: ALL_SSO_PROTOCOLS.map((p) => p.id),
      },
      400,
    );
  }

  let body: { username?: string };
  try {
    body = (await request.json()) as { username?: string };
  } catch {
    body = {};
  }

  const username = body.username || `df_${wallet.slice(2, 10)}`;

  try {
    const result = await provisionSingleProtocol(protoDef, username, wallet, env);

    // Update wallet state
    const state = await getOrInitWalletState(wallet, env);
    const accountState = state.accounts.find((a) => a.protocol === protocolId);
    if (result.status === 'created') {
      if (accountState) {
        accountState.registered = true;
        accountState.username = result.username ?? username;
        accountState.profileUrl = result.profileUrl ?? null;
        accountState.createdAt = Date.now();
      } else {
        state.accounts.push({
          protocol: protocolId,
          registered: true,
          username: result.username ?? username,
          profileUrl: result.profileUrl ?? null,
          lastActive: Date.now(),
          createdAt: Date.now(),
        });
      }
    }
    if (result.status === 'failed' && accountState) {
      accountState.error = result.error;
    }

    state.lastActive = Date.now();
    const { persistWalletState } = await import('../lib/sso-bridge');
    await persistWalletState(wallet, state, env);

    return jsonResponse({ data: result }, result.status === 'created' ? 201 : 200);
  } catch (err) {
    return jsonResponse({ error: `Provisioning failed: ${String(err)}` }, 500);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// GET /api/sso/dashboard — Account status across all protocols
// ────────────────────────────────────────────────────────────────────────────

export async function handleSSODashboard(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const wallet = session.address;
  const state = await getOrInitWalletState(wallet, env);

  // Enrich with health status
  const health = await checkProtocolsHealth(env);

  const dashboard = {
    wallet: state.wallet,
    masterSessionExists: state.masterSessionId !== null,
    lastActive: state.lastActive,
    identityDID: state.identityDID,
    createdAt: state.createdAt,
    totalProtocols: ALL_SSO_PROTOCOLS.length,
    registeredCount: state.accounts.filter((a) => a.registered).length,
    protocols: ALL_SSO_PROTOCOLS.map((proto) => {
      const acct = state.accounts.find((a) => a.protocol === proto.id);
      return {
        id: proto.id,
        label: proto.label,
        icon: proto.icon,
        color: proto.color,
        category: proto.category,
        instanceUrl: proto.instanceUrl,
        registered: acct?.registered ?? false,
        username: acct?.username ?? null,
        profileUrl: acct?.profileUrl ?? null,
        lastActive: acct?.lastActive ?? null,
        createdAt: acct?.createdAt ?? null,
        error: acct?.error ?? null,
        healthy: health[proto.id] ?? false,
      };
    }),
  };

  return noCacheJsonResponse({ data: dashboard });
}

// ────────────────────────────────────────────────────────────────────────────
// POST /api/sso/session/create — Create a cross-network session
// ────────────────────────────────────────────────────────────────────────────

export async function handleSSOSessionCreate(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const wallet = session.address;
  const ip =
    request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';

  try {
    const result = await createCrossNetworkSession(wallet, env, ip);
    return jsonResponse({
      data: {
        sessionId: result.session.sessionId,
        token: result.sessionToken,
        expiresAt: result.session.expiresAt,
        crossSignedTokens: result.session.crossSignedTokens,
      },
    });
  } catch (err) {
    return jsonResponse({ error: `Failed to create session: ${String(err)}` }, 500);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// POST /api/sso/session/verify — Verify a session token
// ────────────────────────────────────────────────────────────────────────────

export async function handleSSOSessionVerify(request: Request, env: Env): Promise<Response> {
  const secret = env.AUTH_SECRET;
  if (!secret) {
    return jsonResponse({ error: 'Auth secret not configured' }, 500);
  }

  let body: { token?: string };
  try {
    body = (await request.json()) as { token?: string };
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.token) {
    return jsonResponse({ error: 'Missing token' }, 400);
  }

  const payload = await verifySessionToken(body.token, secret);
  if (!payload) {
    return jsonResponse({ error: 'Invalid or expired token' }, 401);
  }

  // Check revocation
  const revoked = await isSessionRevoked(payload.sessionId, env);
  if (revoked) {
    return jsonResponse({ error: 'Session revoked' }, 401);
  }

  // Refresh the session in the background
  await refreshCrossNetworkSession(payload.wallet, payload.sessionId, env).catch(() => {});

  return jsonResponse({
    data: {
      wallet: payload.wallet,
      sessionId: payload.sessionId,
      valid: true,
    },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// POST /api/sso/session/refresh — Refresh session TTL
// ────────────────────────────────────────────────────────────────────────────

export async function handleSSOSessionRefresh(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const wallet = session.address;
  const secret = env.AUTH_SECRET;
  if (!secret) {
    return jsonResponse({ error: 'Auth secret not configured' }, 500);
  }

  let body: { sessionId?: string };
  try {
    body = (await request.json()) as { sessionId?: string };
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const sessionId = body.sessionId;
  if (!sessionId) {
    return jsonResponse({ error: 'Missing sessionId' }, 400);
  }

  const refreshed = await refreshCrossNetworkSession(wallet, sessionId, env);
  if (!refreshed) {
    return jsonResponse({ error: 'Session not found or expired' }, 404);
  }

  // Issue a new session token with updated expiry
  const newToken = await signSessionToken(wallet, sessionId, refreshed.nonce, secret);

  return jsonResponse({
    data: {
      sessionId: refreshed.sessionId,
      token: newToken,
      expiresAt: refreshed.expiresAt,
      lastRefreshAt: refreshed.lastRefreshAt,
    },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// POST /api/sso/session/revoke — Revoke a specific session
// ────────────────────────────────────────────────────────────────────────────

export async function handleSSOSessionRevoke(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const wallet = session.address;

  let body: { sessionId?: string };
  try {
    body = (await request.json()) as { sessionId?: string };
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const sessionId = body.sessionId;
  if (!sessionId) {
    return jsonResponse({ error: 'Missing sessionId' }, 400);
  }

  const success = await revokeCrossNetworkSession(wallet, sessionId, env);
  return jsonResponse({
    data: { revoked: success, sessionId },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// POST /api/sso/session/revoke-all — Revoke ALL sessions
// ────────────────────────────────────────────────────────────────────────────

export async function handleSSOSessionRevokeAll(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const wallet = session.address;

  const result = await revokeAllSessions(wallet, env);
  return jsonResponse({
    data: result,
    message: `Revoked ${result.revoked} sessions across all protocols.`,
  });
}

// ────────────────────────────────────────────────────────────────────────────
// GET /api/sso/activity — Cross-network activity feed
// ────────────────────────────────────────────────────────────────────────────

export async function handleSSOActivity(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const wallet = session.address;
  const url = new URL(request.url);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 50));

  const [feed, lastActive] = await Promise.all([
    getActivityFeed(wallet, env, limit),
    getLastActive(wallet, env),
  ]);

  return noCacheJsonResponse({
    data: {
      feed,
      lastActive,
      count: feed.length,
    },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// POST /api/sso/activity/record — Record an activity event
// ────────────────────────────────────────────────────────────────────────────

export async function handleSSOActivityRecord(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const wallet = session.address;

  let body: { protocol?: string; type?: string; metadata?: Record<string, unknown> };
  try {
    body = (await request.json()) as {
      protocol?: string;
      type?: string;
      metadata?: Record<string, unknown>;
    };
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.protocol || !body.type) {
    return jsonResponse({ error: 'Missing protocol or type' }, 400);
  }

  await recordActivity(wallet, body.protocol, body.type, body.metadata, env);

  return jsonResponse({ data: { success: true } });
}

// ────────────────────────────────────────────────────────────────────────────
// GET /api/sso/export — Export identity bundle
// ────────────────────────────────────────────────────────────────────────────

export async function handleSSOExport(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const wallet = session.address;

  try {
    const bundle = await exportIdentityBundle(wallet, env);

    // Don't include recovery data in the response body directly
    const exportResponse = {
      wallet: bundle.wallet,
      version: bundle.version,
      exportedAt: bundle.exportedAt,
      accounts: bundle.accounts.map((a) => ({
        protocol: a.protocol,
        registered: a.registered,
        username: a.username,
        profileUrl: a.profileUrl,
      })),
      did: bundle.did,
      hasRecoveryData: bundle.recoveryData !== null,
      walletSignature: bundle.walletSignature,
    };

    // If there's recovery data, include it encrypted
    return jsonResponse({ data: exportResponse });
  } catch (err) {
    return jsonResponse({ error: `Export failed: ${String(err)}` }, 500);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// POST /api/sso/import — Import identity bundle
// ────────────────────────────────────────────────────────────────────────────

export async function handleSSOImport(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  let body: { bundle: SSOExportBundle };
  try {
    body = (await request.json()) as { bundle: SSOExportBundle };
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.bundle?.wallet) {
    return jsonResponse({ error: 'Invalid bundle' }, 400);
  }

  // Verify the bundle belongs to the authenticated user
  if (body.bundle.wallet !== session.address.toLowerCase()) {
    return jsonResponse({ error: 'Bundle wallet does not match session' }, 403);
  }

  try {
    const state = await importIdentityBundle(body.bundle, env);
    return jsonResponse({
      data: {
        wallet: state.wallet,
        accountsRestored: state.accounts.filter((a) => a.registered).length,
      },
    });
  } catch (err) {
    return jsonResponse({ error: `Import failed: ${String(err)}` }, 500);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// POST /api/sso/recovery/generate — Generate recovery code
// ────────────────────────────────────────────────────────────────────────────

export async function handleSSORecoveryGenerate(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const wallet = session.address;

  let body: { passphrase?: string };
  try {
    body = (await request.json()) as { passphrase?: string };
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.passphrase || body.passphrase.length < 8) {
    return jsonResponse({ error: 'Passphrase must be at least 8 characters' }, 400);
  }

  try {
    const result = await generateRecoveryCode(wallet, body.passphrase, env);
    return jsonResponse({
      data: {
        recoveryCode: result.recoveryCode,
        backupSize: result.backupEncrypted.length,
        message: 'Store your recovery code safely. It can restore all protocol accounts.',
      },
    });
  } catch (err) {
    return jsonResponse({ error: `Recovery generation failed: ${String(err)}` }, 500);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// POST /api/sso/recovery/restore — Restore from recovery code
// ────────────────────────────────────────────────────────────────────────────

export async function handleSSORecoveryRestore(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const wallet = session.address;

  let body: { recoveryCode?: string; encryptedBackup?: string };
  try {
    body = (await request.json()) as { recoveryCode?: string; encryptedBackup?: string };
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.recoveryCode || !body.encryptedBackup) {
    return jsonResponse({ error: 'recoveryCode and encryptedBackup are required' }, 400);
  }

  try {
    const state = await recoverWithCode(wallet, body.recoveryCode, body.encryptedBackup, env);
    return jsonResponse({
      data: {
        wallet: state.wallet,
        accountsRestored: state.accounts.filter((a) => a.registered).length,
        message: 'Accounts restored successfully. You may need to re-provision some protocols.',
      },
    });
  } catch (err) {
    return jsonResponse({ error: `Recovery failed: ${String(err)}` }, 500);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// GET /api/sso/health — Protocol health check
// ────────────────────────────────────────────────────────────────────────────

export async function handleSSOHealth(_request: Request, env: Env): Promise<Response> {
  const health = await checkProtocolsHealth(env);

  const result = ALL_SSO_PROTOCOLS.map((proto) => ({
    id: proto.id,
    label: proto.label,
    instanceUrl: proto.instanceUrl,
    healthy: health[proto.id] ?? false,
  }));

  const healthyCount = result.filter((r) => r.healthy).length;
  const totalCount = result.length;

  return jsonResponse({
    data: {
      protocols: result,
      summary: {
        healthy: healthyCount,
        unhealthy: totalCount - healthyCount,
        total: totalCount,
        allHealthy: healthyCount === totalCount,
      },
    },
  });
}
