/**
 * @degenfeed/api-worker — Enhanced Adaptive Streaming Router
 *
 * Thin barrel — re-exports from domain-specific modules.
 */

export { BandwidthTracker } from './streaming-router-bandwidth';
export { StreamingRouter } from './streaming-router-core';
export {
  handleBandwidthReport,
  handleBandwidthSummary,
  handleRouteEstimate,
  handleRouteSwitch,
  handleStreamRouteStatus,
} from './streaming-router-handlers';
export type {
  ActiveStream,
  BandwidthUsage,
  SimulcastTarget,
  StreamingMode,
  StreamRouteDecision,
} from './streaming-router-types';
export {
  COST_PER_MODE,
  MODE_EMOJIS,
  MODE_LABELS,
  STREAMING_THRESHOLDS,
} from './streaming-router-types';
