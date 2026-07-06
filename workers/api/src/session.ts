import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import type { Env } from './index';

export interface SessionPayload {
  address: string;
  chain: 'ethereum' | 'solana';
  exp: number;
  nonce: string;
}

const COOKIE_NAME = '__Host-dfid';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function signSession(payload: SessionPayload, secret: string): Promise<string> {
  const data = btoa(JSON.stringify(payload));
  const signature = await crypto.subtle.sign(
    'HMAC',
    await importKey(secret),
    new TextEncoder().encode(data),
  );
  return `${data}.${bytesToHex(new Uint8Array(signature))}`;
}

export async function verifySessionCookie(
  value: string,
  secret: string,
): Promise<SessionPayload | null> {
  const [data, signature] = value.split('.');
  if (!data || !signature) return null;

  const valid = await crypto.subtle.verify(
    'HMAC',
    await importKey(secret),
    hexToBytes(signature) as Uint8Array<ArrayBuffer>,
    new TextEncoder().encode(data),
  );
  if (!valid) return null;

  try {
    const payload = JSON.parse(atob(data)) as SessionPayload;
    if (
      typeof payload.address !== 'string' ||
      (payload.chain !== 'ethereum' && payload.chain !== 'solana') ||
      typeof payload.exp !== 'number' ||
      typeof payload.nonce !== 'string'
    ) {
      return null;
    }
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function parseSessionCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (name === COOKIE_NAME) return value;
  }
  return null;
}

export async function createSession(
  address: string,
  chain: 'ethereum' | 'solana',
  secret: string,
): Promise<{ setCookie: string; payload: SessionPayload }> {
  const payload: SessionPayload = {
    address: address.toLowerCase(),
    chain,
    exp: Date.now() + SESSION_TTL_MS,
    nonce: bytesToHex(crypto.getRandomValues(new Uint8Array(16))),
  };
  const value = await signSession(payload, secret);
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  const setCookie = `${COOKIE_NAME}=${value}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Lax`;
  return { setCookie, payload };
}

export async function handleSessionVerify(request: Request, env: Env): Promise<Response> {
  const secret = env.AUTH_SECRET;
  if (!secret) return jsonResponse({ error: 'Auth secret not configured' }, 500);

  const cookieValue = parseSessionCookie(request.headers.get('cookie'));
  if (!cookieValue) return jsonResponse({ error: 'Unauthorized' }, 401);

  const payload = await verifySessionCookie(cookieValue, secret);
  if (!payload) return jsonResponse({ error: 'Unauthorized' }, 401);

  return jsonResponse({
    address: payload.address,
    chain: payload.chain,
    exp: payload.exp,
    nonce: payload.nonce,
  });
}

export async function requireSession(
  request: Request,
  env: Env,
): Promise<SessionPayload | Response> {
  const secret = env.AUTH_SECRET;
  if (!secret) return jsonResponse({ error: 'Auth secret not configured' }, 500);

  const cookieValue = parseSessionCookie(request.headers.get('cookie'));
  if (!cookieValue) return jsonResponse({ error: 'Unauthorized' }, 401);

  const payload = await verifySessionCookie(cookieValue, secret);
  if (!payload) return jsonResponse({ error: 'Unauthorized' }, 401);

  return payload;
}
