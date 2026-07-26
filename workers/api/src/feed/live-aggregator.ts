/**
 * @degenfeed/api-worker — Unified Live Stream Aggregator
 *
 * Thin barrel — re-exports from domain-specific modules.
 * All implementations live in sibling files.
 */

export { startLiveStream, stopLiveStream } from './live-aggregator-control';
export { aggregateAllStreams, aggregateUpcomingStreams } from './live-aggregator-core';
export { getSourceHealth, trackSourceHealth } from './live-aggregator-health';
export { createSchedule, getCreatorSchedules } from './live-aggregator-schedule';
export {
  fetchDegenFeedSpaces,
  fetchFarcasterLiveStreams,
  fetchNostrLiveStreams,
  fetchOwncastStreams,
  fetchPeerTubeStreams,
  fetchTwitchStreams,
} from './live-aggregator-sources-platform';
export { fetchYouTubeLiveStreams } from './live-aggregator-sources-youtube';
export type {
  GoLiveConfig,
  GoLiveResult,
  LiveSource,
  SourceHealth,
  StreamSchedule,
  UnifiedIdentity,
  UnifiedLiveStream,
  UpcomingStream,
} from './live-aggregator-types';
export { formatViewerSSE, generateLiveId, resolvePeerTubeCategory } from './live-aggregator-utils';
export { getStreamViewerCount } from './live-aggregator-viewers';
