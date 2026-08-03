/**
 * @degenfeed/api-worker — RugMunch OIDC (cross-domain SSO) routes
 *
 * "Sign in with RugMunch": degenfeed.xyz users authenticate against the
 * RugMunch Better Auth service (rugmunch.io) using the OIDC Provider plugin,
 * then get a regular degenfeed HMAC session cookie.
 *
 * Flow:
 *   1. GET /api/auth/rugmunch/login
 *      → builds the rugmunch.io OIDC authorize URL (state + nonce stored in KV)
 *      → returns { authorizeUrl, state } for the sign-in modal
 *   2. Browser completes login on rugmunch.io and is redirected to
 *      GET /api/auth/rugmunch/callback?code=...&state=...
 *      → exchanges the code server-side (client secret never leaves the worker)
 *      → verifies the HS256 id_token against the shared client secret
 *      → creates a degenfeed session cookie (__Host-dfid) and redirects to /home
 *
 * The id_token from rugmunch.io's OIDC Provider is signed with HS256 using the
 * CLIENT secret (Better Auth, no JWT plugin), so we can verify it locally
 * without sharing the main BETTER_AUTH_SECRET.
 */

import { rateLimit } from '../index';
import { jsonResponse, rateLimitResponse } from '../response-helpers';
import { validateBodySize } from '../sanitize';
import { createSession } from '../session';
import type { Env } from '../types';

const RUGMUNCH_STATE_TTL_SECONDS = 600;
const DISCOVERY_CACHE_TTL_SECONDS = 3600;
const DEFAULT_CLIENT_ID = 'degenfeed-web';
const DEFAULT_BASE_URL = 'https://rugmunch.io';

const RUGMUNCH_HOSTS = ['degenfeed.xyz', 'app.degenfeed.xyz'];

function getBaseUrl(env: Env): string {
  return env.RUGMUNCH_OIDC_BASE_URL || DEFAULT_BASE_URL;
}

function getClientId(env: Env): string {
  return env.RUGMUNCH_OIDC_CLIENT_ID || DEFAULT_CLIENT_ID;
}

/** Callback URL must exactly match a trusted redirect URL on the auth service. */
function getCallbackUrl(request: Request, dev: boolean): string {
  if (dev) return 'http://localhost:8787/api/auth/rugmunch/callback';
  const url = new URL(request.url);
  return `https://${url.hostname}/api/auth/rugmunch/callback`;
}

interface OIDCDiscovery {
  authorization_endpoint: string;
  token_endpoint: string;
}

/**
 * Fetch the rugmunch.io OIDC discovery document. Cached in KV for 1 hour so
 * the authorize/token endpoints self-heal without a per-request round trip.
 */
async function getDiscovery(env: Env): Promise<OIDCDiscovery | null> {
  const cacheKey = 'rugmunch:oidc:discovery';
  try {
    const cached = await env.CACHE?.get(cacheKey);
    if (cached) return JSON.parse(cached) as OIDCDiscovery;
  } catch {
    /* cache read failed — fall through to network */
  }

  const res = await fetch(`${getBaseUrl(env)}/api/auth/.well-known/openid-configuration`, {
    headers: { accept: 'application/json' },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as Partial<OIDCDiscovery>;
  if (!data.authorization_endpoint || !data.token_endpoint) return null;

  const discovery: OIDCDiscovery = {
    authorization_endpoint: data.authorization_endpoint,
    token_endpoint: data.token_endpoint,
  };
  try {
    await env.CACHE?.put(cacheKey, JSON.stringify(discovery), {
      expirationTtl: DISCOVERY_CACHE_TTL_SECONDS,
    });
  } catch {
    /* cache write failed — non-critical */
  }
  return discovery;
}

function generateState(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
}

async function storeOidcState(
  env: Env,
  state: string,
  nonce: string,
): Promise<void> {
  if (!env.CACHE) return;
  try {
    await env.CACHE.put(`rugmunch:oidc:${state}`, JSON.stringify({ nonce }), {
      expirationTtl: RUGMUNCH_STATE_TTL_SECONDS,
    });
  } catch (err) {
    console.warn('[rugmunch-oidc] storeState failed:', err instanceof Error ? err.message : err);
  }
}

async function consumeOidcState(env: Env, state: string): Promise<string | null> {
  if (!env.CACHE) return null;
  try {
    const existing = await env.CACHE.get(`rugmunch:oidc:${state}`);
    if (!existing) return null;
    await env.CACHE.delete(`rugmunch:oidc:${state}`);
    const parsed = JSON.parse(existing) as { nonce?: string };
    return parsed.nonce ?? null;
  } catch (err) {
    console.warn(
      '[rugmunch-oidc] consumeState failed:',
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

// ─── JWT helpers (HS256 verification with Web Crypto) ────────────────────

function base64UrlDecode(input: string): Uint8Array {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '=');
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

interface VerifiedIdToken {
  sub: string;
  aud?: unknown;
  exp?: number;
  iat?: number;
  nonce?: string;
  email?: string;
  name?: string;
  picture?: string;
}

/**
 * Verify an HS256 JWT id_token using the shared OIDC client secret.
 * Returns the verified payload or null when signature/claims fail.
 */
async function verifyIdToken(
  token: string,
  clientSecret: string,
  clientId: string,
  expectedNonce: string | null,
): Promise<VerifiedIdToken | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, signatureB64] = parts as [string, string, string];
  let header: { alg?: string };
  try {
    header = JSON.parse(new TextDecoder().decode(base64UrlDecode(headerB64))) as {
      alg?: string;
    };
  } catch {
    return null;
  }
  if (header.alg !== 'HS256') return null;

  // Verify the HMAC signature with the client secret (the OIDC Provider signs
  // id_tokens with the trusted client's own secret when the JWT plugin is off).
  const signingInput = `${headerB64}.${payloadB64}`;
  let signatureValid = false;
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(clientSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    signatureValid = await crypto.subtle.verify(
      'HMAC',
      key,
      base64UrlDecode(signatureB64) as BufferSource,
      new TextEncoder().encode(signingInput),
    );
  } catch {
    return null;
  }
  if (!signatureValid) return null;

  let payload: VerifiedIdToken;
  try {
    payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64))) as VerifiedIdToken;
  } catch {
    return null;
  }

  // Claim checks
  if (typeof payload.sub !== 'string' || payload.sub.length === 0) return null;
  if (payload.aud !== clientId) return null;
  if (typeof payload.exp === 'number' && payload.exp * 1000 < Date.now()) return null;
  if (expectedNonce && payload.nonce !== expectedNonce) return null;

  return payload;
}

// ─── Route handlers ──────────────────────────────────────────────────────

/**
 * GET /api/auth/rugmunch/login
 *
 * Returns { authorizeUrl, state } — the browser is redirected to the RugMunch
 * OIDC authorize endpoint. Mirrors the other OAuth authorize handlers so the
 * sign-in modal's OAuthProvidersSignIn flow works unchanged.
 */
export async function handleRugmunchLogin(request: Request, env: Env): Promise<Response> {
  const clientSecret = env.RUGMUNCH_OIDC_CLIENT_SECRET;
  if (!clientSecret) {
    return jsonResponse(
      { error: 'RugMunch SSO not configured (RUGMUNCH_OIDC_CLIENT_SECRET)' },
      501,
    );
  }

  const ip =
    request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';
  const rl = await rateLimit(env, ip, 'oauth:rugmunch-login', 10, 60000);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfter);

  const url = new URL(request.url);
  const dev = env.ALLOW_DEV_OAUTH === 'true' && url.searchParams.get('dev') === 'true';
  if (!dev && !RUGMUNCH_HOSTS.includes(url.hostname)) {
    return jsonResponse({ error: 'Unsupported host for RugMunch SSO' }, 403);
  }

  const discovery = await getDiscovery(env);
  if (!discovery) {
    return jsonResponse({ error: 'RugMunch OIDC discovery unavailable' }, 502);
  }

  const state = generateState();
  const nonce = generateState();
  await storeOidcState(env, state, nonce);

  const authorizeUrl =
    `${discovery.authorization_endpoint}?` +
    new URLSearchParams({
      client_id: getClientId(env),
      redirect_uri: getCallbackUrl(request, dev),
      response_type: 'code',
      scope: 'openid profile email',
      state,
      nonce,
    }).toString();

  return jsonResponse({ authorizeUrl, state });
}

/**
 * GET /api/auth/rugmunch/callback?code=...&state=...
 *
 * Exchanges the authorization code for tokens, verifies the id_token
 * (signature + aud + exp + nonce), creates a degenfeed session cookie and
 * redirects the browser to /home. On failure redirects with an error param
 * (the SPA shows a friendly message).
 */
export async function handleRugmunchCallback(request: Request, env: Env): Promise<Response> {
  const clientSecret = env.RUGMUNCH_OIDC_CLIENT_SECRET;
  if (!clientSecret) {
    return jsonResponse(
      { error: 'RugMunch SSO not configured (RUGMUNCH_OIDC_CLIENT_SECRET)' },
      501,
    );
  }

  const url = new URL(request.url);
  const origin = `https://${url.hostname}`;
  const homeUrl = `${origin}/home`;
  const fail = (message: string, extra = '') =>
    Response.redirect(
      `${homeUrl}?oauth=error&provider=rugmunch&error=${encodeURIComponent(message)}${extra ? `&detail=${encodeURIComponent(extra)}` : ''}`,
      302,
    );

  const ip =
    request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';
  const rl = await rateLimit(env, ip, 'oauth:rugmunch-callback', 10, 60000);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfter);

  const bodySizeCheck = validateBodySize(request, 32 * 1024);
  if (!bodySizeCheck.ok) return jsonResponse({ error: bodySizeCheck.error }, 413);

  const error = url.searchParams.get('error');
  if (error) {
    return fail(error, url.searchParams.get('error_description') ?? '');
  }
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code) return fail('Missing authorization code');
  if (!state) return fail('Missing state nonce');

  const nonce = await consumeOidcState(env, state);
  if (!nonce) return fail('Invalid or expired state');

  const dev = env.ALLOW_DEV_OAUTH === 'true' && url.searchParams.get('dev') === 'true';
  const discovery = await getDiscovery(env);
  if (!discovery) {
    return fail('RugMunch OIDC discovery unavailable');
  }

  try {
    // Exchange the code — server-side so the client secret never ships to the browser.
    const tokenRes = await fetch(discovery.token_endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: getClientId(env),
        client_secret: clientSecret,
        redirect_uri: getCallbackUrl(request, dev),
        code,
      }).toString(),
    });
    if (!tokenRes.ok) {
      const errText = (await tokenRes.text()).slice(0, 300);
      return fail('Token exchange failed', errText);
    }

    const tokenData = (await tokenRes.json()) as {
      id_token?: string;
      access_token?: string;
      error?: string;
      error_description?: string;
    };
    if (tokenData.error || !tokenData.id_token) {
      return fail(tokenData.error_description ?? tokenData.error ?? 'No id_token returned');
    }

    const payload = await verifyIdToken(tokenData.id_token, clientSecret, getClientId(env), nonce);
    if (!payload) {
      return fail('id_token verification failed');
    }

    // Create the degenfeed HMAC session. `address` carries the RugMunch user
    // id (sub) namespaced with `rmi:` so wallet-based logic never confuses an
    // SSO user with an on-chain address.
    const authSecret = env.AUTH_SECRET;
    if (!authSecret) return fail('Auth secret not configured');

    const { setCookie } = await createSession(`rmi:${payload.sub}`, 'rmi', authSecret);

    const headers = new Headers({
      location: dev ? 'http://localhost:3000/home' : homeUrl,
      'set-cookie': setCookie,
      'cache-control': 'no-store, must-revalidate',
    });
    return new Response(null, { status: 302, headers });
  } catch (err) {
    const { logError } = await import('../error-logger');
    const code = await logError(env, err, {
      route: '/api/auth/rugmunch/callback',
      method: 'GET',
      statusCode: 500,
    });
    return fail('RugMunch callback failed', code);
  }
}
