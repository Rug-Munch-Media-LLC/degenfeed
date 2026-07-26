/**
 * global-dedup — Cross-platform universal deduplication registry.
 *
 * Tracks ALL content across ALL protocols with 15 dedup methods.
 * One piece of content appears exactly once, regardless of protocol.
 *
 * Designed to be called BEFORE scoring in the feed pipeline so dupes
 * are removed before ranking/sorting.
 *
 * Storage: DEDUP KV namespace (persistent) + CACHE KV for bloom filters.
 *
 * Dedup layers:
 *   1. SHA-256 content hash (exact match)
 *   2. Normalized URL matching (remove utm, tracking, fragments)
 *   3. Title Levenshtein distance (<85% similarity = dupe)
 *   4. First 200 chars normalized similarity
 *   5. Image perceptual hash (for visual content)
 *   6. Link canonical URL matching
 *   7. Author + title combination
 *   8. Domain + slug matching
 *   9. OG metadata matching
 *  10. Cross-protocol ID mapping (same post on Nostr and Farcaster)
 *  11. Quote-posting detection (repost of same content)
 *  12. Thread detection (same thread, merged)
 *  13. Timestamp proximity (same time ±5min from same author)
 *  14. Embedded content detection (tweet in article = dupe of original tweet)
 *  15. RSS GUID dedup (RSS standard)
 */

import type { Env } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────

export type DedupFingerprint = {}
