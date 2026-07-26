/**
 * @degenfeed/api-worker — Response helpers
 *
 * Standardized response builders for route handlers.
 * These replace ad-hoc `new Response(JSON.stringify({...}))` patterns.
 */

import { handleError } from './lib/errors';
import type { Env } from './types';

// ─── Legacy response helpers ───────────────────────────────────
// jsonResponse and noCacheJsonResponse are the original response builders
// defined in index.ts. They are extracted here to break circular import chains
// (index → routes → index). Routes should prefer the status-specific helpers
// (ok/created/badRequest/etc.) but for backward compat we keep the originals.

export function jsonResponse(
  data: unknown,
  status = 200,
  extraHeaders?: Record<string, string>,
): Response {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'cache-control': 'public, max-age=30',
    ...extraHeaders,
  };
  return new Response(JSON.stringify(data), {
    status,
    headers,
  });
}

export function noCacheJsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store, must-revalidate',
    },
  });
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

export function forbidden(message = 'Forbidden'): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 403,
    headers: { 'content-type': 'application/json' },
  });
}

export function upgradeRequired(message = 'Upgrade Required'): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 426,
    headers: { 'content-type': 'application/json' },
  });
}

export function paymentRequired(
  message = 'Payment Required',
  extraHeaders?: Record<string, string>,
): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 402,
    headers: { 'content-type': 'application/json', ...extraHeaders },
  });
}

/**
 * Standardized 405 Method Not Allowed response.
 * Includes `Allow` header so clients know which methods are accepted.
 *
 * Usage:
 *   if (request.method !== 'POST') return methodNotAllowed(['POST']);
 *   if (c.req.method !== 'GET') return methodNotAllowed(['GET']);
 */
export function methodNotAllowed(allowedMethods: string[]): Response {
  return new Response(
    JSON.stringify({ error: `Method not allowed. Allowed: ${allowedMethods.join(', ')}` }),
    {
      status: 405,
      headers: {
        'content-type': 'application/json',
        allow: allowedMethods.join(', '),
      },
    },
  );
}

export function conflict(message = 'Conflict'): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 409,
    headers: { 'content-type': 'application/json' },
  });
}

export function badGateway(message = 'Bad gateway'): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 502,
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
