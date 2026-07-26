/**
 * @degenfeed/api-worker — Connected Accounts OAuth Handlers
 */

import type { Env } from '../../index';
import { jsonResponse } from '../../index';
import { methodNotAllowed } from '../../response-helpers';
import { requireSession } from '../../session';
import { consumeState, generateOAuthState, storeState } from '../oauth-state';
import { buildOAuthUrl } from './oauth-urls';
import { CENTRALIZED_PLATFORMS, type CentralizedPlatform, PLATFORM_LABELS } from './types';
import { connectedAccountKey, getStatePrefix } from './utils';

/**
 * POST /api/accounts/connect/:platform — Initiate OAuth for a platform.
 */
export async function handleConnectPlatform(
  request: Request,
  env: Env,
  platform: string,
): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  if (!CENTRALIZED_PLATFORMS.includes(platform as CentralizedPlatform)) {
    return jsonResponse({ error: `Unsupported platform: ${platform}` }, 400);
  }

  const state = generateOAuthState();
  const statePrefix = getStatePrefix(platform);
  if (statePrefix) {
    await storeState(env, state, statePrefix);
  }

  const url = new URL(request.url);
  const baseUrl = `${url.protocol}//${url.hostname}`;
  const redirectUri = `${baseUrl}/api/accounts/callback/${platform}`;

  const oauthUrl = buildOAuthUrl(platform, env, state, redirectUri);
  if (oauthUrl instanceof Response) return oauthUrl;

  return jsonResponse({
    authorizeUrl: oauthUrl,
    state,
    platform,
    label: PLATFORM_LABELS[platform] || platform,
  });
}

/**
 * GET /api/accounts/callback/:platform — OAuth callback handler.
 */
export async function handleOAuthCallback(
  request: Request,
  env: Env,
  platform: string,
): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error) {
    return jsonResponse({ error: `OAuth denied: ${error}`, platform }, 400);
  }
  if (!code || !state) {
    return jsonResponse({ error: 'Missing code or state parameter' }, 400);
  }

  const statePrefix = getStatePrefix(platform);
  if (statePrefix) {
    const valid = await consumeState(env, state, statePrefix);
    if (!valid) return jsonResponse({ error: 'Invalid or expired OAuth state' }, 403);
  }

  const tokenResult = await exchangeCodeForToken(platform, code, env, url);
  if (tokenResult instanceof Response) return tokenResult;

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const wallet = session.address.toLowerCase();
  const { ConnectedAccount } = await import('./types');

  const account = {
    platform,
    label: tokenResult.label,
    accessToken: tokenResult.accessToken,
    refreshToken: tokenResult.refreshToken,
    platformUserId: tokenResult.platformUserId,
    connectedAt: new Date().toISOString(),
    lastRefreshedAt: new Date().toISOString(),
    expiresAt: tokenResult.expiresAt,
    metadata: tokenResult.metadata,
  };

  try {
    await env.CACHE?.put(connectedAccountKey(wallet, platform), JSON.stringify(account), {
      expirationTtl: 60 * 60 * 24 * 365,
    });
    const { addPlatformToIndex } = await import('./utils');
    await addPlatformToIndex(env, wallet, platform);
  } catch (err) {
    console.error('[connected-accounts] Failed to persist:', err);
    return jsonResponse({ error: 'Failed to save connection' }, 500);
  }

  return jsonResponse({
    ok: true,
    platform,
    label: account.label,
    platformUserId: account.platformUserId,
  });
}

/**
 * Exchange OAuth code for tokens per platform.
 */
async function exchangeCodeForToken(
  platform: string,
  code: string,
  env: Env,
  currentUrl: URL,
): Promise<
  | {
      accessToken: string;
      refreshToken?: string;
      platformUserId: string;
      label: string;
      expiresAt?: number;
      metadata?: Record<string, string>;
    }
  | Response
> {
  const baseUrl = `${currentUrl.protocol}//${currentUrl.hostname}`;
  const redirectUri = `${baseUrl}/api/accounts/callback/${platform}`;

  const {
    exchangeRedditCode,
    exchangeMediumCode,
    exchangeGoogleCode,
    exchangeLinkedInCode,
    exchangeInstagramCode,
    exchangePinterestCode,
    exchangeTikTokCode,
  } = await import('./exchanges');

  switch (platform) {
    case 'reddit':
      return exchangeRedditCode(code, env, redirectUri);
    case 'medium':
      return exchangeMediumCode(code, env, redirectUri);
    case 'youtube':
      return exchangeGoogleCode(code, env, redirectUri, 'youtube');
    case 'linkedin':
      return exchangeLinkedInCode(code, env, redirectUri);
    case 'instagram':
      return exchangeInstagramCode(code, env, redirectUri);
    case 'pinterest':
      return exchangePinterestCode(code, env, redirectUri);
    case 'tiktok':
      return exchangeTikTokCode(code, env, redirectUri);
    default:
      return jsonResponse({ error: `Unsupported platform: ${platform}` }, 400);
  }
}
