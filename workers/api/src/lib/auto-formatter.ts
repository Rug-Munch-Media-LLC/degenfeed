/**
 * @degenfeed/api-worker — Auto-Formatting Engine
 *
 * Premium auto-formatting for cross-posts:
 *   - Auto-threading: split long content into threads per-platform
 *   - Hashtag optimization: AI-powered hashtag suggestions + platform adaptation
 *   - Image optimization: auto-resize, format conversion per platform
 *   - Link optimization: UTM params, link shortening
 *   - Language adaptation: tone adjustment per platform
 *
 * Each formatter takes a MasterPost and returns per-protocol formatted output.
 * Used by the premium publish queue before dispatch.
 */

import type { MasterPost, ProtocolPublishParams } from '@degenfeed/cross-protocol-bridge';

// ─── Types ────────────────────────────────────────────────────────────────

export type ThreadSegment = {}
