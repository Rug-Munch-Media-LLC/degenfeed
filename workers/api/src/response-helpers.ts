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

// ─── Status-specific response helpers ───────────────────────

export function ok(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

export function created(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 201,
    headers: { 'content-type': 'application/json' },
  });
}

export function badRequest(message = 'Bad request'): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { 'content-type': 'application/json' },
  });
}

export function notFound(message = 'Not found'): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 404,
    headers: { 'content-type': 'application/json' },
  });
}

export function serverError(message = 'Internal server error'): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 500,
    headers: { 'content-type': 'application/json' },
  });
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
