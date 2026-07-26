/**
 * @degenfeed/api-worker — Discovery Engine
 *
 * Multi-endpoint discovery: trending, communities, people, topics, featured, new.
 * All endpoints cache in KV for 5 minutes (300s).
 *
 * Endpoints:
 *   GET /api/discover                — Legacy: Mastodon directory proxy
 *   GET /api/discover/trending       — Top posts by engagement velocity
 *   GET /api/discover/communities    — Suggested cross-protocol communities
 *   GET /api/discover/people         — People to follow by engagement
 *   GET /api/discover/topics         — Trending niche/topic aggregates
 *   GET /api/discover/featured       — Live spaces + trending topics
 *   GET /api/discover/new            — Recently created communities & active people
 */

import type { TrendingTopic } from '@degenfeed/feed-core';
import { isSpamPost } from '@degenfeed/feed-core';
import type { UnifiedPost } from '@degenfeed/types';
import { COMMUNITY_KV_PREFIX, type CrossProtocolCommunity } from '@degenfeed/utils';
import { jsonResponse } from '../response-helpers';
import { isValidInstanceUrl } from '../sanitize';
import type { Env } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────

type DiscoverPerson = {};
