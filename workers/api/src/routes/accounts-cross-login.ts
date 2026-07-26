/**
 * @degenfeed/api-worker — Cross-Instance Login
 *
 * Users can use their DegenFeed credentials to login to external instances
 * of supported protocols. This is how ActivityPub/AT Protocol federation
 * works — we make it seamless.
 *
 * Routes:
 *   POST /api/accounts/cross-login/mastodon — Login to any Mastodon instance
 *   POST /api/accounts/cross-login/bluesky  — Login to any Bluesky client
 *   POST /api/accounts/cross-login/farcaster — Sign in to any Farcaster client
 *   POST /api/accounts/cross-login/matrix   — Login to any Matrix homeserver
 *   POST /api/accounts/cross-login/peertube — Login to any PeerTube instance
 *   POST /api/accounts/cross-login/lemmy    — Login to any Lemmy instance
 *   POST /api/accounts/cross-login/pixelfed — Login to any Pixelfed instance
 *   GET  /api/accounts/cross-login/credentials — Get federation credentials
 *   GET  /api/accounts/cross-login/sso-token   — Get SSO token for external auth
 *
 * Each endpoint returns the credentials/token needed to authenticate
 * on the target instance using the user's DegenFeed identity.
 */

import { log } from '../index';
import { sealForWallet } from '../lib/crypto-seal';
import { checkPremiumStatus } from '../premium';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────

interface CrossLoginRequest {
  /** Target instance URL */
  instanceUrl: string;
  /** Optional: custom username override */
  username?: string;
}

interface CrossLoginResponse {
  protocol: string;
  instanceUrl: string;
  method: 'oauth' | 'token' | 'key' | 'sso';
  credentials: {
    username?: string;
    accessToken?: string;
    refreshToken?: string;
    appPassword?: string;
    apiKey?: string;
    did?: string;
    fid?: number;
    expiresAt?: number;
  };
  loginUrl?: string;
  instructions?: string;
}

// ─── POST /api/accounts/cross-login/mastodon ─────────────────────────────

export async function handleCrossLoginMastodon(request: Request, env: Env): Promise<Response> {
  return handleCrossLoginProtocol(request, env, 'mastodon', async (wallet, instanceUrl) => {
    // Fetch stored GtS/Mastodon credentials from our platform accounts
    const credentials = await getProtocolCredentials(wallet, 'mastodon', env);
    if (!credentials?.accessToken) {
      return jsonResponse(
        {
          error: 'No Mastodon account found. Register first via POST /api/accounts/join-all',
          registerUrl: '/api/accounts/join-all',
        },
        404,
      );
    }

    // Obtain an OAuth token for the target instance using our identity
    const appRes = await fetch(`${instanceUrl.replace(/\/$/, '')}/api/v1/apps`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': 'DegenFeed/0.1' },
      body: JSON.stringify({
        client_name: 'DegenFeed Cross-Login',
        redirect_uris: 'urn:ietf:wg:oauth:2.0:oob',
        scopes: 'read write follow',
        website: 'https://degenfeed.xyz',
      }),
    });
    if (!appRes.ok) {
      return jsonResponse(
        {
          error: `Failed to register app on ${instanceUrl}. Ensure the instance allows registration.`,
          instanceUrl,
        },
        400,
      );
    }
    const appData = (await appRes.json()) as { client_id?: string; client_secret?: string };

    // Exchange for access token using our stored credentials
    const tokenRes = await fetch(`${instanceUrl.replace(/\/$/, '')}/oauth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        client_id: appData.client_id,
        client_secret: appData.client_secret,
        grant_type: 'password',
        username: credentials.username,
        password: credentials.password,
        scope: 'read write follow',
      }),
    });

    if (!tokenRes.ok) {
      return jsonResponse(
        {
          error: `Login to ${instanceUrl} failed. The instance may not accept external credentials.`,
          note: 'Try using the Mastodon OAuth flow directly.',
        },
        403,
      );
    }

    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      refresh_token?: string;
      created_at?: number;
    };

    return jsonResponse({
      protocol: 'mastodon',
      instanceUrl,
      method: 'oauth',
      credentials: {
        username: credentials.username,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: tokenData.created_at ? Date.now() + 86400000 : undefined,
      },
      loginUrl: `${instanceUrl}/oauth/authorize?client_id=${appData.client_id}&scope=read+write+follow`,
      instructions: `Use the access token to authenticate on ${instanceUrl}. Set Authorization: Bearer ${(tokenData.access_token || '').slice(0, 8)}... in API calls.`,
    });
  });
}

// ─── POST /api/accounts/cross-login/bluesky ──────────────────────────────

export async function handleCrossLoginBluesky(request: Request, env: Env): Promise<Response> {
  return handleCrossLoginProtocol(request, env, 'bluesky', async (wallet, instanceUrl) => {
    const credentials = await getProtocolCredentials(wallet, 'bluesky', env);
    if (!credentials) {
      return jsonResponse(
        {
          error: 'No Bluesky account found. Register first via POST /api/accounts/join-all',
          registerUrl: '/api/accounts/join-all',
        },
        404,
      );
    }

    // Bluesky cross-login uses the PDS API with app password
    const pdsUrl = instanceUrl || 'https://bsky.social';
    const loginRes = await fetch(`${pdsUrl}/xrpc/com.atproto.server.createSession`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        identifier: credentials.username || credentials.did,
        password: credentials.appPassword || credentials.password,
      }),
    });

    if (!loginRes.ok) {
      return jsonResponse(
        {
          error: `Login to Bluesky PDS ${pdsUrl} failed.`,
          note: 'Your DegenFeed PDS account uses a separate app password for external auth.',
        },
        403,
      );
    }

    const sessionData = (await loginRes.json()) as {
      accessJwt?: string;
      refreshJwt?: string;
      did?: string;
      handle?: string;
    };

    return jsonResponse({
      protocol: 'bluesky',
      instanceUrl: pdsUrl,
      method: 'token',
      credentials: {
        did: sessionData.did || credentials.did,
        username: sessionData.handle || credentials.username,
        accessToken: sessionData.accessJwt,
        refreshToken: sessionData.refreshJwt,
        appPassword: credentials.appPassword,
      },
      instructions:
        'Use accessJwt as Bearer token in XRPC calls. For AT Protocol: set Authorization header.',
    });
  });
}

// ─── POST /api/accounts/cross-login/farcaster ───────────────────────────

export async function handleCrossLoginFarcaster(request: Request, env: Env): Promise<Response> {
  return handleCrossLoginProtocol(request, env, 'farcaster', async (wallet, instanceUrl) => {
    const credentials = await getProtocolCredentials(wallet, 'farcaster', env);
    if (!credentials?.fid) {
      return jsonResponse(
        {
          error: 'No Farcaster account found. Register first via POST /api/accounts/join-all',
          registerUrl: '/api/accounts/join-all',
        },
        404,
      );
    }

    // Farcaster uses EIP-712 signed keys for auth — we provide the signed key package
    const hubUrl = instanceUrl || 'https://hub.degenfeed.xyz';

    // Generate a signed key for the target Farcaster client
    const signKeyRes = await fetch(`${hubUrl}/v1/signed-key`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        fid: credentials.fid,
        custodyAddress: credentials.custodyAddress,
        deadline: Math.floor(Date.now() / 1000) + 86400, // 24 hours
      }),
    });

    if (!signKeyRes.ok) {
      return jsonResponse(
        {
          error: 'Failed to generate Farcaster signed key.',
          note: 'You may need to sign with your custody address wallet.',
        },
        403,
      );
    }

    const keyData = (await signKeyRes.json()) as {
      signature?: string;
      key?: string;
      deadline?: number;
    };

    return jsonResponse({
      protocol: 'farcaster',
      instanceUrl: hubUrl,
      method: 'key',
      credentials: {
        fid: credentials.fid,
        apiKey: keyData.key,
        username: credentials.username,
        accessToken: keyData.signature,
        expiresAt: keyData.deadline ? keyData.deadline * 1000 : undefined,
      },
      loginUrl: hubUrl,
      instructions: `Use the signed key to authenticate on Farcaster hubs. FID: ${credentials.fid}. Key expires in 24h.`,
    });
  });
}

// ─── POST /api/accounts/cross-login/matrix ──────────────────────────────

export async function handleCrossLoginMatrix(request: Request, env: Env): Promise<Response> {
  return handleCrossLoginProtocol(request, env, 'matrix', async (wallet, instanceUrl) => {
    const homeserver = instanceUrl || 'https://matrix.degenfeed.xyz';

    // Matrix uses SSO token-based auth. Generate a login token.
    const ssoToken = await generateSSOToken(wallet, 'matrix', env);

    return jsonResponse({
      protocol: 'matrix',
      instanceUrl: homeserver,
      method: 'sso',
      credentials: {
        username: `@df_${wallet.slice(2, 10)}:${new URL(homeserver).hostname}`,
        accessToken: ssoToken,
      },
      loginUrl: `${homeserver}/_matrix/client/v3/login/sso/redirect?redirectUrl=${encodeURIComponent('https://degenfeed.xyz/auth/callback')}`,
      instructions:
        'Use SSO token to authenticate via the Matrix login API. Token expires in 1 hour.',
    });
  });
}

// ─── POST /api/accounts/cross-login/peertube ────────────────────────────

export async function handleCrossLoginPeerTube(request: Request, env: Env): Promise<Response> {
  return handleCrossLoginProtocol(request, env, 'peertube', async (wallet, instanceUrl) => {
    const credentials = await getProtocolCredentials(wallet, 'peertube', env);
    if (!credentials?.accessToken) {
      return jsonResponse(
        {
          error: 'No PeerTube account found. Register first via POST /api/accounts/join-all',
          registerUrl: '/api/accounts/join-all',
        },
        404,
      );
    }

    const apiBase = `${instanceUrl.replace(/\/$/, '')}/api/v1`;
    const loginRes = await fetch(`${apiBase}/users/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        username: credentials.username,
        password: credentials.password,
      }),
    });

    if (!loginRes.ok) {
      return jsonResponse(
        {
          error: `Login to PeerTube instance ${instanceUrl} failed.`,
        },
        403,
      );
    }

    const loginData = (await loginRes.json()) as {
      access_token?: string;
      refresh_token?: string;
    };

    return jsonResponse({
      protocol: 'peertube',
      instanceUrl,
      method: 'oauth',
      credentials: {
        username: credentials.username,
        accessToken: loginData.access_token,
        refreshToken: loginData.refresh_token,
      },
      loginUrl: `${apiBase}/oauth/authorize`,
      instructions: 'Use access_token for PeerTube API calls. Authorization: Bearer <token>',
    });
  });
}

// ─── POST /api/accounts/cross-login/lemmy ───────────────────────────────

export async function handleCrossLoginLemmy(request: Request, env: Env): Promise<Response> {
  return handleCrossLoginProtocol(request, env, 'lemmy', async (wallet, instanceUrl) => {
    const credentials = await getProtocolCredentials(wallet, 'lemmy', env);
    if (!credentials?.password) {
      return jsonResponse(
        {
          error: 'No Lemmy account found. Register first via POST /api/accounts/join-all',
          registerUrl: '/api/accounts/join-all',
        },
        404,
      );
    }

    const apiBase = `${instanceUrl.replace(/\/$/, '')}/api/v3`;
    const loginRes = await fetch(`${apiBase}/user/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        username_or_email: credentials.username,
        password: credentials.password,
      }),
    });

    if (!loginRes.ok) {
      return jsonResponse(
        {
          error: `Login to Lemmy instance ${instanceUrl} failed.`,
        },
        403,
      );
    }

    const loginData = (await loginRes.json()) as {
      jwt?: string;
    };

    return jsonResponse({
      protocol: 'lemmy',
      instanceUrl,
      method: 'token',
      credentials: {
        username: credentials.username,
        accessToken: loginData.jwt,
      },
      instructions: 'Use the JWT token in Authorization: Bearer header for Lemmy API calls.',
    });
  });
}

// ─── POST /api/accounts/cross-login/pixelfed ────────────────────────────

export async function handleCrossLoginPixelfed(request: Request, env: Env): Promise<Response> {
  return handleCrossLoginProtocol(request, env, 'pixelfed', async (wallet, instanceUrl) => {
    const credentials = await getProtocolCredentials(wallet, 'pixelfed', env);
    if (!credentials?.accessToken) {
      return jsonResponse(
        {
          error: 'No Pixelfed account found. Register first via POST /api/accounts/join-all',
          registerUrl: '/api/accounts/join-all',
        },
        404,
      );
    }

    // Pixelfed uses Mastodon-compatible OAuth
    const apiBase = `${instanceUrl.replace(/\/$/, '')}/api/v1`;
    const appRes = await fetch(`${apiBase}/apps`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        client_name: 'DegenFeed Cross-Login',
        redirect_uris: 'urn:ietf:wg:oauth:2.0:oob',
        scopes: 'read write follow',
        website: 'https://degenfeed.xyz',
      }),
    });

    if (!appRes.ok) {
      return jsonResponse({ error: `Failed to register app on ${instanceUrl}` }, 400);
    }

    const appData = (await appRes.json()) as { client_id?: string; client_secret?: string };

    const tokenRes = await fetch(`${apiBase}/oauth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        client_id: appData.client_id,
        client_secret: appData.client_secret,
        grant_type: 'password',
        username: credentials.username,
        password: credentials.password,
        scope: 'read write follow',
      }),
    });

    if (!tokenRes.ok) {
      return jsonResponse({ error: `Login to ${instanceUrl} failed.` }, 403);
    }

    const tokenData = (await tokenRes.json()) as { access_token?: string };

    return jsonResponse({
      protocol: 'pixelfed',
      instanceUrl,
      method: 'oauth',
      credentials: {
        username: credentials.username,
        accessToken: tokenData.access_token,
      },
      instructions: 'Use the access token for Pixelfed API calls (Mastodon-compatible).',
    });
  });
}

// ─── GET /api/accounts/cross-login/credentials ──────────────────────────

export async function handleCrossLoginCredentials(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const wallet = session.address;

  // Get credentials from all protocols (masked)
  const protocols = [
    'mastodon',
    'bluesky',
    'farcaster',
    'nostr',
    'lemmy',
    'peertube',
    'pixelfed',
    'writefreely',
    'bookwyrm',
    'funkwhale',
    'mobilizon',
    'owncast',
    'castopod',
  ];
  const result: Record<
    string,
    { available: boolean; username?: string; did?: string; fid?: number }
  > = {};

  for (const protocol of protocols) {
    const creds = await getProtocolCredentials(wallet, protocol, env);
    result[protocol] = {
      available: !!creds,
      username: creds?.username,
      did: creds?.did,
      fid: creds?.fid,
    };
  }

  return noCacheJsonResponse({
    wallet,
    credentials: result,
    availableCount: Object.values(result).filter((r) => r.available).length,
    totalProtocols: protocols.length,
    crossLoginUrls: {
      mastodon: '/api/accounts/cross-login/mastodon',
      bluesky: '/api/accounts/cross-login/bluesky',
      farcaster: '/api/accounts/cross-login/farcaster',
      matrix: '/api/accounts/cross-login/matrix',
      peertube: '/api/accounts/cross-login/peertube',
      lemmy: '/api/accounts/cross-login/lemmy',
      pixelfed: '/api/accounts/cross-login/pixelfed',
    },
  });
}

// ─── GET /api/accounts/cross-login/sso-token ────────────────────────────

export async function handleCrossLoginSSOToken(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const wallet = session.address;
  const url = new URL(request.url);
  const protocol = url.searchParams.get('protocol') || 'all';

  try {
    const { createCrossNetworkSession, signSessionToken } = await import('../lib/sso-bridge');
    const ssoSession = await createCrossNetworkSession(wallet, env);
    const token = await signSessionToken(ssoSession);

    return jsonResponse({
      wallet,
      protocol,
      ssoToken: token,
      expiresAt: ssoSession.expiresAt,
      type: 'cross-network-sso',
      verifyUrl: '/api/sso/session/verify',
      note: 'Use this SSO token to authenticate across all DegenFeed protocol instances.',
    });
  } catch (err) {
    return jsonResponse(
      {
        error: 'Failed to generate SSO token',
        detail: err instanceof Error ? err.message : 'Unknown error',
      },
      500,
    );
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────

/**
 * Generic handler for cross-login protocol requests.
 */
async function handleCrossLoginProtocol(
  request: Request,
  env: Env,
  protocol: string,
  handler: (wallet: string, instanceUrl: string) => Promise<Response>,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const wallet = session.address;

  let body: CrossLoginRequest;
  try {
    body = (await request.json()) as CrossLoginRequest;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body. Required: instanceUrl' }, 400);
  }

  if (!body.instanceUrl) {
    return jsonResponse({ error: 'instanceUrl is required' }, 400);
  }

  try {
    log('info', 'Cross-instance login attempt', {
      protocol,
      instance: body.instanceUrl,
      wallet: wallet.slice(0, 8),
    });

    return await handler(wallet, body.instanceUrl);
  } catch (err) {
    log('error', 'Cross-instance login failed', {
      protocol,
      instance: body.instanceUrl,
      error: err instanceof Error ? err.message : String(err),
    });
    return jsonResponse(
      {
        error: `Cross-instance login failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        protocol,
        instanceUrl: body.instanceUrl,
      },
      502,
    );
  }
}

/**
 * Retrieve stored protocol credentials for a wallet.
 * Searches PLATFORM_ACCOUNTS KV and falls back to IDENTITIES KV.
 */
async function getProtocolCredentials(
  walletAddress: string,
  protocol: string,
  env: Env,
): Promise<{
  username?: string;
  password?: string;
  accessToken?: string;
  appPassword?: string;
  did?: string;
  fid?: number;
  custodyAddress?: string;
} | null> {
  const walletLower = walletAddress.toLowerCase();

  // Try PLATFORM_ACCOUNTS KV first
  if (env.PLATFORM_ACCOUNTS) {
    try {
      const raw = await env.PLATFORM_ACCOUNTS.get(`${protocol}:${walletLower}`);
      if (raw) {
        const data = JSON.parse(raw) as Record<string, string>;
        return {
          username: data.username || data.handle,
          password: data.password,
          accessToken: data.accessToken || data.access_token,
          appPassword: data.appPassword,
          did: data.did,
          fid: data.fid ? Number(data.fid) : undefined,
          custodyAddress: data.custodyAddress || data.recoveryAddress,
        };
      }
    } catch {
      // KV read failed
    }
  }

  // Fallback: try account index
  if (env.PLATFORM_ACCOUNTS) {
    try {
      const raw = await env.PLATFORM_ACCOUNTS.get(`account:${walletLower}`);
      if (raw) {
        const data = JSON.parse(raw) as Record<string, unknown>;
        const proto = data[protocol] as Record<string, string> | undefined;
        if (proto) {
          return {
            username: proto.username || proto.handle,
            password: proto.password,
            accessToken: proto.accessToken || proto.access_token,
            appPassword: proto.appPassword,
            did: proto.did,
            fid: proto.fid ? Number(proto.fid) : undefined,
          };
        }
      }
    } catch {
      // KV read failed
    }
  }

  return null;
}

/**
 * Generate an SSO token for a protocol.
 */
async function generateSSOToken(
  walletAddress: string,
  protocol: string,
  env: Env,
): Promise<string> {
  const nonce = crypto.randomUUID();
  const tokenData = {
    wallet: walletAddress,
    protocol,
    nonce,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600000, // 1 hour
  };

  if (env.IDENTITIES) {
    await env.IDENTITIES.put(
      `sso:xlogin:${walletAddress.toLowerCase()}:${protocol}`,
      JSON.stringify(tokenData),
      { expirationTtl: 3600 },
    );
  }

  return nonce;
}
