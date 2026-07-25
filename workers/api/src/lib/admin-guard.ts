/**
 * Admin wallet guard — validates wallet addresses against ADMIN_WALLETS env var.
 *
 * Supports two validation modes:
 *   1. Session-based: extracts wallet from a verified session cookie (worker/Hono)
 *   2. Header-based: extracts wallet from X-Wallet-Address request header (Next.js)
 *
 * Exports a `requireAdmin` helper that returns `{ allowed, error }` for
 * synchronous checks, and `requireAdminFromRequest` for async session checks.
 */

import type { Env } from '../index';
import { AuthError, ForbiddenError } from './errors';

/**
 * Parse ADMIN_WALLETS env var into a lowercase Set for efficient lookup.
 */
export function getAdminWalletSet(adminWalletsEnv: string | undefined): Set<string> {
  if (!adminWalletsEnv) return new Set<string>();
  return new Set(
    adminWalletsEnv
      .split(',')
      .map((w) => w.trim().toLowerCase())
      .filter(Boolean),
  );
}

/**
 * Pure check — is the given wallet address in the admin list?
 */
export function isAdmin(walletAddress: string, adminWalletsEnv: string | undefined): boolean {
  if (!walletAddress || !adminWalletsEnv) return false;
  const admins = getAdminWalletSet(adminWalletsEnv);
  return admins.has(walletAddress.toLowerCase());
}

/**
 * Validate a wallet address against the admin list.
 * Throws ForbiddenError or AuthError on failure.
 */
export function requireAdmin(
  walletAddress: string | undefined | null,
  adminWalletsEnv: string | undefined,
): { allowed: true } {
  if (!walletAddress) {
    throw new AuthError('No wallet address provided');
  }
  if (!adminWalletsEnv) {
    throw new ForbiddenError('ADMIN_WALLETS not configured');
  }
  if (!isAdmin(walletAddress, adminWalletsEnv)) {
    throw new ForbiddenError('Not an admin wallet');
  }
  return { allowed: true };
}

/**
 * Require admin access from a Hono-style request via session cookie.
 * Returns the session address on success, or throws AppError on failure.
 */
export async function requireAdminFromSession(
  request: Request,
  env: Env,
): Promise<{ address: string }> {
  const { requireSession } = await import('../session');
  const session = await requireSession(request, env);
  if (session instanceof Response) {
    throw new AuthError('Session required for admin access');
  }

  requireAdmin(session.address, env.ADMIN_WALLETS);
  return { address: session.address };
}

/**
 * Require admin access from a Next.js-style request via X-Wallet-Address header.
 * Returns the wallet address on success, or throws AppError on failure.
 */
export function requireAdminFromHeader(
  request: Request,
  adminWalletsEnv: string | undefined,
): { address: string } {
  const walletAddress = request.headers.get('x-wallet-address') || '';
  requireAdmin(walletAddress, adminWalletsEnv);
  return { address: walletAddress };
}

/**
 * Add `X-Admin-Validated: true` header to a Response.
 * Works with both NextResponse and standard Response.
 */
export function addAdminValidatedHeader(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('X-Admin-Validated', 'true');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
