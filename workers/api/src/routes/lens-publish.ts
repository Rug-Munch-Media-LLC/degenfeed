/**
 * @degenfeed/api-worker — Lens Publications, Reactions & Feed
 *
 * Full API for reading/writing Lens content via our self-hosted indexer
 * and the free public Lens v2 GraphQL API.
 *
 * Routes:
 *   POST   /api/lens/publish         — Create a new post on Lens
 *   POST   /api/lens/publish/gasless — Create a post via Momoka (free, no gas)
 *   POST   /api/lens/publish/comment — Comment on a publication
 *   POST   /api/lens/publish/mirror  — Mirror a publication
 *   POST   /api/lens/publish/collect — Collect a publication
 *   POST   /api/lens/react           — Like/unlike a publication
 *   GET    /api/lens/feed            — Timeline feed from local indexer
 *   GET    /api/lens/feed/explore    — Explore/trending content
 *   GET    /api/lens/publications    — Get publications for a profile
 *
 * Error handling, rate limiting, and response validation on every endpoint.
 * No paid API dependency.
 */

import { LENS_API_URL, LensClient } from '@degenfeed/lens-sdk';
import { log } from '../logger';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import { hasSuspiciousPayload, sanitizeString, validateBodySize } from '../sanitize';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── Constants ──────────────────────────────────────────────────────────────

const LENS_API_URL_ENV = 'https://api-v2.lens.dev/graphql';
const LOCAL_INDEXER_URL = 'http://127.0.0.1:8099';
const INDEXER_TIMEOUT = 5000;

// ─── KV key helpers ─────────────────────────────────────────────────────────

function lensSessionKey(profileId: string): string {
