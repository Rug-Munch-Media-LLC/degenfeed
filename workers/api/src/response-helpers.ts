/**
 * @degenfeed/api-worker — Response helpers
 *
 * Standardized response builders for route handlers.
 * These replace ad-hoc `new Response(JSON.stringify({...}))` patterns.
 */

import type { Env } from './index';
import { handleError } from './lib/errors';

// ─── JSON response ───────────────────────────────────────────

export function jsonResponse(
  c: { json: (data: unknown, status?: number) => Response },
  data: unknown,
  status = 200,
): Response {
  return c.json(data, status as Parameters<typeof c.json>[1]);
}

// ─── Error response from catch blocks ───────────────────────
// Use this in route catch blocks instead of ad-hoc error responses.
// e.g. return errorResponse(err, env, requestId);

export interface ErrorResponseOptions {
  route?: string;
  method?: string;
  requestId?: string;
}

export function errorResponse(
  error: unknown,
  env: Env,
  options: ErrorResponseOptions = {},
): Response {
  return handleError(error, env, options);
}

// ─── Rate limit response ─────────────────────────────────────
// Replaces the 16+ duplicated rate limit response patterns across routes.
// Usage:
//   if (!rl.allowed) return rateLimitResponse(rl.retryAfter);

export interface RateLimitResult {
  allowed: boolean;
  retryAfter: number;
}

export function rateLimitResponse(retryAfterMs: number): Response {
  return new Response(JSON.stringify({ error: 'Rate limit exceeded', retryAfterMs }), {
    status: 429,
    headers: {
      'content-type': 'application/json',
      'retry-after': String(Math.ceil(retryAfterMs / 1000)),
      'cache-control': 'no-store',
    },
  });
}
