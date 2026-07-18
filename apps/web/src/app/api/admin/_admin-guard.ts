/**
 * @degenfeed/web — Admin route authentication guard
 *
 * Re-exports from the shared API auth helper with admin-wallet checking.
 *
 * Usage in any admin route handler:
 *   const auth = await requireAdmin(request);
 *   if (auth) return auth;
 *
 * IMPORTANT: Admin access is determined from the verified session cookie,
 * NOT from client-controlled headers like X-Wallet-Address.
 * See _auth.ts for the session-based implementation.
 */

export { requireAdmin, requireSession, withAdminHeaders } from '../_auth';
