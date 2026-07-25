/**
 * @degenfeed/api-worker — Standardized error classes
 *
 * Every route handler and middleware MUST use these error classes instead
 * of constructing ad-hoc error responses. The `handleError()` catch-all in
 * app.ts catches these and returns consistent JSON error shapes.
 *
 * USAGE:
 *   import { NotFoundError, ValidationError, handleError } from '../lib/errors';
 *
 *   // In route handlers:
 *   if (!post) throw new NotFoundError('Post not found');
 *   if (!valid) throw new ValidationError('Invalid input', { field: 'email' });
 *
 *   // In catch blocks (when you can't rethrow):
 *   return handleError(err, env, { route: '/api/post', method: 'GET' });
 *
 * ERROR SHAPE (returned to client):
 *   {
 *     error: 'Human-readable message',
 *     code: 'NOT_FOUND',       // Machine-readable error code
 *     details?: { ... },        // Optional additional context
 *     requestId?: string        // Correlates to server logs
 *   }
 */

import type { Env } from '../index';
import { logError } from '../error-logger';

// ─── Base Error Class ────────────────────────────────────────────────

export class AppError extends Error {
  /**
   * @param message Human-readable error message (returned to client)
   * @param code Machine-readable error code (e.g., 'NOT_FOUND', 'VALIDATION_ERROR')
   * @param status HTTP status code
   * @param details Optional additional context (e.g., validation field errors)
   */
  constructor(
    message: string,
    public code: string = 'INTERNAL_ERROR',
    public status: number = 500,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// ─── Concrete Error Classes ──────────────────────────────────────────

/**
 * 400 Bad Request — Client sent invalid input.
 */
export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

/**
 * 401 Unauthorized — Authentication required or failed.
 */
export class AuthError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 'AUTH_ERROR', 401);
    this.name = 'AuthError';
  }
}

/**
 * 402 Payment Required — x402 or token-gated content.
 */
export class PaymentRequiredError extends AppError {
  constructor(message = 'Payment required', details?: Record<string, unknown>) {
    super(message, 'PAYMENT_REQUIRED', 402, details);
    this.name = 'PaymentRequiredError';
  }
}

/**
 * 403 Forbidden — Authenticated but not permitted.
 */
export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', details?: Record<string, unknown>) {
    super(message, 'FORBIDDEN', 403, details);
    this.name = 'ForbiddenError';
  }
}

/**
 * 404 Not Found — Resource does not exist.
 */
export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(message, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

/**
 * 409 Conflict — Resource state conflict (e.g., duplicate creation).
 */
export class ConflictError extends AppError {
  constructor(message = 'Conflict', details?: Record<string, unknown>) {
    super(message, 'CONFLICT', 409, details);
    this.name = 'ConflictError';
  }
}

/**
 * 410 Gone — Resource permanently removed.
 */
export class GoneError extends AppError {
  constructor(message = 'Resource no longer available') {
    super(message, 'GONE', 410);
    this.name = 'GoneError';
  }
}

/**
 * 413 Payload Too Large — Request body exceeds maximum size.
 */
export class PayloadTooLargeError extends AppError {
  constructor(message = 'Request too large') {
    super(message, 'PAYLOAD_TOO_LARGE', 413);
    this.name = 'PayloadTooLargeError';
  }
}

/**
 * 415 Unsupported Media Type — Request body format not accepted.
 */
export class UnsupportedMediaTypeError extends AppError {
  constructor(message = 'Unsupported media type') {
    super(message, 'UNSUPPORTED_MEDIA_TYPE', 415);
    this.name = 'UnsupportedMediaTypeError';
  }
}

/**
 * 422 Unprocessable Entity — Semantic validation failure.
 */
export class UnprocessableError extends AppError {
  constructor(message = 'Unprocessable entity', details?: Record<string, unknown>) {
    super(message, 'UNPROCESSABLE', 422, details);
    this.name = 'UnprocessableError';
  }
}

/**
 * 429 Too Many Requests — Rate limit exceeded.
 */
export class RateLimitError extends AppError {
  constructor(
    message = 'Rate limit exceeded',
    public retryAfterMs?: number,
  ) {
    super(message, 'RATE_LIMITED', 429, retryAfterMs ? { retryAfterMs } : undefined);
    this.name = 'RateLimitError';
  }
}

/**
 * 500 Internal Server Error — Unexpected server failure.
 */
export class InternalError extends AppError {
  constructor(message = 'Internal server error') {
    super(message, 'INTERNAL_ERROR', 500);
    this.name = 'InternalError';
  }
}

/**
 * 502 Bad Gateway — Upstream service error.
 */
export class BadGatewayError extends AppError {
  constructor(message = 'Upstream service error', details?: Record<string, unknown>) {
    super(message, 'BAD_GATEWAY', 502, details);
    this.name = 'BadGatewayError';
  }
}

/**
 * 503 Service Unavailable — Temporary overload or maintenance.
 */
export class ServiceUnavailableError extends AppError {
  constructor(message = 'Service temporarily unavailable') {
    super(message, 'SERVICE_UNAVAILABLE', 503);
    this.name = 'ServiceUnavailableError';
  }
}

// ─── Error Handler ───────────────────────────────────────────────────

export interface ErrorHandlerOptions {
  route?: string;
  method?: string;
  requestId?: string;
}

/**
 * Centralized error handler — converts any error into a consistent Response.
 *
 * - AppError subclasses get their status/code/message/details
 * - Unknown errors become 500 Internal Server Error (with logging)
 * - Always returns JSON with content-type application/json
 * - Includes x-request-id for log correlation
 *
 * Usage in route catch blocks:
 *   try { ... } catch (err) {
 *     return handleError(err, env, { route: '/api/post', method: 'GET' });
 *   }
 */
export function handleError(
  error: unknown,
  env: Env,
  options: ErrorHandlerOptions = {},
): Response {
  const { route, method, requestId } = options;

  // Determine error properties
  let message = 'Internal server error';
  let code = 'INTERNAL_ERROR';
  let status = 500;
  let details: Record<string, unknown> | undefined;

  if (error instanceof AppError) {
    message = error.message;
    code = error.code;
    status = error.status;
    details = error.details;
  } else if (error instanceof Error) {
    message = error.message;
    // Log unexpected errors (non-AppError)
    if (route && method) {
      logError(env, error, { route, method, statusCode: 500 });
    }
  } else if (error && typeof error === 'object' && 'message' in error) {
    message = String((error as { message: unknown }).message);
  } else if (typeof error === 'string') {
    message = error;
  }

  // Build response body
  const body: Record<string, unknown> = { error: message, code };
  if (details && Object.keys(details).length > 0) {
    body.details = details;
  }
  if (requestId) {
    body.requestId = requestId;
  }

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'cache-control': 'no-store',
  };
  if (requestId) {
    headers['x-request-id'] = requestId;
  }

  return new Response(JSON.stringify(body), { status, headers });
}
