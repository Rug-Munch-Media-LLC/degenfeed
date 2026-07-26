/**
 * /api/preferences — User ranking preferences (KV-backed)
 *
 * Stores per-user ranking preferences in the `user:prefs:<address>` KV
 * namespace so they apply across devices/sessions. Currently supported:
 *
 *   - hideLowQuality: boolean — drop posts with score < 1.0 from feeds
 *   - preferredNiches: string[] — boost posts in these niches
 *   - preferredPlatforms: Protocol[] — boost posts from these platforms
 *   - mutedNiches: string[] — penalize posts in these niches
 *   - recencyWeight: number
 *   - engagementWeight: number
 *   - diversityBoost: boolean
 *
 * Auth: requires a valid session cookie (`__Host-dfid`).
 */

import type { Protocol } from '@degenfeed/types';
import { jsonResponse, methodNotAllowed, noCacheJsonResponse } from '../response-helpers';
import { validateBodySize } from '../sanitize';
import { requireSession } from '../session';
import type { Env } from '../types';

type NotificationTypePref = {};
