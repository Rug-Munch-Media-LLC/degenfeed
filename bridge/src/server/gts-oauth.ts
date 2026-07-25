/**
 * GTS OAuth2 Helper
 *
 * Handles OAuth2 flows for GoToSocial:
 *   - Application registration (client_credentials)
 *   - User authorization code flow (password grant for automated signup)
 *   - Token refresh / verification
 *
 * GTS runs at http://127.0.0.1:8082
 * Public URL: https://social.degenfeed.xyz
 */

const GTS_BASE = process.env.GTS_BASE || 'http://127.0.0.1:8082';

export interface GtSAppCredentials {
  client_id: string;
  client_secret: string;
  client_id_dev?: string;
  client_secret_dev?: string;
  scopes: string;
  auth_url: string;
  token_url: string;
  instance_url: string;
}

export interface GtSTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  created_at: number;
  /** Only for password grant */
  user?: {
    id: string;
    username: string;
    acct: string;
    display_name: string;
    avatar: string;
    avatar_static: string;
    header: string;
    header_static: string;
  };
}

/**
 * Register a new OAuth application on GTS.
 * Run this once per client (DegenFeed is our app).
 * Returns credentials that can be reused.
 */
export async function registerGtsApp(
  clientName: string = 'DegenFeed',
  redirectUris: string = 'urn:ietf:wg:oauth:2.0:oob',
  scopes: string = 'read write follow push admin:read admin:write',
  website: string = 'https://degenfeed.xyz',
): Promise<GtSAppCredentials> {
  const res = await fetch(`${GTS_BASE}/api/v1/apps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_name: clientName,
      redirect_uris: redirectUris,
      scopes,
      website,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GTS app registration failed (${res.status}): ${text.slice(0, 200)}`);
  }

  return res.json() as Promise<GtSAppCredentials>;
}

/**
 * Get an app-level access token via client_credentials grant.
 * This is used for server-to-server operations (read timelines, admin).
 */
export async function getClientCredentialsToken(
  clientId: string,
  clientSecret: string,
  scopes: string = 'read write follow admin:read admin:write',
): Promise<GtSTokenResponse> {
  const res = await fetch(`${GTS_BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
      redirect_uri: 'urn:ietf:wg:oauth:2.0:oob',
      scope: scopes,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GTS client credentials failed (${res.status}): ${text.slice(0, 200)}`);
  }

  return res.json() as Promise<GtSTokenResponse>;
}

/**
 * Authenticate a user with username/password via OAuth password grant.
 * Returns an access token + user info.
 * GTS supports "password" grant type for first-party clients.
 */
export async function authenticateUser(
  clientId: string,
  clientSecret: string,
  username: string,
  password: string,
  scopes: string = 'read write follow push',
): Promise<GtSTokenResponse> {
  const res = await fetch(`${GTS_BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'password',
      username,
      password,
      scope: scopes,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    if (res.status === 401) {
      throw new Error('Invalid username or password');
    }
    throw new Error(`GTS auth failed (${res.status}): ${text.slice(0, 200)}`);
  }

  return res.json() as Promise<GtSTokenResponse>;
}

/**
 * Verify that a token is still valid by calling verify_credentials.
 * Returns the authenticated account or throws.
 */
export async function verifyToken(accessToken: string): Promise<{
  id: string;
  username: string;
  acct: string;
  display_name: string;
  avatar: string;
  avatar_static: string;
  header: string;
  header_static: string;
  note: string;
  created_at: string;
  followers_count: number;
  following_count: number;
  statuses_count: number;
  locked: boolean;
  bot: boolean;
  discoverable: boolean;
  url: string;
  source?: {
    note: string;
    fields: Array<{ name: string; value: string; verified_at: string | null }>;
  };
  role?: { id: number; name: string; permissions: string };
}> {
  const res = await fetch(`${GTS_BASE}/api/v1/accounts/verify_credentials`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(`Token verification failed (${res.status})`);
  }

  return res.json();
}
