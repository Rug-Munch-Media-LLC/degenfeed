/**
 * @degenfeed/web — API Auth Helpers
 *
 * Shared auth middleware for Next.js App Router API routes.
 * Verifies the same `__Host-dfid` session cookie the worker API uses.
 *
 * Environment variables:
 *   AUTH_SECRET         — HMAC-SHA256 key for session cookie verification
 *   ADMIN_WALLETS       — comma‑separated list of admin wallet addresses
 */

import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';

// ─── Types ────────────────────────────────────────────────────────────

export interface SessionPayload {
  address: string;
  chain: 'ethereum' | 'solana';
  exp: number;
  nonce: string;
}

const COOKIE_NAME = '__Host-dfid';

// ─── Helpers ──────────────────────────────────────────────────────────

function decodeHex(hex: string): Buffer {
  return Buffer.from(hex, 'hex');
}

function importKey(secret: string): Buffer {
  const keyBytes =
    /^[0-9a-fA-F]+$/.test(secret) && secret.length >= 64
      ? decodeHex(secret)
      : Buffer.from(secret, 'utf-8');
  return keyBytes;
}

function verifyHmac(data: string, signature: string, secret: string): boolean {
  try {
    const keyBytes = importKey(secret);
    const expected = createHmac('sha256', keyBytes).update(data).digest();
    const actual = decodeHex(signature);
    if (actual.length !== expected.length) return false;
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function parseCookie(cookieHeader: string | null): string | null {
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

// ─── Low-level verify ─────────────────────────────────────────────────

/**
 * Parse and verify the session cookie.
 * Returns the session payload or null on any failure.
 */
async function verifySessionCookie(
  cookieHeader: string | null,
  secret: string,
): Promise<SessionPayload | null> {
  const cookieValue = parseCookie(cookieHeader);
  if (!cookieValue) return null;

  const [data, signature] = cookieValue.split('.');
  if (!data || !signature) return null;
  if (!verifyHmac(data, signature, secret)) return null;

  try {
    const decoded = Buffer.from(data, 'base64').toString('utf-8');
    const payload = JSON.parse(decoded) as SessionPayload;

    if (
      typeof payload.address !== 'string' ||
      (payload.chain !== 'ethereum' && payload.chain !== 'solana') ||
      typeof payload.exp !== 'number'
    ) {
      return null;
    }
    if (payload.exp < Date.now()) return null;

    return payload;
  } catch {
    return null;
  }
}

// ─── Guard helpers ────────────────────────────────────────────────────

/**
 * Add `X-Admin-Validated: true` header to a ResponseInit.
 */
export function withAdminHeaders(init?: ResponseInit): ResponseInit {
  const headers = new Headers(init?.headers);
  headers.set('X-Admin-Validated', 'true');
  return { ...init, headers };
}

/**
 * Ensure the request carries a valid session.
 * Returns `Response` (401) on failure, or `null` on success.
 *
 * Usage:
 *   const err = await requireSession(request);
 *   if (err) return err;
 */
export async function requireSession(request: Request): Promise<NextResponse | null> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    console.error('[auth] AUTH_SECRET not configured');
    return NextResponse.json({ error: 'Auth not configured' }, { status: 500 });
  }
  const payload = await verifySessionCookie(request.headers.get('cookie'), secret);
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null; // allowed
}

/**
 * Ensure the request carries a valid session whose wallet is in ADMIN_WALLETS.
 * Returns `Response` (401/403) on failure, or `null` on success.
 *
 * Usage:
 *   const err = await requireAdmin(request);
 *   if (err) return err;
 */
export async function requireAdmin(request: Request): Promise<NextResponse | null> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    console.error('[auth] AUTH_SECRET not configured');
    return NextResponse.json({ error: 'Auth not configured' }, { status: 500 });
  }
  const payload = await verifySessionCookie(request.headers.get('cookie'), secret);
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const adminWallets = (process.env.ADMIN_WALLETS || '')
    .split(',')
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean);

  if (adminWallets.length === 0) {
    console.error('[auth] ADMIN_WALLETS not configured');
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!adminWallets.includes(payload.address.toLowerCase())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null; // allowed
}
