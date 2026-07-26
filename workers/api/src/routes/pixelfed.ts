/**
 * @degenfeed/api-worker — Pixelfed route handlers
 *
 * Provides:
 *   GET /api/feed/pixelfed       — Pixelfed-specific feed (images & galleries)
 *   GET /api/pixelfed/trending   — Trending Pixelfed posts (by engagement)
 *   GET /api/pixelfed/tags/:tag  — Posts by hashtag
 *
 * All endpoints use the PixelfedProvider to fetch from our self-hosted
 * instance first, then fall back to federated instances.
 */

import type { PixelfedProvider } from '@degenfeed/feed-providers';
import { jsonResponse } from '../response-helpers';
import type { Env } from '../types';

// ─── Provider instance ──────────────────────────────────────────────

function getProvider(env: Env): PixelfedProvider {
