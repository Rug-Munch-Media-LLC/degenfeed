import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockStateStore = new Map<string, string>();

const mockCache = {
  put: vi.fn(async (key: string, value: string) => {
    mockStateStore.set(key, value);
  }),
  get: vi.fn(async (key: string) => mockStateStore.get(key) ?? null),
  delete: vi.fn(async (key: string) => {
    mockStateStore.delete(key);
  }),
} as unknown as KVNamespace;

const CLIENT_ID = 'degenfeed-web';
const CLIENT_SECRET = 'test-oidc-client-secret-0123456789abcdef';
const AUTH_SECRET = 'test-auth-secret-0123456789abcdef0123456789abcdef';
const ISSUER = 'https://rugmunch.io';

const env = {
  CACHE: mockCache,
  AUTH_SECRET,
  RUGMUNCH_OIDC_CLIENT_ID: CLIENT_ID,
  RUGMUNCH_OIDC_CLIENT_SECRET: CLIENT_SECRET,
  RUGMUNCH_OIDC_BASE_URL: ISSUER,
} as never;

vi.mock('@degenfeed/types', () => ({}));

import { handleRugmunchCallback, handleRugmunchLogin } from '../routes/rugmunch-oidc';

// ─── HS256 JWT signing helper (mirrors Better Auth's id_token signing) ───

function base64UrlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function signJwt(payload: Record<string, unknown>, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const signingInput = `${base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)))}.${base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)))}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${base64UrlEncode(new Uint8Array(sig))}`;
}

function makeFetchMock(opts: {
  idToken?: string | null;
  tokenStatus?: number;
  discoveryStatus?: number;
}) {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/.well-known/openid-configuration')) {
      return new Response(
        JSON.stringify({
          issuer: ISSUER,
          authorization_endpoint: `${ISSUER}/api/auth/oauth2/authorize`,
          token_endpoint: `${ISSUER}/api/auth/oauth2/token`,
          jwks_uri: `${ISSUER}/api/auth/jwks`,
        }),
        { status: opts.discoveryStatus ?? 200, headers: { 'content-type': 'application/json' } },
      );
    }
    if (url.includes('/api/auth/oauth2/token')) {
      if (opts.tokenStatus && opts.tokenStatus >= 400) {
        return new Response(JSON.stringify({ error: 'invalid_grant' }), {
          status: opts.tokenStatus,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response(
        JSON.stringify({
          access_token: 'at_test',
          token_type: 'Bearer',
          expires_in: 3600,
          scope: 'openid profile email',
          id_token: opts.idToken,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }
    return new Response(JSON.stringify({}), { status: 404 });
  });
}

function kvValue(key: string): { nonce: string } | null {
  const raw = mockStateStore.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as { nonce: string };
  } catch {
    return null;
  }
}

async function issueState(): Promise<{ state: string; nonce: string }> {
  const res = await handleRugmunchLogin(
    new Request('https://degenfeed.xyz/api/auth/rugmunch/login'),
    env,
  );
  expect(res.status).toBe(200);
  const body = (await res.json()) as { state: string; authorizeUrl: string };
  const stored = kvValue(`rugmunch:oidc:${body.state}`);
  return { state: body.state, nonce: stored?.nonce ?? '' };
}

describe('RugMunch OIDC — login', () => {
  beforeEach(() => {
    mockStateStore.clear();
    (mockCache.put as ReturnType<typeof vi.fn>).mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 501 when the client secret is not configured', async () => {
    const res = await handleRugmunchLogin(
      new Request('https://degenfeed.xyz/api/auth/rugmunch/login'),
      { CACHE: mockCache } as never,
    );
    expect(res.status).toBe(501);
  });

  it('builds an authorize URL with state + nonce stored in KV', async () => {
    vi.stubGlobal('fetch', makeFetchMock({}));
    const res = await handleRugmunchLogin(
      new Request('https://degenfeed.xyz/api/auth/rugmunch/login'),
      env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { authorizeUrl: string; state: string };
    const url = new URL(body.authorizeUrl);
    expect(url.origin).toBe(ISSUER);
    expect(url.pathname).toBe('/api/auth/oauth2/authorize');
    expect(url.searchParams.get('client_id')).toBe(CLIENT_ID);
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://degenfeed.xyz/api/auth/rugmunch/callback',
    );
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toBe('openid profile email');
    expect(url.searchParams.get('state')).toBe(body.state);
    expect(url.searchParams.get('nonce')).toBeTruthy();
    // nonce is stored alongside the state
    expect(kvValue(`rugmunch:oidc:${body.state}`)?.nonce).toBe(url.searchParams.get('nonce'));
  });

  it('rejects unsupported hosts', async () => {
    vi.stubGlobal('fetch', makeFetchMock({}));
    const res = await handleRugmunchLogin(
      new Request('https://evil.example.com/api/auth/rugmunch/login'),
      env,
    );
    expect(res.status).toBe(403);
  });
});

describe('RugMunch OIDC — callback', () => {
  beforeEach(() => {
    mockStateStore.clear();
    (mockCache.put as ReturnType<typeof vi.fn>).mockClear();
    (mockCache.get as ReturnType<typeof vi.fn>).mockClear();
    (mockCache.delete as ReturnType<typeof vi.fn>).mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('redirects with an error when state is missing or unknown', async () => {
    vi.stubGlobal('fetch', makeFetchMock({}));

    const res = await handleRugmunchCallback(
      new Request('https://degenfeed.xyz/api/auth/rugmunch/callback?code=abc'),
      env,
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('oauth=error');

    const res2 = await handleRugmunchCallback(
      new Request('https://degenfeed.xyz/api/auth/rugmunch/callback?code=abc&state=never-issued'),
      env,
    );
    expect(res2.status).toBe(302);
    expect(decodeURIComponent(res2.headers.get('location') ?? '')).toContain('Invalid or expired state');
  });

  it('exchanges the code, verifies the id_token and creates a session cookie', async () => {
    const { state, nonce } = await issueState();

    const idToken = await signJwt(
      {
        sub: 'user-123',
        aud: CLIENT_ID,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        nonce,
        email: 'alice@example.com',
        email_verified: true,
        name: 'Alice',
      },
      CLIENT_SECRET,
    );

    const fetchMock = makeFetchMock({ idToken });
    vi.stubGlobal('fetch', fetchMock);

    const res = await handleRugmunchCallback(
      new Request(
        `https://degenfeed.xyz/api/auth/rugmunch/callback?code=valid-code&state=${state}`,
      ),
      env,
    );

    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://degenfeed.xyz/home');
    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('__Host-dfid=');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Secure');

    // Token exchange used client_secret_post (never a browser-visible secret)
    const tokenCall = fetchMock.mock.calls.find(([input]) =>
      String(input).includes('/api/auth/oauth2/token'),
    );
    expect(tokenCall).toBeTruthy();
    const body = tokenCall?.[1]?.body?.toString() ?? '';
    expect(body).toContain(`client_id=${CLIENT_ID}`);
    expect(body).toContain('grant_type=authorization_code');

    // State was consumed (single use)
    expect(mockStateStore.has(`rugmunch:oidc:${state}`)).toBe(false);
  });

  it('rejects an id_token with an invalid signature', async () => {
    const { state, nonce } = await issueState();

    // Signed with the WRONG secret — must fail verification
    const idToken = await signJwt(
      {
        sub: 'user-123',
        aud: CLIENT_ID,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        nonce,
      },
      'wrong-secret',
    );

    vi.stubGlobal('fetch', makeFetchMock({ idToken }));
    const res = await handleRugmunchCallback(
      new Request(
        `https://degenfeed.xyz/api/auth/rugmunch/callback?code=valid-code&state=${state}`,
      ),
      env,
    );
    expect(res.status).toBe(302);
    expect(decodeURIComponent(res.headers.get('location') ?? '')).toContain('id_token verification failed');
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('rejects an id_token with a mismatched nonce', async () => {
    const { state } = await issueState();
    const idToken = await signJwt(
      {
        sub: 'user-123',
        aud: CLIENT_ID,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        nonce: 'attacker-nonce',
      },
      CLIENT_SECRET,
    );
    vi.stubGlobal('fetch', makeFetchMock({ idToken }));
    const res = await handleRugmunchCallback(
      new Request(
        `https://degenfeed.xyz/api/auth/rugmunch/callback?code=valid-code&state=${state}`,
      ),
      env,
    );
    expect(res.status).toBe(302);
    expect(decodeURIComponent(res.headers.get('location') ?? '')).toContain('id_token verification failed');
  });

  it('rejects an expired id_token', async () => {
    const { state, nonce } = await issueState();
    const idToken = await signJwt(
      {
        sub: 'user-123',
        aud: CLIENT_ID,
        iat: Math.floor(Date.now() / 1000) - 7200,
        exp: Math.floor(Date.now() / 1000) - 3600,
        nonce,
      },
      CLIENT_SECRET,
    );
    vi.stubGlobal('fetch', makeFetchMock({ idToken }));
    const res = await handleRugmunchCallback(
      new Request(
        `https://degenfeed.xyz/api/auth/rugmunch/callback?code=valid-code&state=${state}`,
      ),
      env,
    );
    expect(res.status).toBe(302);
    expect(decodeURIComponent(res.headers.get('location') ?? '')).toContain('id_token verification failed');
  });

  it('handles provider-side OAuth errors', async () => {
    const res = await handleRugmunchCallback(
      new Request(
        'https://degenfeed.xyz/api/auth/rugmunch/callback?error=access_denied&error_description=User+cancelled',
      ),
      env,
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('access_denied');
    expect(res.headers.get('location')).toContain('User%20cancelled');
  });
});
