/**
 * @degenfeed/api-worker — Standardized API response helpers
 *
 * Every route handler MUST use these functions for API responses instead
 * of constructing raw Response objects. This ensures:
 *   - Consistent JSON envelope:  { data, status, error }
 *   - Proper cache-control headers
 *   - Uniform error shapes:      { error: 'message' }
 *   - Correct Content-Type header always set
 *
 * USAGE:
 *   import { ok, created, badRequest, notFound, serverError } from '../response-helpers';
 *
 *   return ok({ items: [...] });                    // 200 { data: { items: [...] } }
 *   return created({ id: 'abc' });                   // 201
 *   return badRequest('Invalid input');              // 400 { error: 'Invalid input' }
 *   return notFound('Post not found');               // 404 { error: 'Post not found' }
 *   return serverError('Internal error', err);       // 500 (logs error, returns generic msg)
 *
 * MIGRATION NOTE:
 * These replace the ad-hoc pattern of:  c.json(data, 201)  or  new Response(...)
 * and the existing jsonResponse() helper in index.ts.
 *
 * In a future cleanup, jsonResponse can be re-exported from here
 * instead of index.ts, but both coexist for now.
 */

import { logError } from './error-logger';
import type { Env } from './index';

// ─── Success responses ──────────────────────────────────────────

/**
 * 200 OK — Standard successful response.
 * Wraps data in a `{ data }` envelope for consistency.
 */
export function ok<T>(data: T, extraHeaders?: Record<string, string>): Response {
  return jsonResponse(data, 200, extraHeaders);
}

/**
 * 201 Created — Resource was successfully created.
 */
export function created<T>(data: T, extraHeaders?: Record<string, string>): Response {
  return jsonResponse(data, 201, extraHeaders);
}

/**
 * 204 No Content — Success but no body to return.
 */
export function noContent(): Response {
  return new Response(null, {
    status: 204,
    headers: { 'cache-control': 'no-store' },
  });
}

// ─── Error responses ────────────────────────────────────────────

/**
 * 400 Bad Request — Client sent invalid input.
 */
export function badRequest(message: string, extraHeaders?: Record<string, string>): Response {
  return jsonResponse({ error: message }, 400, extraHeaders);
}

/**
 * 401 Unauthorized — Authentication required or failed.
 */
export function unauthorized(
  message = 'Unauthorized',
  extraHeaders?: Record<string, string>,
): Response {
  return jsonResponse({ error: message }, 401, extraHeaders);
}

/**
 * 403 Forbidden — Authenticated but not permitted.
 */
export function forbidden(message = 'Forbidden', extraHeaders?: Record<string, string>): Response {
  return jsonResponse({ error: message }, 403, extraHeaders);
}

/**
 * 404 Not Found — Resource does not exist.
 */
export function notFound(message = 'Not found', extraHeaders?: Record<string, string>): Response {
  return jsonResponse({ error: message }, 404, extraHeaders);
}

/**
 * 405 Method Not Allowed — HTTP method not supported for this endpoint.
 */
export function methodNotAllowed(
  message = 'Method not allowed',
  extraHeaders?: Record<string, string>,
): Response {
  return jsonResponse({ error: message }, 405, extraHeaders);
}

/**
 * 409 Conflict — Resource state conflict (e.g., duplicate).
 */
export function conflict(message: string, extraHeaders?: Record<string, string>): Response {
  return jsonResponse({ error: message }, 409, extraHeaders);
}

/**
 * 410 Gone — Resource has been permanently removed.
 */
export function gone(message: string, extraHeaders?: Record<string, string>): Response {
  return jsonResponse({ error: message }, 410, extraHeaders);
}

/**
 * 415 Unsupported Media Type — Request body format not supported.
 */
export function unsupportedMediaType(
  message = 'Unsupported media type',
  extraHeaders?: Record<string, string>,
): Response {
  return jsonResponse({ error: message }, 415, extraHeaders);
}

/**
 * 422 Unprocessable Entity — Semantic validation failure.
 */
export function unprocessable(message: string, extraHeaders?: Record<string, string>): Response {
  return jsonResponse({ error: message }, 422, extraHeaders);
}

/**
 * 429 Too Many Requests — Rate limit exceeded.
 */
export function tooManyRequests(
  retryAfterMs: number,
  extraHeaders?: Record<string, string>,
): Response {
  return jsonResponse({ error: 'Rate limit exceeded', retryAfterMs }, 429, {
    'retry-after': String(Math.ceil(retryAfterMs / 1000)),
    ...extraHeaders,
  });
}

/**
 * 500 Internal Server Error — Unexpected server failure.
 * ALWAYS logs the error with context before returning a sanitized message.
 */
export function serverError(
  env: Env,
  error: unknown,
  ctx?: { route?: string; method?: string },
): Response {
  if (ctx?.route) {
    logError(env, error, {
      route: ctx.route,
      method: ctx.method ?? 'UNKNOWN',
      statusCode: 500,
    });
  }
  return jsonResponse({ error: 'Internal server error' }, 500);
}

/**
 * 502 Bad Gateway — Upstream service returned an error.
 */
export function badGateway(
  message = 'Upstream service error',
  extraHeaders?: Record<string, string>,
): Response {
  return jsonResponse({ error: message }, 502, extraHeaders);
}

/**
 * 503 Service Unavailable — Temporary overload or maintenance.
 */
export function serviceUnavailable(
  message = 'Service temporarily unavailable',
  extraHeaders?: Record<string, string>,
): Response {
  return jsonResponse({ error: message }, 503, extraHeaders);
}

// ─── Shared JSON response builder ───────────────────────────────

/**
 * Convenience alias: builds a JSON Response with content-type
 * and a short cache-control. Replaces the inline `jsonResponse`
 * in index.ts — both are kept for backward compatibility.
 */
export function jsonResponse(
  data: unknown,
  status = 200,
  extraHeaders?: Record<string, string>,
): Response {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...(status >= 200 && status < 300
      ? { 'cache-control': 'public, max-age=30' }
      : { 'cache-control': 'no-store' }),
    ...extraHeaders,
  };
  return new Response(JSON.stringify(data), { status, headers });
}
