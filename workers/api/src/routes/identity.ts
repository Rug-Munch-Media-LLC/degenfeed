/**
 * @degenfeed/api-worker — Identity routes
 *
 * GET  /api/identity/resolve          — Resolve a handle to a protocol identity (existing)
 * POST /api/identity/link             — Link a protocol identity to an authenticated wallet
 * DELETE /api/identity/link           — Unlink a protocol identity from the authenticated wallet
 * GET  /api/identity/profile          — Get all linked identities for a wallet address (public)
 */

import { resolveHandle } from '@degenfeed/identity';
import type { CrossProtocolIdentity } from '@degenfeed/utils';
import { identityKey } from '@degenfeed/utils';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── Existing: resolve a handle ───────────────────────────────────────

export async function handleResolveIdentity(request: Request, env: Env): Promise<Response> {
