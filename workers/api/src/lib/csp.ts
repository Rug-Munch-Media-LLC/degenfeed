/**
 * @degenfeed/api-worker — Content Security Policy header builder
 *
 * Generates CSP headers for each route context:
 *   - API responses: default-src 'none' (JSON-only responses)
 *   - Landing page: Google Fonts + self
 *   - Swagger UI: CDN-hosted assets
 *   - Embeds: frame-ancestors *
 *
 * Usage:
 *   import { cspForPath } from './lib/csp';
 *   headers.set('content-security-policy', cspForPath(pathname));
 */

// ─── CSP directive builders ──────────────────────────────────────────

/**
 * API responses return JSON only — no HTML, no scripts, no styles.
 * The strictest possible policy.
 */
const API_CSP = "default-src 'none'";

/**
 * Landing page: self-hosted CSS/JS + Google Fonts.
 * 'unsafe-inline' for style-src is required because the CSS
 * is served inline via a <link> tag and the landing page
 * uses inline styles in the HTML template.
 * Script-src is 'self' only (the /app.js and Plausible script).
 */
const LANDING_CSP =
  "default-src 'self'; " +
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
  'font-src https://fonts.gstatic.com; ' +
  "script-src 'self' https://plausible.rugmunch.io; " +
  "img-src 'self' data:; " +
  "connect-src 'self'; " +
  "frame-ancestors 'none'; " +
  "base-uri 'self'; " +
  "form-action 'none'";

/**
 * Swagger UI: loads CSS/JS from jsdelivr CDN + inline scripts/styles.
 * 'unsafe-inline' is required for Swagger UI's runtime HTML generation.
 * 'unsafe-eval' is NOT included — Swagger UI 5+ doesn't need it.
 */
const SWAGGER_CSP =
  "default-src 'self'; " +
  "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; " +
  "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; " +
  "img-src 'self' data:; " +
  "connect-src 'self' https:; " +
  "font-src 'self' https://cdn.jsdelivr.net; " +
  "frame-ancestors 'none'; " +
  "base-uri 'self'; " +
  "form-action 'none'";

/**
 * Embed pages: should be embeddable anywhere (frame-ancestors *).
 * Minimal HTML with no external resources beyond the embed.js script.
 * Note: frame-ancestors * means these pages can be iframed by any site,
 * which is intentional — embed cards should work everywhere.
 */
const EMBED_CSP =
  "default-src 'self'; " +
  "script-src 'self' https://app.degenfeed.xyz; " +
  "img-src 'self' https: data:; " +
  "style-src 'self' 'unsafe-inline'; " +
  'frame-ancestors *; ' +
  "base-uri 'self'; " +
  "form-action 'none'";

/**
 * Admin pages: strict, no external resources, no eval.
 */
const ADMIN_CSP =
  "default-src 'self'; " +
  "style-src 'self' 'unsafe-inline'; " +
  "script-src 'self'; " +
  "img-src 'self' data:; " +
  "connect-src 'self'; " +
  "frame-ancestors 'none'; " +
  "base-uri 'self'; " +
  "form-action 'self'";

// ─── CSP dispatch ────────────────────────────────────────────────────

/**
 * Select the appropriate CSP header value for a given request path.
 *
 * @param pathname - The URL pathname (e.g. "/api/feed/trending" or "/")
 * @returns The CSP header value string, or null to skip setting CSP.
 */
export function cspForPath(pathname: string): string | null {
