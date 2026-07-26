/**
 * @degenfeed/api-worker — Unified Content Library
 *
 * KV-backed content library for each creator. Every post/video/short published
 * through DegenFeed is stored here, creating a permanent content catalog that
 * spans all protocols.
 *
 * KV key scheme:
 *   cl:{wallet}:{contentId}  → ContentRecord (full record, no TTL)
 *   cl:idx:{wallet}           → JSON array of { id, type, title, createdAt, updatedAt }
 *   cl:idx:{wallet}:{type}    → JSON array of { id, title, createdAt } (per-type index)
 *
 * The library is append-only: content is never truly deleted, only soft-deleted
 * (via a `deleted` flag in the record).
 */

import type { Env } from '../types';

// ─── Types ──────────────────────────────────────────────────────────────────

export type MediaAttachment = {};
