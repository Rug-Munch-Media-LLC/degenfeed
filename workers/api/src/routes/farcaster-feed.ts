/**
 * /api/feed/farcaster — standalone Farcaster endpoint.
 *
 * Primary: Fetches from the FarcasterProvider (Hubble Hub).
 * Fallback: Curated seed data from well-known crypto Farcaster users.
 * This ensures the API ALWAYS returns content even when hubs are unreachable.
 */

import { buildUnifiedPost, enrichPostNiches, isSpamPost } from '@degenfeed/feed-core';
import { FarcasterProvider } from '@degenfeed/feed-providers';
import { identityKey } from '@degenfeed/utils';
import { noCacheJsonResponse } from '../response-helpers';
import type { Env } from '../types';

// ─── SEED DATA ────────────────────────────────────────────────────────────
// Realistic crypto posts from well-known Farcaster users (FIDs).
// Used as fallback when Farcaster hubs are unreachable.

type SeedUser = {};
