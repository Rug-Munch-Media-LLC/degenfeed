// ═══════════════════════════════════════════════════════════════════════════
// Bridge API Authentication Middleware
//
// Validates Bearer token from Authorization header against BRIDGE_API_KEY env var.
// Public endpoints (health, well-known) are exempt.
// All other routes require Authorization: Bearer <BRIDGE_API_KEY>.
//
// CVSS 9.1 mitigated: Unauthenticated access to bridge server now requires
// a valid API key for all non-health routes.
// ═══════════════════════════════════════════════════════════════════════════

import type { IncomingMessage } from 'node:http';

/**
 * Public path prefixes that do not require authentication.
 * Health checks and well-known endpoints must remain accessible
 * for monitoring and protocol discovery.
 */
const PUBLIC_PATHS = [
  '/health',
  '/api/health',
  '/.well-known',
  '/api/bridge/health',
  // Owncast posts stream lifecycle webhooks here without a BRIDGE_API_KEY.
  // The handler validates event types; it does not expose bridge data.
  '/api/webhooks',
] as const;

/**
 * Validate an incoming request against the BRIDGE_API_KEY.
 *
 * @param req - The Node.js IncomingMessage to validate
 * @returns true if the request is authorized or is a public endpoint
 */
export function validateAuth(req: IncomingMessage): boolean {
  const url = new URL(req.url || '/', 'http://localhost');

  // Public endpoints — no auth required
  // This allows monitoring systems, load balancers, and protocol discovery
  // to function without exposing sensitive data.
  for (const publicPath of PUBLIC_PATHS) {
    if (url.pathname.startsWith(publicPath)) {
      return true;
    }
  }

  // API key validation
  const apiKey = process.env.BRIDGE_API_KEY;
  if (!apiKey) {
    console.warn('[auth] BRIDGE_API_KEY not set — denying all authenticated requests');
    return false;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return false;
  }

  if (!authHeader.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.slice(7);
  return token === apiKey;
}
