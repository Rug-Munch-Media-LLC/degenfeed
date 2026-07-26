/**
 * @degenfeed/api-worker — Shorts Aggregation Engine v3 (Unified)
 *
 * Multi-source short-form video aggregator supporting all major platforms.
 *
 * Modules:
 *   types.ts   — Type definitions and constants
 *   convert.ts — Conversion helpers (ShortVideoItem → AggregatedShort)
 *   dedup.ts   — Cross-source deduplication
 *   quality.ts — Quality scoring algorithm
 *   health.ts  — Source health checking
 *   sources.ts — Individual source fetchers (extracted from aggregator)
 *   aggregator.ts — Main ShortsAggregatorV2 class
 */

export { ShortsAggregatorV2 } from './aggregator';
export { toAggregated, weiToEth } from './convert';
export { deduplicate } from './dedup';
export { checkSourcesHealth } from './health';
export { scoreQuality } from './quality';
export type {
  AggregatedShort,
  AggregationOpts,
  AggregationResult,
  ExtendedSource,
  SourceHealth,
} from './types';
export { ALL_SOURCES, SHORTS_MAX_DURATION, SOURCE_META } from './types';
