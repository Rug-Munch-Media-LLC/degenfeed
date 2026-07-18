/**
 * @degenfeed/web — Admin route authentication guard
 *
 * Re-exports from the shared API auth helper with admin-wallet checking.
 *
 * Usage in any admin route handler:
 *   const auth = await requireAdmin(request);
 *   if (auth) return auth;
 */

export { requireAdmin, requireSession } from '../_auth';
