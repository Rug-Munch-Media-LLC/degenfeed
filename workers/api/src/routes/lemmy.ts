/**
 * @degenfeed/api-worker — Lemmy Routes
 *
 * Comprehensive API for reading and writing to Lemmy communities.
 *
 * Endpoints:
 *   GET  /api/lemmy/feed            — Lemmy discussion feed (with "💬 Lemmy" badge)
 *   GET  /api/lemmy/community/:name — Community info + recent posts
 *   POST /api/lemmy/post            — Create post on Lemmy (cross-post from DegenFeed)
 *   POST /api/lemmy/comment         — Comment on a Lemmy post
 *   GET  /api/lemmy/trending        — Trending across Lemmy instances
 *   GET  /api/lemmy/instances       — List known healthy instances
 *   GET  /api/lemmy/post/:id        — Get single post with comments
 *
 * Integration notes:
 *   - Lemmy is already a feed provider (LemmyProvider in feed-providers).
 *     This route file adds targeted querying, write operations, and
 *     trending detection on top of the existing provider.
 *   - The main feed already includes Lemmy posts via the pipeline.
 *     These routes are for direct interaction.
 *   - Write operations require Lemmy auth credentials (configured via
 *     env vars or passed in the request body for user-write).
 */

import { type LemmyClient, lemmyToUnifiedPost } from '@degenfeed/lemmy-sdk';
import { jsonResponse } from '../response-helpers';
import { sanitizeString } from '../sanitize';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── Constants ─────────────────────────────────────────────────────────

const INSTANCES = [
  'https://community.degenfeed.xyz',
  'https://talk.degenfeed.xyz',
  'https://lemmy.ml',
  'https://programming.dev',
  'https://beehaw.org',
  'https://sh.itjust.works',
];

const DEFAULT_FEED_LIMIT = 30;
const MAX_FEED_LIMIT = 100;
const _TRENDING_COMMUNITIES = [
  'crypto',
  'defi',
  'technology',
  'bitcoin',
  'ethereum',
  'solana',
  'security',
  'privacy',
  'ai',
  'opensource',
];

// ─── Helpers ───────────────────────────────────────────────────────────

function getClient(instanceUrl: string, jwt?: string): LemmyClient {
