/**
 * @degenfeed/api-worker — Identity Extension Routes
 *
 * Cross-platform identity linking for AT Protocol, Zora, and Telegram.
 * Extends the base identity router with new protocol support.
 *
 * Prefix: /api/identity/extensions
 *
 * Routes:
 *   POST /api/identity/extensions/link/atproto     — Link AT Protocol identity
 *   POST /api/identity/extensions/create/atproto    — Auto-create AT Protocol account
 *   POST /api/identity/extensions/link/zora         — Link Zora creator coin
 *   GET  /api/identity/extensions/resolve/zora      — Resolve creator coin for wallet
 *   POST /api/identity/extensions/link/telegram     — Link Telegram identity
 *   GET  /api/identity/extensions/resolve/did       — Resolve DID to wallet addresses
 *   GET  /api/identity/extensions/resolve/wallet    — Resolve wallet to ALL protocol identities
 *   GET  /api/identity/extensions/status            — Protocol integration status
 */

import type { CrossProtocolIdentity } from '@degenfeed/utils';
import { identityKey } from '@degenfeed/utils';
import { checkIdentityLinkRateLimit } from '../lib/community-store';
import { sealForWallet } from '../lib/crypto-seal';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import { parseSessionCookie, requireSession, validateCsrfToken } from '../session';
import type { Env } from '../types';

// ─── AT Protocol ────────────────────────────────────────────────

/**
 * POST /api/identity/extensions/link/atproto
 *
 * Link an AT Protocol identity to the authenticated wallet.
 * Accepts: { handle: string, password?: string }
 * Verifies by creating a session on our PDS.
 * Stores DID + credentials in KV.
 */
export async function handleLinkAtproto(request: Request, env: Env): Promise<Response> {
