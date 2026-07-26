/**
 * /api/translate — Protocol content translation endpoint.
 *
 * POST /api/translate
 * Body: { content: string, fromProtocol: string, toProtocol: string }
 * Returns: { translated, truncated, originalLength, translatedLength, maxLength, ... }
 *
 * Applies protocol-specific formatting rules so cross-protocol posts
 * feel native, not copy-pasted. Caches identical translation requests
 * via KV (1h TTL) to avoid redundant work.
 */

import { translateContent } from '@degenfeed/utils';
import { jsonResponse, methodNotAllowed, noCacheJsonResponse } from '../response-helpers';
import { hasSuspiciousPayload, sanitizeString } from '../sanitize';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── Supported protocol keys for translation ────────────────────────

const TRANSLATABLE_PROTOCOLS = new Set([
  'nostr',
  'farcaster',
  'lens',
  'mastodon',
  'bluesky',
  'lemmy',
]);

// ─── Request shape ──────────────────────────────────────────────────

type TranslateRequest = {}
