'use client';

/**
 * @degenfeed/web — CSRF token management
 *
 * Stores the X-CSRF-Token obtained during wallet sign-in and provides
 * a fetch wrapper that attaches it to every request to /api/* so
 * the server-side CSRF middleware can validate it.
 *
 * The token is held in memory only (not localStorage) so it is
 * scoped to the current browser tab session. On page reload the
 * user re-authenticates and gets a fresh token.
 */

let _csrfToken: string | null = null;

/**
 * Store the CSRF token for the current session.
 * Called after successful wallet sign-in.
 */
export function setCsrfToken(token: string | null | undefined): void {
  _csrfToken = token ?? null;
}

/**
 * Retrieve the stored CSRF token, if any.
 */
export function getCsrfToken(): string | null {
  return _csrfToken;
}

/**
 * Clear the CSRF token (e.g., on sign-out).
 */
export function clearCsrfToken(): void {
  _csrfToken = null;
}

/**
 * Fetch wrapper that automatically attaches the X-CSRF-Token header
 * to any request against /api/* for cookie-authenticated sessions.
 *
 * Does NOT attach the header when:
 *   - The method is GET or HEAD (safe methods — no CSRF risk)
 *   - The URL does not start with /api/
 *   - No CSRF token is currently stored
 *
 * Usage: replace fetch(url, opts) with csrfFetch(url, opts).
 */
export async function csrfFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

  // Only attach CSRF token to state-changing API requests
  if (
    _csrfToken &&
    url.startsWith('/api/') &&
    init?.method &&
    !['GET', 'HEAD'].includes(init.method.toUpperCase())
  ) {
    const headers = new Headers(init.headers);
    if (!headers.has('x-csrf-token')) {
      headers.set('x-csrf-token', _csrfToken);
    }
    return fetch(input, { ...init, headers });
  }

  return fetch(input, init);
}
