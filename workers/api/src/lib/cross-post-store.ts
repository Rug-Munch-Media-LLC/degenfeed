/**
 * @degenfeed/api-worker — Cross-Post KV Store
 *
 * Manages cross-post sibling relationships, reply aggregation tracking,
 * and content sync state across all supported protocols.
 *
 * Each post published to multiple protocols gets a "sibling map" stored
 * in KV so the unified thread view can pull replies from every protocol
 * the content was published to.
 *
 * Edit sync state tracks when a post is edited on one protocol so the
 * change can be propagated to all sibling copies.
 */

import type { Protocol } from '@degenfeed/types';
import type { Env } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────

export type CrosspostSibling = {}
