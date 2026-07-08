import { type Env, getGtsConfig, jsonResponse } from '../index';

const STATE_KEY_PREFIX = 'gts:state:';
const STATE_TTL_SECONDS = 600; // 10 minutes

function generateState(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function storeState(env: Env, state: string): Promise<void> {
  if (!env.CACHE) return; // dev mode: skip state persistence
  try {
    await env.CACHE.put(STATE_KEY_PREFIX + state, '1', {
      expirationTtl: STATE_TTL_SECONDS,
    });
  } catch {
    /* KV hiccup — fall through; we'll fail-closed on callback */
  }
}

async function consumeState(env: Env, state: string): Promise<boolean> {
  if (!env.CACHE) return true; // dev mode: trust all states
  try {
    const existing = await env.CACHE.get(STATE_KEY_PREFIX + state);
    if (!existing) return false;
    // Best-effort delete to prevent replay.
    await env.CACHE.delete(STATE_KEY_PREFIX + state);
    return true;
  } catch {
    return false;
  }
}

/**
 * GET /api/auth/gotosocial/authorize?redirect=...
 *
 * Generates a CSRF `state` nonce, stores it in KV, and returns the
 * authorize URL the client should redirect the user to. The `state`
 * parameter must be echoed back to /api/auth/gotosocial/callback.
 */
export async function handleGtSAuthorize(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const redirect = url.searchParams.get('redirect') || getGtsConfig(env).redirectUri;
  const devMode = url.searchParams.get('dev') === 'true';

  const state = generateState();
  await storeState(env, state);

  const params = new URLSearchParams({
    client_id: getGtsConfig(env).clientId,
    redirect_uri: devMode ? 'urn:ietf:wg:oauth:2.0:oob' : redirect,
    response_type: 'code',
    scope: getGtsConfig(env).scopes,
    state,
  });
  const authorizeUrl = devMode
    ? `http://127.0.0.1:8082/oauth/authorize?${params.toString()}`
    : `https://social.degenfeed.xyz/oauth/authorize?${params.toString()}`;

  return jsonResponse({
    authorizeUrl,
    state,
    instanceUrl: getGtsConfig(env).instanceUrl,
    dev: devMode,
  });
}

/**
 * POST /api/auth/gotosocial/callback
 * Body: { code: string, state: string, redirect_uri?: string }
 *
 * Verifies the `state` nonce against KV (CSRF protection) before exchanging
 * the OAuth authorization code for an access token.
 */
export async function handleGtSCallback(request: Request, env: Env): Promise<Response> {
  try {
    const body = (await request.json()) as {
      code?: string;
      state?: string;
      redirect_uri?: string;
    };
    if (!body.code) {
      return jsonResponse({ error: 'Missing authorization code' }, 400);
    }
    if (!body.state) {
      return jsonResponse({ error: 'Missing state nonce' }, 400);
    }

    const stateValid = await consumeState(env, body.state);
    if (!stateValid) {
      return jsonResponse({ error: 'Invalid or expired state' }, 400);
    }

    const redirectUri = body.redirect_uri || getGtsConfig(env).redirectUri;
    const tokenRes = await fetch(`${getGtsConfig(env).apiBase}/oauth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: getGtsConfig(env).clientId,
        client_secret: getGtsConfig(env).clientSecret,
        redirect_uri: redirectUri,
        code: body.code,
        scope: getGtsConfig(env).scopes,
      }).toString(),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      return jsonResponse({ error: 'Token exchange failed', detail: errText }, 400);
    }

    const tokenData = (await tokenRes.json()) as Record<string, unknown>;

    // Fetch user profile
    const accessToken = tokenData.access_token as string;
    const userRes = await fetch(`${getGtsConfig(env).apiBase}/api/v1/accounts/verify_credentials`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const profile = userRes.ok ? ((await userRes.json()) as Record<string, unknown>) : null;

    return jsonResponse({
      accessToken,
      refreshToken: tokenData.refresh_token,
      scope: tokenData.scope,
      createdAt: tokenData.created_at,
      expiresIn: tokenData.expires_in,
      tokenType: tokenData.token_type,
      profile: profile
        ? {
            id: profile.id,
            username: profile.username,
            acct: profile.acct,
            displayName: profile.display_name,
            avatar: profile.avatar,
            url: profile.url,
          }
        : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Callback error';
    return jsonResponse({ error: message }, 500);
  }
}

/**
 * POST /api/auth/gotosocial/register
 * Generates a state nonce and the authorize URL the user should visit.
 * The state must be echoed back to /api/auth/gotosocial/callback.
 */
export async function handleGtSRegister(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const redirect = url.searchParams.get('redirect') || getGtsConfig(env).redirectUri;
  const devMode = url.searchParams.get('dev') === 'true';

  const state = generateState();
  await storeState(env, state);

  const params = new URLSearchParams({
    client_id: getGtsConfig(env).clientId,
    redirect_uri: devMode ? 'urn:ietf:wg:oauth:2.0:oob' : redirect,
    response_type: 'code',
    scope: getGtsConfig(env).scopes,
    state,
    sign_up: 'true',
  });
  const authorizeUrl = devMode
    ? `http://127.0.0.1:8082/oauth/authorize?${params.toString()}`
    : `https://social.degenfeed.xyz/oauth/authorize?${params.toString()}`;

  return jsonResponse({
    success: true,
    message:
      'Redirect user to the authorize URL. They will be prompted to sign up if they do not have an account.',
    authorizeUrl,
    state,
    instanceUrl: getGtsConfig(env).instanceUrl,
  });
}
