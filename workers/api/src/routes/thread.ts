/**
 * /api/thread/:dfUri — Unified cross-protocol thread view.
 *
 * Gathers ALL replies to a post across every protocol into one thread:
 *   1. Native replies from the parent post's own protocol
 *   2. Cross-protocol bridge replies stored in KV (`bridge:reply:{dfUri}:*`)
 *   3. Native replies on sibling posts where the content was cross-posted
 *      via Postiz (`crosspost:{dfUri}` sibling mapping)
 *
 * Nesting is tracked in `bridge:reply:thread:{rootUri}` as a flat edge list
 * `[{ replyUri, parentUri, protocol, depth }]` so replies-to-bridge-replies
 * stay attached to the root thread across protocols.
 *
 * GET /api/thread/:dfUri?sort=chrono|top|protocol&limit=50
 * Returns: { post, replies: ThreadReply[], protocols: string[], bridgeCount, byProtocol }
 */

import { buildUnifiedPost } from '@degenfeed/feed-core';
import type { Protocol, UnifiedPost } from '@degenfeed/types';
import { jsonResponse, methodNotAllowed, noCacheJsonResponse } from '../response-helpers';
import { ALLOWED_PROTOCOLS, sanitizeString } from '../sanitize';
import type { Env } from '../types';
import { handlePostReplies } from './replies';

// ─── Types ──────────────────────────────────────────────────

/** UnifiedPost extended with cross-protocol thread metadata. */
export interface ThreadReply extends UnifiedPost {
