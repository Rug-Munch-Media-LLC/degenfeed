/**
 * @recommendation-engine — Multi-signal content recommendation engine
 *
 * Combines 10 signals to surface the best content from all sources:
 *   1. Watch history       6. Session context (current watching)
 *   2. Engagement          7. Trending signals
 *   3. Followed creators   8. Source diversity
 *   4. Held coins          9. Freshness
 *   5. Category pref       10. Creator quality
 *
 * Stores interaction data in KV namespaces and builds interest profiles
 * that improve with every user action.
 */

import type { Protocol, UnifiedPost } from '@degenfeed/types';
import type { Env } from '../types';

// ─── Public types ────────────────────────────────────────────────────────

export type ContentSource =
  | 'youtube'
  | 'peertube'
  | 'tiktok'
  | 'instagram'
  | 'twitch'
  | 'kick'
  | 'rumble'
  | 'odysee';

export type InteractionAction = 'watch' | 'like' | 'share' | 'skip' | 'complete' | 'tip';

export type InteractionMetadata = {};
