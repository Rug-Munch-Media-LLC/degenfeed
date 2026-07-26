/**
 * /api/account — GDPR data portability + deletion
 *
 * POST /api/account/export  → returns all user data (preferences, subscriptions, follows, mutes, identities)
 * POST /api/account/delete  → deletes all user data from KV + returns confirmation
 *
 * Both require a valid session cookie.
 */

import { noCacheJsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

export async function handleAccountExport(request: Request, env: Env): Promise<Response> {
