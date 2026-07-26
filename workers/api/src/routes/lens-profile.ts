/**
 * @degenfeed/api-worker — Lens Profile, Followers & Data Portability
 *
 * Routes:
 *   GET  /api/lens/profile/:id       — Get Lens profile data
 *   GET  /api/lens/profile/resolve   — Resolve handle → profile data
 *   GET  /api/lens/followers/:id     — Get followers for a profile
 *   GET  /api/lens/following/:id     — Get who a profile follows
 *   POST /api/lens/follow            — Follow a Lens profile
 *   POST /api/lens/unfollow          — Unfollow a Lens profile
 *   GET  /api/lens/export            — Export all Lens data (portable JSON)
 *   GET  /api/lens/export/download   — Download full data export as JSON file
 *
 * All data fetched via free public Lens v2 API or local indexer.
 * No paid API dependency.
 */

import { LENS_API_URL, LensClient } from '@degenfeed/lens-sdk';
import { LensDataExportService } from '@degenfeed/lens-sdk/data-export';
import { log } from '../logger';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import { sanitizeString, validateBodySize } from '../sanitize';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── Constants ──────────────────────────────────────────────────────────────

const LENS_API_URL_ENV = 'https://api-v2.lens.dev/graphql';
const IMAGE_PROXY = 'https://img.degenfeed.xyz/';

// ─── KV key helpers ─────────────────────────────────────────────────────────

function lensProfileCacheKey(profileId: string): string {
