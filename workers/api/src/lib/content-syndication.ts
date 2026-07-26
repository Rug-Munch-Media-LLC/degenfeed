/**
 * @degenfeed/api-worker — Content Syndication Engine
 *
 * Automatic syndication of content across protocols. When a creator publishes
 * on one protocol, this engine auto-posts to all connected protocols with
 * format adaptation, optimal scheduling, and engagement aggregation.
 *
 * KV key scheme:
 *   syndication:rules:{wallet}         → SyndicationRules
 *   syndication:queue:{queueId}        → QueuedSyndication
 *   syndication:history:{wallet}:{id}  → SyndicationHistoryEntry
 *   syndication:format-cache:{hash}    → Adapted formats (cache, 1h TTL)
 */

import type { Protocol } from '@degenfeed/types';
import type { Env } from '../types';
import type { ContentRecord, MediaAttachment } from './content-library';

// ─── Types ──────────────────────────────────────────────────────────────────

export type SyndicationMode = 'auto' | 'manual-review' | 'never';
export type SyndicationStatus = 'queued' | 'in-progress' | 'completed' | 'failed' | 'cancelled';

export type ProtocolSyndicationRule = {}
