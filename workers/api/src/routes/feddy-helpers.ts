/**
 * @degenfeed/api-worker — Feddy Communities shared helpers
 *
 * Shared utilities extracted from the monolithic feddy-communities.ts.
 * Each split route file imports what it needs from here.
 */

import { GtSClient } from '@degenfeed/mastodon-sdk';
import type { Env } from '../index';
import { jsonResponse } from '../index';
import { parseSessionCookie, requireSession, validateCsrfToken } from '../session';
import type { MemberRole } from '../lib/feddy-store';
import { getMemberRole } from '../lib/feddy-store';

// ─── GoToSocial Client ─────────────────────────────────────────

export function getGtsClient(env: Env, accessToken?: string): GtSClient {
  const instanceUrl = env.GTS_INSTANCE_URL ?? 'https://social.degenfeed.xyz';
  return new GtSClient(instanceUrl, accessToken);
}

// ─── Sanitizers ────────────────────────────────────────────────

export function sanitizeHtml(input: string, maxLen: number = 5000): string {
  let cleaned = input.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  cleaned = cleaned.replace(/<[^>]*>/g, '');
  cleaned = cleaned.replace(/javascript:/gi, '');
  cleaned = cleaned.replace(/on\w+\s*=/gi, '');
  return cleaned.slice(0, maxLen).trim();
}

export function sanitizeString(input: string, maxLen: number = 200): string {
  return input
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')
    .slice(0, maxLen)
    .trim();
}

export function shortenWallet(wallet: string): string {
  if (wallet.length <= 12) return wallet;
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
}

// ─── Premium Check ─────────────────────────────────────────────

const PREMIUM_KV_PREFIX = 'premium:';

interface PremiumRecord {
  tier: string;
  status: string;
  expiresAt: number;
}

export async function checkPremium(env: Env, address: string): Promise<boolean> {
  try {
    const key = `${PREMIUM_KV_PREFIX}${address.toLowerCase()}`;
    const raw = await (env.SUBSCRIPTIONS?.get(key) ?? env.CACHE?.get(key));
    if (!raw) return false;
    const record = JSON.parse(raw) as PremiumRecord;
    if (record.status !== 'active') return false;
    if (record.expiresAt && record.expiresAt < Date.now()) return false;
    return record.tier === 'pro' || record.tier === 'platinum' || record.tier === 'enterprise';
  } catch {
    return false;
  }
}

// ─── Role Guards ───────────────────────────────────────────────

/** Require owner or moderator role for mod-only endpoints. Returns Response on failure. */
export async function requireModOrResponse(
  env: Env,
  communityId: string,
  wallet: string,
): Promise<{ role: MemberRole | null; error?: Response }> {
  const role = await getMemberRole(env, communityId, wallet);
  if (role !== 'owner' && role !== 'moderator') {
    return {
      role,
      error: jsonResponse({ error: 'Only owner and moderators can perform this action' }, 403),
    };
  }
  return { role };
}

/** Require owner role only. Returns Response on failure. */
export async function requireOwnerOrResponse(
  env: Env,
  communityId: string,
  wallet: string,
): Promise<{ role: MemberRole | null; error?: Response }> {
  const role = await getMemberRole(env, communityId, wallet);
  if (role !== 'owner') {
    return {
      role,
      error: jsonResponse({ error: 'Only the community owner can perform this action' }, 403),
    };
  }
  return { role };
}

// ─── CSRF Check ────────────────────────────────────────────────

/** Common CSRF check pattern */
export async function csrfCheck(req: Request, env: Env): Promise<Response | null> {
  const cookieVal = parseSessionCookie(req.headers.get('cookie'));
  const csrfToken = req.headers.get('X-CSRF-Token');
  if (cookieVal) {
    const csrfOk = await validateCsrfToken(cookieVal, csrfToken, env);
    if (!csrfOk) {
      return jsonResponse({ error: 'Invalid CSRF token' }, 403);
    }
  }
  return null;
}

// ─── Re-export common session utilities for convenience ────────

export { requireSession };
