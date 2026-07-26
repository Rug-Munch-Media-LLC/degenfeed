/**
 * @degenfeed/api-worker — Lens Protocol Authentication & Registration
 *
 * Enables full Lens Protocol ownership:
 *   POST /api/lens/auth          — Authenticate as existing Lens user via wallet signature
 *   POST /api/lens/register      — Create a new Lens profile + handle on Polygon
 *   GET  /api/lens/auth/status   — Check whether the session has a linked Lens profile
 *
 * All Lens API calls go through the free public Lens v2 GraphQL API.
 * No paid API dependency.
 *
 * Rate limits:
 *   Auth:      10 req/min per IP
 *   Register:  3 req/min per IP (on-chain costs involved)
 */

import { LENS_API_URL, LensClient } from '@degenfeed/lens-sdk';
import { log } from '../logger';
import { jsonResponse } from '../response-helpers';
import { hasSuspiciousPayload, sanitizeString, validateBodySize } from '../sanitize';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── Constants ──────────────────────────────────────────────────────────────

const LENS_API_URL_ENV = 'https://api-v2.lens.dev/graphql';
const LENS_HUB_ADDRESS = '0xDb46d1Dc155634FbC732f92E853b10B288AD5a1d';
const POLYGON_CHAIN_ID = 137;

/** Rate limit config */
const AUTH_RATE_LIMIT = { max: 10, window: 60_000 };
const REGISTER_RATE_LIMIT = { max: 3, window: 60_000 };

// ─── KV key helpers ─────────────────────────────────────────────────────────

function lensAuthKey(wallet: string): string {
