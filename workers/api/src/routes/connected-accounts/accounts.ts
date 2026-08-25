/**
 * @degenfeed/api-worker — Connected Accounts Management Handlers
 */

import { jsonResponse } from '../../response-helpers';
import { requireSession } from '../../session';
import type { Env } from '../../types';
import { PLATFORM_ICONS } from './types';
import { connectedAccountKey, removePlatformFromIndex } from './utils';

// Local type that matches the actual stored data structure
interface StoredConnectedAccount {
  platform: string;
  username: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  avatarUrl?: string;
  displayName?: string;
  connectedAt: number;
  platformUserId?: string;
  metadata?: Record<string, string>;
  label?: string;
}

/**
 * GET /api/accounts/connected — List all connected accounts.
 */
export async function handleListConnectedAccounts(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const wallet = session.address.toLowerCase();
  const indexKey = `connected:user:${wallet.toLowerCase()}`;

  let platforms: string[] = [];
  try {
    const raw = await env.CACHE?.get(indexKey);
    if (raw) platforms = JSON.parse(raw) as string[];
  } catch {
    /* empty */
  }

  const accounts: Array<{
    platform: string;
    label: string;
    icon: string;
    connectedAt: string;
    platformUserId: string;
    metadata?: Record<string, string>;
    expiresAt?: number;
  }> = [];

  for (const platform of platforms) {
    try {
      const raw = await env.CACHE?.get(connectedAccountKey(wallet, platform));
      if (!raw) continue;
      const acct = JSON.parse(raw) as StoredConnectedAccount;
      accounts.push({
        platform: acct.platform,
        label: acct.label ?? acct.displayName ?? acct.username ?? platform,
        icon: PLATFORM_ICONS[acct.platform] || '🔗',
        connectedAt: new Date(acct.connectedAt).toISOString(),
        platformUserId: acct.platformUserId ?? acct.username,
        metadata: acct.metadata,
        expiresAt: acct.expiresAt,
      });
    } catch {
      /* skip corrupt */
    }
  }

  return jsonResponse({ accounts });
}

/**
 * DELETE /api/accounts/disconnect/:platform — Disconnect a platform.
 */
export async function handleDisconnectPlatform(
  request: Request,
  env: Env,
  platform: string,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const wallet = session.address.toLowerCase();

  try {
    await env.CACHE?.delete(connectedAccountKey(wallet, platform));
    await removePlatformFromIndex(env, wallet, platform);
    return jsonResponse({ ok: true, platform, disconnected: true });
  } catch (err) {
    console.error('[connected-accounts] Failed to disconnect:', err);
    return jsonResponse({ error: 'Failed to disconnect platform' }, 500);
  }
}

/**
 * GET /api/accounts/status/:platform — Check connection status.
 */
export async function handleAccountStatus(
  request: Request,
  env: Env,
  platform: string,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const wallet = session.address.toLowerCase();

  try {
    const raw = await env.CACHE?.get(connectedAccountKey(wallet, platform));
    if (!raw) return jsonResponse({ connected: false, platform });
    const acct = JSON.parse(raw) as StoredConnectedAccount;
    return jsonResponse({
      connected: true,
      platform,
      label: acct.label ?? acct.displayName ?? acct.username ?? platform,
      platformUserId: acct.platformUserId ?? acct.username,
      connectedAt: new Date(acct.connectedAt).toISOString(),
      expiresAt: acct.expiresAt,
      metadata: acct.metadata,
    });
  } catch {
    return jsonResponse({ error: 'Failed to check status' }, 500);
  }
}

/**
 * POST /api/accounts/connect/substack/email — Set up Substack email publishing.
 */
export async function handleSubstackEmailSetup(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const wallet = session.address.toLowerCase();

  let body: { email: string; publicationName?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.email?.trim()) {
    return jsonResponse({ error: 'Email address required' }, 400);
  }

  const account: StoredConnectedAccount = {
    platform: 'substack',
    username: body.email,
    label: body.publicationName || body.email,
    accessToken: '', // No API token for Substack
    platformUserId: body.email,
    connectedAt: Date.now(),
    metadata: { email: body.email, publicationName: body.publicationName || '' },
  };

  try {
    await env.CACHE?.put(connectedAccountKey(wallet, 'substack'), JSON.stringify(account), {
      expirationTtl: 60 * 60 * 24 * 365,
    });
    const { addPlatformToIndex } = await import('./utils');
    await addPlatformToIndex(env, wallet, 'substack');
    return jsonResponse({ ok: true, platform: 'substack', label: account.label });
  } catch {
    return jsonResponse({ error: 'Failed to save Substack settings' }, 500);
  }
}

/**
 * Get connected account for a specific wallet + platform.
 */
export async function getConnectedAccount(
  wallet: string,
  platform: string,
  env: Env,
): Promise<StoredConnectedAccount | null> {
  try {
    const raw = await env.CACHE?.get(connectedAccountKey(wallet, platform));
    if (!raw) return null;
    return JSON.parse(raw) as StoredConnectedAccount;
  } catch {
    return null;
  }
}
