/**
 * @degenfeed/api-worker — Cross-Platform Live Feed Badges
 *
 * Renders platform badge metadata for live streams in the DegenFeed live feed.
 * Each badge shows which platform(s) a stream originates from and
 * which platforms it's simulcast to.
 *
 * Used by the frontend to show "Also watching on" indicators.
 */

import type { LiveSource, UnifiedLiveStream } from '../../feed/live-aggregator';

export type PlatformBadge = {};
