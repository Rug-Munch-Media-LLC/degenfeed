/**
 * @degenfeed/api-worker — API Key Authentication
 *
 * API key generation, KV-backed storage, validation middleware,
 * and tiered rate limiting for the v1 public API.
 */

import type { Context, Next } from 'hono';
import type { Env } from './types';

// ─── Types ──────────────────────────────────────────────

export interface ApiKeyRecord {
  keyId: string;
  userId: string;
  scopes: string[];
  tier: 'free' | 'premium';
  createdAt: number;
  lastUsed: number;
  label?: string;
}

export interface ApiKeyPayload {
  userId: string;
  scopes: string[];
  tier: 'free' | 'premium';
  label?: string;
}

// ─── Constants ──────────────────────────────────────────

export const VALID_SCOPES = [
  'read:feed',
  'write:posts',
  'read:identity',
  'write:tip',
  'read:analytics',
] as const;

export const SCOPES_DESCRIPTION: Record<string, string> = {
  'read:feed': 'Read feeds and search posts',
  'write:posts': 'Publish and engage with posts',
  'read:identity': 'Resolve identities and profiles',
  'write:tip': 'Send tips across protocols',
  'read:analytics': 'Read analytics data',
};

export const RATE_LIMITS: Record<string, { maxReq: number; windowMs: number }> & {
  free: { maxReq: number; windowMs: number };
  premium: { maxReq: number; windowMs: number };
} = {
  free: { maxReq: 1000, windowMs: 3600_000 }, // 1000 req/hour
  premium: { maxReq: 10000, windowMs: 3600_000 }, // 10000 req/hour
};

const KV_PREFIX = 'api:key:';

// ─── Key generation ────────────────────────────────────

export function generateApiKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// ─── KV storage ────────────────────────────────────────

export async function storeApiKey(
  env: Env,
  apiKey: string,
  payload: ApiKeyPayload,
): Promise<ApiKeyRecord> {
  if (!env.API_KEYS) {
    throw new Error('API_KEYS KV namespace not bound');
  }

  const record: ApiKeyRecord = {
    keyId: generateKeyId(),
    userId: payload.userId,
    scopes: payload.scopes,
    tier: payload.tier,
    createdAt: Date.now(),
    lastUsed: Date.now(),
    label: payload.label,
  };

  await env.API_KEYS.put(KV_PREFIX + apiKey, JSON.stringify(record));
  return record;
}

export async function getApiKeyRecord(env: Env, apiKey: string): Promise<ApiKeyRecord | null> {
  if (!env.API_KEYS) return null;
  const raw = await env.API_KEYS.get(KV_PREFIX + apiKey);
  if (!raw) return null;
  return JSON.parse(raw) as ApiKeyRecord;
}

export async function deleteApiKey(env: Env, apiKey: string): Promise<boolean> {
  if (!env.API_KEYS) return false;
  await env.API_KEYS.delete(KV_PREFIX + apiKey);
  return true;
}

export async function updateLastUsed(
  env: Env,
  apiKey: string,
  record: ApiKeyRecord,
): Promise<void> {
  if (!env.API_KEYS) return;
  record.lastUsed = Date.now();
  await env.API_KEYS.put(KV_PREFIX + apiKey, JSON.stringify(record));
}

// ─── Hono Middleware ───────────────────────────────────

export async function apiKeyMiddleware(c: Context, next: Next): Promise<void> {
  const authHeader = c.req.header('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    await next();
    return;
  }

  const apiKey = authHeader.slice(7).trim();
  if (!apiKey) {
    c.status(401);
    c.json({ error: 'Invalid API key format' });
    return;
  }

  const env = c.env as Env;
  const record = await getApiKeyRecord(env, apiKey);
  if (!record) {
    c.status(401);
    c.json({ error: 'Invalid or revoked API key' });
    return;
  }

  // Determine required scopes from path
  const path = c.req.path;
  const requiredScopes = determineRequiredScopes(path);
  const missing = requiredScopes.filter((s) => !record.scopes.includes(s));
  if (missing.length > 0) {
    c.status(403);
    c.json({ error: `Missing required scopes: ${missing.join(', ')}` });
    return;
  }

  // Fire-and-forget last-used update
  updateLastUsed(env, apiKey, record).catch(() => {});

  // Check per-key rate limit
  const limits = RATE_LIMITS[record.tier] ?? RATE_LIMITS.free;
  const { rateLimit } = await import('./index');
  const rl = await rateLimit(env, `ak:${record.keyId}`, path, limits.maxReq, limits.windowMs);

  if (!rl.allowed) {
    c.status(429);
    c.json({
      error: 'Rate limit exceeded',
      retryAfterMs: rl.retryAfter,
      tier: record.tier,
      limit: limits.maxReq,
      window: '1h',
    });
    return;
  }

  // Attach record to context for downstream handlers
  c.set('apiKeyRecord', record);
  await next();
}

// ─── Helpers ──────────────────────────────────────────

function generateKeyId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function determineRequiredScopes(path: string): string[] {
  const scopes: string[] = [];
  if (path.includes('/feed') || path.includes('/search')) scopes.push('read:feed');
  if (path.includes('/identity')) scopes.push('read:identity');
  if (path.includes('/tip')) scopes.push('write:tip');
  if (path.includes('/analytics')) scopes.push('read:analytics');
  if (path.includes('/publish') || path.includes('/engage')) scopes.push('write:posts');
  return scopes;
}
