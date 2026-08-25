/**
 * @degenfeed/api-worker — Connected Accounts OAuth Handlers
 */

import { jsonResponse, methodNotAllowed } from '../../response-helpers';
import { requireSession } from '../../session';
import type { Env } from '../../types';
import { consumeState, generateOAuthState, storeState } from '../oauth-state';
import { buildOAuthUrl } from './oauth-urls';
import { PLATFORM_LABELS } from './types';
import { connectedAccountKey, getStatePrefix } from './utils';

// Local type definitions for missing exports
const CENTRALIZED_PLATFORMS = [
  'reddit',
  'medium',
  'youtube',
  'linkedin',
  'instagram',
  'pinterest',
  'tiktok',
  'substack',
] as const;

type CentralizedPlatform = (typeof CENTRALIZED_PLATFORMS)[number];

// Local exchange wrappers with correct signatures
async function exchangeRedditCodeWrapper(code: string, _env: Env, redirectUri: string) {
  const { exchangeRedditCode } = await import('./exchanges');
  return exchangeRedditCode(code, redirectUri);
}
async function exchangeMediumCodeWrapper(code: string, _env: Env, redirectUri: string) {
  const { exchangeMediumCode } = await import('./exchanges');
  return exchangeMediumCode(code, redirectUri);
}
async function exchangeGoogleCodeWrapper(
  code: string,
  _env: Env,
  redirectUri: string,
  _service: string,
) {
  const { exchangeGoogleCode } = await import('./exchanges');
  return exchangeGoogleCode(code, redirectUri);
}
async function exchangeLinkedInCodeWrapper(code: string, _env: Env, redirectUri: string) {
  const { exchangeLinkedInCode } = await import('./exchanges');
  return exchangeLinkedInCode(code, redirectUri);
}
async function exchangeInstagramCodeWrapper(code: string, _env: Env, redirectUri: string) {
  const { exchangeInstagramCode } = await import('./exchanges');
  return exchangeInstagramCode(code, redirectUri);
}
async function exchangePinterestCodeWrapper(code: string, _env: Env, redirectUri: string) {
  const { exchangePinterestCode } = await import('./exchanges');
  return exchangePinterestCode(code, redirectUri);
}
async function exchangeTikTokCodeWrapper(code: string, _env: Env, redirectUri: string) {
  const { exchangeTikTokCode } = await import('./exchanges');
  return exchangeTikTokCode(code, redirectUri);
}

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

  const oauthUrl = buildOAuthUrl(env, platform, state, redirectUri);
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

  // Exchange stubs report failure as { success: false, reason, provider }
  if ('success' in tokenResult) {
    return jsonResponse(
      {
        error: `OAuth exchange not available for ${platform}`,
        reason: tokenResult.reason,
      },
      501,
    );
  }

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const wallet = session.address.toLowerCase();

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
  | { success: false; reason: string; provider: string }
  | Response
> {
  const baseUrl = `${currentUrl.protocol}//${currentUrl.hostname}`;
  const redirectUri = `${baseUrl}/api/accounts/callback/${platform}`;

  switch (platform) {
    case 'reddit':
      return exchangeRedditCodeWrapper(code, env, redirectUri);
    case 'medium':
      return exchangeMediumCodeWrapper(code, env, redirectUri);
    case 'youtube':
      return exchangeGoogleCodeWrapper(code, env, redirectUri, 'youtube');
    case 'linkedin':
      return exchangeLinkedInCodeWrapper(code, env, redirectUri);
    case 'instagram':
      return exchangeInstagramCodeWrapper(code, env, redirectUri);
    case 'pinterest':
      return exchangePinterestCodeWrapper(code, env, redirectUri);
    case 'tiktok':
      return exchangeTikTokCodeWrapper(code, env, redirectUri);
    default:
      return jsonResponse({ error: `Unsupported platform: ${platform}` }, 400);
  }
}
