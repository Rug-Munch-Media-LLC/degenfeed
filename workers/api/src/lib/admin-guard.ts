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

import type { Env } from '../types';
import { AuthError, ForbiddenError } from './errors';

/**
 * Parse ADMIN_WALLETS env var into a lowercase Set for efficient lookup.
 */
export function getAdminWalletSet(adminWalletsEnv: string | undefined): Set<string> {
