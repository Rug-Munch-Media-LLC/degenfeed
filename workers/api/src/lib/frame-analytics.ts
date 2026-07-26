/**
 * @degenfeed/api-worker — Frame Analytics Engine
 *
 * Track views, clicks, conversions, and engagement per frame.
 * Stores data in KV with daily rollups.
 *
 * Every provider integration has: error handling, rate limit tracking,
 * response validation, fallback. No silent failures.
 */

import type { FrameInteractionEvent } from '@degenfeed/farcaster-sdk';
import type { Env } from '../types';

// ─── Types ─────────────────────────────────────────────────────────────────

export type FrameAnalyticsEvent = {};
