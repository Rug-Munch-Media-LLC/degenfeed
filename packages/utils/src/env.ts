/**
 * @degenfeed/utils — Environment-derived URLs
 *
 * Single responsibility: read an env value with a safe local default.
 */

/** Backend base URL, defaulting to the local development port. */
export function rmiUrl(env: { RMI_BACKEND_URL?: string }): string {
  return env.RMI_BACKEND_URL || 'http://127.0.0.1:8000';
}
