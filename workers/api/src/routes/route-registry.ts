/**
 * @degenfeed/api-worker — Route registry
 *
 * Provides constants and the withSession helper
 * used by route registration files. Extracted from app.ts.
 */

import type { handlePublish } from '../routes/publish';

// ─── Constants ──────────────────────────────────────────────

export const CSRF_EXEMPT_PATHS = ['/api/tip/frame/', '/api/blink/tip', '/api/x402/verify'];
export const CSRF_SKIP_PREFIXES = ['/api/auth/'];
export const MAX_BODY_BYTES = 1_048_576;
export const DEFAULT_RATE_WINDOW = 5000;
export const DEFAULT_RATE_MAX = 20;

export const STATIC_REDIRECTS: Record<string, string> = {
