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
  '/docs': 'https://app.degenfeed.xyz/docs',
  '/about': 'https://app.degenfeed.xyz/about',
  '/faq': 'https://app.degenfeed.xyz/faq',
  '/legal': 'https://app.degenfeed.xyz/legal',
  '/privacy': 'https://app.degenfeed.xyz/privacy',
  '/terms': 'https://app.degenfeed.xyz/terms',
  '/acceptable-use': 'https://app.degenfeed.xyz/acceptable-use',
  '/community-guidelines': 'https://app.degenfeed.xyz/community-guidelines',
  '/premium': 'https://app.degenfeed.xyz/premium',
  '/newsletter': 'https://app.degenfeed.xyz/newsletter',
  '/status': 'https://app.degenfeed.xyz/status',
  '/discover': 'https://app.degenfeed.xyz/discover',
  '/feed': 'https://app.degenfeed.xyz/feed',
  '/news': 'https://app.degenfeed.xyz/news',
  '/home': 'https://app.degenfeed.xyz/home',
};

// ─── Session helper ─────────────────────────────────────────

export async function withSession(
  // biome-ignore lint/suspicious/noExplicitAny: conditional type gate — actual shape matches Hono Context
  c: Parameters<typeof handlePublish>[0] extends Request ? any : never,
  handler: () => Promise<Response>,
): Promise<Response> {
  const { requireSession, applySessionRefresh } = await import('../session');
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;
  const resp = await handler();
  if (c.env.AUTH_SECRET) return applySessionRefresh(resp, session, c.env.AUTH_SECRET);
  return resp;
}


