/**
 * @degenfeed/api-worker — Content Format Translator
 *
 * Transforms DegenFeed UnifiedPost content into protocol-correct output
 * for every supported protocol. Each formatter produces the exact payload
 * shape the target protocol's API expects.
 *
 * This is the REVERSE of the feed-providers' normalizers: instead of
 * turning protocol-native data into UnifiedPosts, we turn UnifiedPosts
 * (or raw text+media) into protocol-native data.
 */

import type { Facet, ImageEmbed } from '@degenfeed/bluesky-sdk/formatter';
import type { Protocol } from '@degenfeed/types';

// ─── Types ────────────────────────────────────────────────────────────────

export type MediaAttachment = {}
