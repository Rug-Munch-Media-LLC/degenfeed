import { type Env, getGtsConfig, jsonResponse } from '../index';

export async function handleGtSAuthorize(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const redirect = url.searchParams.get('redirect') || getGtsConfig(env).redirectUri;
  const devMode = url.searchParams.get('dev') === 'true';

  const authorizeUrl = devMode
    ? `http://127.0.0.1:8082/oauth/authorize?client_id=${getGtsConfig(env).clientId}&redirect_uri=urn:ietf:wg:oauth:2.0:oob&response_type=code&scope=${getGtsConfig(env).scopes}`
    : `https://social.degenfeed.xyz/oauth/authorize?client_id=${getGtsConfig(env).clientId}&redirect_uri=${encodeURIComponent(redirect)}&response_type=code&scope=${getGtsConfig(env).scopes}`;

  return jsonResponse({ authorizeUrl, instanceUrl: getGtsConfig(env).instanceUrl, dev: devMode });
}

/**
 * POST /api/auth/gotosocial/callback
 * Exchange an OAuth authorization code for an access token.
 * Body: { code: string, redirect_uri?: string }
 */

export async function handleGtSCallback(request: Request, env: Env): Promise<Response> {
  try {
    const body = (await request.json()) as { code: string; redirect_uri?: string };
    if (!body.code) {
      return jsonResponse({ error: 'Missing authorization code' }, 400);
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
 * Proxy for creating a new account on GotoSocial.
 * This requires an admin token (stored server-side).
 *
 * For v1, this proxies the standard OAuth registration flow.
 * Returns the authorization URL the user should visit.
 */

export async function handleGtSRegister(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const redirect = url.searchParams.get('redirect') || getGtsConfig(env).redirectUri;
  const devMode = url.searchParams.get('dev') === 'true';

  const authorizeUrl = devMode
    ? `http://127.0.0.1:8082/oauth/authorize?client_id=${getGtsConfig(env).clientId}&redirect_uri=urn:ietf:wg:oauth:2.0:oob&response_type=code&scope=${getGtsConfig(env).scopes}&sign_up=true`
    : `https://social.degenfeed.xyz/oauth/authorize?client_id=${getGtsConfig(env).clientId}&redirect_uri=${encodeURIComponent(redirect)}&response_type=code&scope=${getGtsConfig(env).scopes}&sign_up=true`;

  return jsonResponse({
    success: true,
    message:
      'Redirect user to the authorize URL. They will be prompted to sign up if they do not have an account.',
    authorizeUrl,
    instanceUrl: getGtsConfig(env).instanceUrl,
  });
}

// ─── Feed Handlers ─────────────────────────────────────────────────────
