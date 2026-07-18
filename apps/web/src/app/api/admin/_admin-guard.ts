/**
 * Next.js admin wallet guard — validates wallet addresses against ADMIN_WALLETS env var.
 *
 * Extracts wallet from X-Wallet-Address request header and checks against
 * the ADMIN_WALLETS environment variable (comma-separated, lowercase addresses).
 *
 * Usage in a Next.js route handler:
 *   import { requireNextAdmin } from './_admin-guard';
 *
 *   export async function POST(request: NextRequest) {
 *     const guard = requireNextAdmin(request);
 *     if (!guard.allowed) return NextResponse.json({ error: guard.error }, { status: 403 });
 *     // ...
 *   }
 */

const ADMIN_WALLETS = (process.env.ADMIN_WALLETS || '')
  .split(',')
  .map((w) => w.trim().toLowerCase())
  .filter(Boolean);

/**
 * Pure check — is the given wallet address in the admin list?
 */
export function isAdmin(walletAddress: string): boolean {
  if (!walletAddress) return false;
  return ADMIN_WALLETS.includes(walletAddress.toLowerCase());
}

/**
 * Validate a wallet address against the admin list.
 * Returns `{ allowed: true }` or `{ allowed: false, error: string }`.
 */
export function requireAdmin(walletAddress: string): { allowed: boolean; error?: string } {
  if (!walletAddress) return { allowed: false, error: 'No wallet address provided' };
  if (ADMIN_WALLETS.length === 0) return { allowed: false, error: 'ADMIN_WALLETS not configured' };
  if (!isAdmin(walletAddress)) return { allowed: false, error: 'Not an admin wallet' };
  return { allowed: true };
}

/**
 * Extract wallet address from a Next.js Request and validate it.
 * Looks for X-Wallet-Address header first, then falls back to x-wallet-address.
 */
export function requireNextAdmin(
  request: Request,
): { allowed: true; walletAddress: string } | { allowed: false; error: string } {
  const walletAddress =
    request.headers.get('X-Wallet-Address') || request.headers.get('x-wallet-address') || '';
  return requireAdmin(walletAddress) as
    | { allowed: true; walletAddress: string }
    | { allowed: false; error: string };
}

/**
 * Add `X-Admin-Validated: true` header to a Next.js Response JSON.
 */
export function addAdminValidatedHeaders(init?: ResponseInit): ResponseInit {
  const headers = new Headers(init?.headers);
  headers.set('X-Admin-Validated', 'true');
  return { ...init, headers };
}
