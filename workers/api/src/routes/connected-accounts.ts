/**
 * @degenfeed/api-worker — Connected Centralized Accounts
 *
 * Manages OAuth-connected accounts for centralized platforms (Medium, YouTube,
 * LinkedIn, Reddit, Instagram, TikTok, Pinterest, Substack).
 *
 * Routes:
 *   GET    /api/accounts/connected            — List all connected accounts
 *   POST   /api/accounts/connect/:platform     — Initiate OAuth for a platform
 *   GET    /api/accounts/callback/:platform    — OAuth callback handler
 *   DELETE /api/accounts/disconnect/:platform  — Disconnect a platform
 *   GET    /api/accounts/status/:platform      — Check connection status
 *
 * Data stored in KV under: connected:account:{wallet}:{platform}
 * User index: connected:user:{wallet} → platform[]
 */

import { jsonResponse, methodNotAllowed } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';
import {
  consumeState,
  generateOAuthState,
  INSTAGRAM_STATE_PREFIX,
  LINKEDIN_STATE_PREFIX,
  MEDIUM_STATE_PREFIX,
  PINTEREST_STATE_PREFIX,
  storeState,
  TIKTOK_STATE_PREFIX,
  YOUTUBE_STATE_PREFIX,
} from './oauth-state';

// ─── KV key helpers ───────────────────────────────────────────────────────

function connectedAccountKey(wallet: string, platform: string): string {
  return `connected:account:${wallet.toLowerCase()}:${platform}`;
}

function connectedUserIndexKey(wallet: string): string {
  return `connected:user:${wallet.toLowerCase()}`;
}

// ─── Types ────────────────────────────────────────────────────────────────

export interface ConnectedAccount {
  platform: string;
  /** Display label (e.g. "YouTube Channel Name") */
  label: string;
  /** OAuth access token (encrypted or stored server-side) */
  accessToken: string;
  /** OAuth refresh token if available */
  refreshToken?: string;
  /** Platform user ID */
  platformUserId: string;
  /** ISO timestamp of connection */
  connectedAt: string;
  /** ISO timestamp of last token refresh */
  lastRefreshedAt?: string;
  /** Token expiry (Unix epoch ms) if known */
  expiresAt?: number;
  /** Platform-specific metadata (channel name, avatar, etc) */
  metadata?: Record<string, string>;
}

export type CentralizedPlatform =
  | 'medium'
  | 'substack'
  | 'youtube'
  | 'tiktok'
  | 'instagram'
  | 'linkedin'
  | 'reddit'
  | 'pinterest';

const CENTRALIZED_PLATFORMS: CentralizedPlatform[] = [
  'medium',
  'substack',
  'youtube',
  'tiktok',
  'instagram',
  'linkedin',
  'reddit',
  'pinterest',
];

// ─── Platform display labels ──────────────────────────────────────────────

const PLATFORM_LABELS: Record<string, string> = {
  medium: 'Medium',
  substack: 'Substack',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  reddit: 'Reddit',
  pinterest: 'Pinterest',
};

const PLATFORM_ICONS: Record<string, string> = {
  medium: '✍️',
  substack: '✉️',
  youtube: '▶️',
  tiktok: '🎵',
  instagram: '📷',
  linkedin: '💼',
  reddit: '🤖',
  pinterest: '📌',
};

// ─── Platform state prefixes ──────────────────────────────────────────────

function getStatePrefix(platform: string): string | null {
  const map: Record<string, string> = {
    medium: MEDIUM_STATE_PREFIX,
    youtube: YOUTUBE_STATE_PREFIX,
    linkedin: LINKEDIN_STATE_PREFIX,
    instagram: INSTAGRAM_STATE_PREFIX,
    pinterest: PINTEREST_STATE_PREFIX,
    tiktok: TIKTOK_STATE_PREFIX,
  };
  return map[platform] ?? null;
}

// ─── GET /api/accounts/connected — List all connected accounts ────────────

export async function handleListConnectedAccounts(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const wallet = session.address.toLowerCase();
  const indexKey = connectedUserIndexKey(wallet);

  let platforms: string[] = [];
  try {
    const raw = await env.CACHE?.get(indexKey);
    if (raw) platforms = JSON.parse(raw) as string[];
  } catch {
    // Corrupt index — treat as empty
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
      const acct = JSON.parse(raw) as ConnectedAccount;
      accounts.push({
        platform: acct.platform,
        label: acct.label,
        icon: PLATFORM_ICONS[acct.platform] || '🔗',
        connectedAt: acct.connectedAt,
        platformUserId: acct.platformUserId,
        metadata: acct.metadata,
        expiresAt: acct.expiresAt,
      });
    } catch {
      // Skip corrupt entries
    }
  }

  return jsonResponse({ accounts });
}

// ─── POST /api/accounts/connect/:platform — Initiate OAuth ────────────────

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

  // Generate OAuth state for CSRF protection
  const state = generateOAuthState();
  const statePrefix = getStatePrefix(platform);
  if (statePrefix) {
    await storeState(env, state, statePrefix);
  }

  const url = new URL(request.url);
  const baseUrl = `${url.protocol}//${url.hostname}`;
  const redirectUri = `${baseUrl}/api/accounts/callback/${platform}`;

  // Build platform-specific OAuth URLs
  const oauthUrl = buildOAuthUrl(platform, env, state, redirectUri);
  if (oauthUrl instanceof Response) return oauthUrl;

  return jsonResponse({
    authorizeUrl: oauthUrl,
    state,
    platform,
    label: PLATFORM_LABELS[platform] || platform,
  });
}

// ─── Build OAuth URLs per platform ────────────────────────────────────────

function buildOAuthUrl(
  platform: string,
  env: Env,
  state: string,
  redirectUri: string,
): string | Response {
  switch (platform) {
    case 'medium':
      return buildMediumOAuthUrl(env, state, redirectUri);
    case 'youtube':
      return buildYouTubeOAuthUrl(env, state, redirectUri);
    case 'linkedin':
      return buildLinkedInOAuthUrl(env, state, redirectUri);
    case 'instagram':
      return buildInstagramOAuthUrl(env, state, redirectUri);
    case 'reddit':
      return buildRedditOAuthUrl(env, state, redirectUri);
    case 'pinterest':
      return buildPinterestOAuthUrl(env, state, redirectUri);
    case 'tiktok':
      return buildTikTokOAuthUrl(env, state, redirectUri);
    case 'substack':
      // Substack has no public API — use email-based publishing
      return jsonResponse({
        note: 'Substack has no public OAuth API. Use the /api/accounts/connect/substack/email endpoint to set up email-to-post publishing.',
        manual: true,
        platform: 'substack',
      });
    default:
      return jsonResponse({ error: `Unsupported platform: ${platform}` }, 400);
  }
}

function buildMediumOAuthUrl(env: Env, state: string, redirectUri: string): string {
  const clientId = env.MEDIUM_CLIENT_ID || '';
  const scopes = encodeURIComponent('basicProfile,publishPost');
  return (
    `https://medium.com/m/oauth/authorize?` +
    `client_id=${clientId}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `state=${state}&` +
    `response_type=code&` +
    `scope=${scopes}`
  );
}

function buildYouTubeOAuthUrl(env: Env, state: string, redirectUri: string): string {
  const clientId = env.GOOGLE_CLIENT_ID || '';
  const scopes = encodeURIComponent(
    'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly',
  );
  return (
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${clientId}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `state=${state}&` +
    `response_type=code&` +
    `access_type=offline&` +
    `prompt=consent&` +
    `scope=${scopes}`
  );
}

function buildLinkedInOAuthUrl(env: Env, state: string, redirectUri: string): string {
  const clientId = env.LINKEDIN_CLIENT_ID || '';
  const scopes = encodeURIComponent('w_member_social email openid profile');
  return (
    `https://www.linkedin.com/oauth/v2/authorization?` +
    `response_type=code&` +
    `client_id=${clientId}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `state=${state}&` +
    `scope=${scopes}`
  );
}

function buildInstagramOAuthUrl(env: Env, state: string, redirectUri: string): string {
  const appId = env.INSTAGRAM_APP_ID || '';
  const scopes = encodeURIComponent('instagram_business_basic,instagram_business_content_publish');
  return (
    `https://www.facebook.com/v19.0/dialog/oauth?` +
    `client_id=${appId}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `state=${state}&` +
    `response_type=code&` +
    `scope=${scopes}`
  );
}

function buildRedditOAuthUrl(env: Env, state: string, redirectUri: string): string {
  const clientId = env.REDDIT_CLIENT_ID || '';
  const scopes = encodeURIComponent('identity submit edit read');
  return (
    `https://www.reddit.com/api/v1/authorize?` +
    `client_id=${clientId}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `state=${state}&` +
    `response_type=code&` +
    `duration=permanent&` +
    `scope=${scopes}`
  );
}

function buildPinterestOAuthUrl(env: Env, state: string, redirectUri: string): string {
  const clientId = env.PINTEREST_CLIENT_ID || '';
  const scopes = encodeURIComponent('boards:read,boards:write,pins:read,pins:write');
  return (
    `https://www.pinterest.com/oauth/?` +
    `client_id=${clientId}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `state=${state}&` +
    `response_type=code&` +
    `scope=${scopes}`
  );
}

function buildTikTokOAuthUrl(env: Env, state: string, redirectUri: string): string {
  const clientKey = env.TIKTOK_CLIENT_KEY || '';
  const scopes = encodeURIComponent('user.info.basic,video.publish,video.upload');
  return (
    `https://www.tiktok.com/v2/auth/authorize?` +
    `client_key=${clientKey}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `state=${state}&` +
    `response_type=code&` +
    `scope=${scopes}`
  );
}

// ─── GET /api/accounts/callback/:platform — OAuth callback ────────────────

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

  // Validate state (CSRF)
  const statePrefix = getStatePrefix(platform);
  if (statePrefix) {
    const valid = await consumeState(env, state, statePrefix);
    if (!valid) {
      return jsonResponse({ error: 'Invalid or expired OAuth state' }, 403);
    }
  }

  // Exchange code for tokens
  const tokenResult = await exchangeCodeForToken(platform, code, env, url);
  if (tokenResult instanceof Response) return tokenResult;

  // Get session to associate with this account
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const wallet = session.address.toLowerCase();
  const account: ConnectedAccount = {
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

  // Persist to KV
  try {
    await env.CACHE?.put(
      connectedAccountKey(wallet, platform),
      JSON.stringify(account),
      { expirationTtl: 60 * 60 * 24 * 365 }, // 1 year
    );

    // Update user's platform index
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

// ─── Token exchange per platform ──────────────────────────────────────────

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

async function exchangeRedditCode(
  code: string,
  env: Env,
  redirectUri: string,
): Promise<{
  accessToken: string;
  refreshToken?: string;
  platformUserId: string;
  label: string;
  expiresAt?: number;
  metadata?: Record<string, string>;
}> {
  const clientId = env.REDDIT_CLIENT_ID || '';
  const clientSecret = env.REDDIT_CLIENT_SECRET || '';
  const basicAuth = btoa(`${clientId}:${clientSecret}`);

  const resp = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'degenfeed:centralized-poster:1.0 (by /u/degenfeed)',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }).toString(),
  });

  const data = (await resp.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  // Fetch identity to get username
  const identityResp = await fetch('https://oauth.reddit.com/api/v1/me', {
    headers: {
      Authorization: `Bearer ${data.access_token}`,
      'User-Agent': 'degenfeed:centralized-poster:1.0',
    },
  });
  const identity = (await identityResp.json()) as { name?: string; id?: string };

  return {
    accessToken: data.access_token || '',
    refreshToken: data.refresh_token,
    platformUserId: identity.id || identity.name || 'unknown',
    label: `Reddit: u/${identity.name || 'unknown'}`,
    expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
    metadata: { username: identity.name || '' },
  };
}

async function exchangeMediumCode(
  code: string,
  env: Env,
  redirectUri: string,
): Promise<{
  accessToken: string;
  refreshToken?: string;
  platformUserId: string;
  label: string;
  expiresAt?: number;
  metadata?: Record<string, string>;
}> {
  const clientId = env.MEDIUM_CLIENT_ID || '';
  const clientSecret = env.MEDIUM_CLIENT_SECRET || '';

  const resp = await fetch('https://api.medium.com/v1/tokens', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      'Accept-Charset': 'utf-8',
    },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }).toString(),
  });

  const data = (await resp.json()) as {
    access_token?: string;
    refresh_token?: string;
    token_type?: string;
  };

  const accessToken = data.access_token || '';

  // Fetch user info
  const userResp = await fetch('https://api.medium.com/v1/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Accept-Charset': 'utf-8',
    },
  });
  const userData = (await userResp.json()) as {
    data?: { id?: string; username?: string; name?: string; imageUrl?: string };
  };
  const user = userData?.data;

  return {
    accessToken,
    refreshToken: data.refresh_token,
    platformUserId: user?.id || 'unknown',
    label: `Medium: ${user?.name || user?.username || 'unknown'}`,
    metadata: {
      username: user?.username || '',
      name: user?.name || '',
      ...(user?.imageUrl ? { avatarUrl: user.imageUrl } : {}),
    },
  };
}

async function exchangeGoogleCode(
  code: string,
  env: Env,
  redirectUri: string,
  _platform: string,
): Promise<{
  accessToken: string;
  refreshToken?: string;
  platformUserId: string;
  label: string;
  expiresAt?: number;
  metadata?: Record<string, string>;
}> {
  const clientId = env.GOOGLE_CLIENT_ID || '';
  const clientSecret = env.GOOGLE_CLIENT_SECRET || '';

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }).toString(),
  });

  const data = (await resp.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  const accessToken = data.access_token || '';

  // Fetch YouTube channel info
  const chResp = await fetch(
    'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  const chData = (await chResp.json()) as {
    items?: Array<{
      id?: string;
      snippet?: { title?: string; thumbnails?: { default?: { url?: string } } };
    }>;
  };
  const channel = chData?.items?.[0];

  return {
    accessToken,
    refreshToken: data.refresh_token,
    platformUserId: channel?.id || 'unknown',
    label: `YouTube: ${channel?.snippet?.title || 'unknown'}`,
    expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
    metadata: {
      channelName: channel?.snippet?.title || '',
      ...(channel?.snippet?.thumbnails?.default?.url
        ? { avatarUrl: channel.snippet.thumbnails.default.url }
        : {}),
    },
  };
}

async function exchangeLinkedInCode(
  code: string,
  env: Env,
  redirectUri: string,
): Promise<{
  accessToken: string;
  refreshToken?: string;
  platformUserId: string;
  label: string;
  expiresAt?: number;
  metadata?: Record<string, string>;
}> {
  const clientId = env.LINKEDIN_CLIENT_ID || '';
  const clientSecret = env.LINKEDIN_CLIENT_SECRET || '';

  const resp = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }).toString(),
  });

  const data = (await resp.json()) as {
    access_token?: string;
    expires_in?: number;
  };

  const accessToken = data.access_token || '';

  // Fetch user info
  const userResp = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const userData = (await userResp.json()) as {
    sub?: string;
    name?: string;
    given_name?: string;
    family_name?: string;
    picture?: string;
  };

  return {
    accessToken,
    platformUserId: userData.sub || 'unknown',
    label: `LinkedIn: ${userData.name || userData.given_name || 'unknown'}`,
    metadata: {
      name: userData.name || '',
      givenName: userData.given_name || '',
      ...(userData.picture ? { avatarUrl: userData.picture } : {}),
    },
  };
}

async function exchangeInstagramCode(
  code: string,
  env: Env,
  redirectUri: string,
): Promise<{
  accessToken: string;
  refreshToken?: string;
  platformUserId: string;
  label: string;
  expiresAt?: number;
  metadata?: Record<string, string>;
}> {
  const appId = env.INSTAGRAM_APP_ID || '';
  const appSecret = env.INSTAGRAM_APP_SECRET || '';

  // Exchange short-lived token
  const resp = await fetch('https://graph.facebook.com/v19.0/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      redirect_uri: redirectUri,
      code,
    }).toString(),
  });

  const data = (await resp.json()) as {
    access_token?: string;
    expires_in?: number;
  };

  const shortToken = data.access_token || '';

  // Exchange for long-lived token
  const longResp = await fetch(
    `https://graph.facebook.com/v19.0/oauth/access_token?` +
      `grant_type=fb_exchange_token&` +
      `client_id=${appId}&` +
      `client_secret=${appSecret}&` +
      `fb_exchange_token=${shortToken}`,
  );
  const longData = (await longResp.json()) as {
    access_token?: string;
    expires_in?: number;
  };

  const longToken = longData.access_token || shortToken;

  // Fetch Instagram Business Account ID
  const accountsResp = await fetch(
    `https://graph.facebook.com/v19.0/me/accounts?access_token=${longToken}`,
  );
  const accountsData = (await accountsResp.json()) as {
    data?: Array<{ id?: string; name?: string }>;
  };
  const page = accountsData?.data?.[0];

  return {
    accessToken: longToken,
    platformUserId: page?.id || 'unknown',
    label: `Instagram: ${page?.name || 'unknown'}`,
    expiresAt: longData.expires_in ? Date.now() + longData.expires_in * 1000 : undefined,
    metadata: { pageName: page?.name || '' },
  };
}

async function exchangePinterestCode(
  code: string,
  env: Env,
  redirectUri: string,
): Promise<{
  accessToken: string;
  refreshToken?: string;
  platformUserId: string;
  label: string;
  expiresAt?: number;
  metadata?: Record<string, string>;
}> {
  const clientId = env.PINTEREST_CLIENT_ID || '';
  const clientSecret = env.PINTEREST_CLIENT_SECRET || '';

  const resp = await fetch('https://api.pinterest.com/v5/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }).toString(),
  });

  const data = (await resp.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  const accessToken = data.access_token || '';

  // Fetch user info
  const userResp = await fetch('https://api.pinterest.com/v5/user_account', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const userData = (await userResp.json()) as {
    username?: string;
    id?: string;
    profile_image?: string;
  };

  return {
    accessToken,
    refreshToken: data.refresh_token,
    platformUserId: userData.id || 'unknown',
    label: `Pinterest: ${userData.username || 'unknown'}`,
    expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
    metadata: {
      username: userData.username || '',
      ...(userData.profile_image ? { avatarUrl: userData.profile_image } : {}),
    },
  };
}

async function exchangeTikTokCode(
  code: string,
  env: Env,
  redirectUri: string,
): Promise<{
  accessToken: string;
  refreshToken?: string;
  platformUserId: string;
  label: string;
  expiresAt?: number;
  metadata?: Record<string, string>;
}> {
  const clientKey = env.TIKTOK_CLIENT_KEY || '';
  const clientSecret = env.TIKTOK_CLIENT_SECRET || '';

  const resp = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cache-Control': 'no-cache',
    },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }).toString(),
  });

  const data = (await resp.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  const accessToken = data.access_token || '';

  // Fetch user info
  const userResp = await fetch(
    'https://open.tiktokapis.com/v2/user/info/?fields=display_name,username',
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
  const userData = (await userResp.json()) as {
    data?: { user?: { display_name?: string; username?: string } };
  };
  const user = userData?.data?.user;

  return {
    accessToken,
    refreshToken: data.refresh_token,
    platformUserId: 'tiktok_user',
    label: `TikTok: ${user?.display_name || user?.username || 'unknown'}`,
    expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
    metadata: {
      displayName: user?.display_name || '',
      username: user?.username || '',
    },
  };
}

// ─── DELETE /api/accounts/disconnect/:platform — Disconnect ───────────────

export async function handleDisconnectPlatform(
  request: Request,
  env: Env,
  platform: string,
): Promise<Response> {
  if (request.method !== 'DELETE') return methodNotAllowed(['DELETE']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const wallet = session.address.toLowerCase();

  try {
    await env.CACHE?.delete(connectedAccountKey(wallet, platform));
    await removePlatformFromIndex(env, wallet, platform);
  } catch {
    return jsonResponse({ error: 'Failed to disconnect' }, 500);
  }

  return jsonResponse({ ok: true, platform });
}

// ─── GET /api/accounts/status/:platform — Check connection status ─────────

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
    if (!raw) {
      return jsonResponse({ connected: false, platform });
    }
    const acct = JSON.parse(raw) as ConnectedAccount;
    return jsonResponse({
      connected: true,
      platform: acct.platform,
      label: acct.label,
      platformUserId: acct.platformUserId,
      connectedAt: acct.connectedAt,
      metadata: acct.metadata,
      expiresAt: acct.expiresAt,
    });
  } catch {
    return jsonResponse({ connected: false, platform, error: 'Failed to read status' });
  }
}

// ─── Substack email setup ─────────────────────────────────────────────────

export async function handleSubstackEmailSetup(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const wallet = session.address.toLowerCase();

  if (request.method === 'POST') {
    // User provides their Substack email-to-post address
    let body: { email?: string; substackUrl?: string };
    try {
      body = (await request.json()) as { email?: string; substackUrl?: string };
    } catch {
      return jsonResponse({ error: 'Invalid JSON' }, 400);
    }

    if (!body.email && !body.substackUrl) {
      return jsonResponse({ error: 'email or substackUrl required' }, 400);
    }

    const account: ConnectedAccount = {
      platform: 'substack',
      label: `Substack: ${body.substackUrl || body.email || 'unknown'}`,
      accessToken: '', // No token for email-based publishing
      platformUserId: body.email || body.substackUrl || 'unknown',
      connectedAt: new Date().toISOString(),
      metadata: {
        ...(body.email ? { emailToPost: body.email } : {}),
        ...(body.substackUrl ? { substackUrl: body.substackUrl } : {}),
      },
    };

    await env.CACHE?.put(connectedAccountKey(wallet, 'substack'), JSON.stringify(account), {
      expirationTtl: 60 * 60 * 24 * 365,
    });
    await addPlatformToIndex(env, wallet, 'substack');

    return jsonResponse({ ok: true, platform: 'substack', label: account.label });
  }

  // GET — return info on how to set up Substack
  return jsonResponse({
    available: true,
    manual: true,
    instructions:
      "Substack doesn't provide a public API. To enable cross-posting, " +
      "provide your Substack email-to-post address from Substack's " +
      "Settings → Email → 'Email to post' address.",
  });
}

// ─── Index helpers ────────────────────────────────────────────────────────

async function addPlatformToIndex(env: Env, wallet: string, platform: string): Promise<void> {
  try {
    const key = connectedUserIndexKey(wallet);
    const raw = await env.CACHE?.get(key);
    const platforms: string[] = raw ? (JSON.parse(raw) as string[]) : [];
    if (!platforms.includes(platform)) {
      platforms.push(platform);
      await env.CACHE?.put(key, JSON.stringify(platforms), {
        expirationTtl: 60 * 60 * 24 * 365,
      });
    }
  } catch {
    // Non-fatal
  }
}

async function removePlatformFromIndex(env: Env, wallet: string, platform: string): Promise<void> {
  try {
    const key = connectedUserIndexKey(wallet);
    const raw = await env.CACHE?.get(key);
    if (!raw) return;
    const platforms: string[] = JSON.parse(raw) as string[];
    const filtered = platforms.filter((p) => p !== platform);
    await env.CACHE?.put(key, JSON.stringify(filtered), {
      expirationTtl: 60 * 60 * 24 * 365,
    });
  } catch {
    // Non-fatal
  }
}

// ─── Access token retrieval (for cross-posting) ───────────────────────────

/**
 * Retrieve the stored access token for a user's connected platform.
 * Used by the cross-post-centralized handlers.
 */
export async function getConnectedAccount(
  env: Env,
  wallet: string,
  platform: string,
): Promise<ConnectedAccount | null> {
  try {
    const raw = await env.CACHE?.get(connectedAccountKey(wallet, platform));
    if (!raw) return null;
    return JSON.parse(raw) as ConnectedAccount;
  } catch {
    return null;
  }
}

// ─── Re-export platform info for UI ───────────────────────────────────────

export { CENTRALIZED_PLATFORMS, PLATFORM_ICONS, PLATFORM_LABELS };
