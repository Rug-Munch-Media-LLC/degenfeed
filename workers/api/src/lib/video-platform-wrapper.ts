/**
 * @degenfeed/api-worker — Video Platform Wrapper
 *
 * Split into module at ./video-platform-wrapper/ for maintainability.
 * This file re-exports the public API.
 *
 * @see ./video-platform-wrapper/index.ts
 */

export type {
  VideoSource, VideoQueryOptions, ShortsQueryOptions, PlatformHealth,
  UnifiedVideo, UnifiedCreatorBrief, AggregatedShort, VideoPlatformWrapper,
} from './video-platform-wrapper/types';

export { registerWrapper, getWrapper, getAllWrappers, getAllSources } from './video-platform-wrapper/constants';

export { aggregateAllVideos, aggregateAllShorts, aggregateAllLiveStreams } from './video-platform-wrapper/core';

export {
  farcasterPlatformWrapper, zoraPlatformWrapper, lensPlatformWrapper,
  nostrPlatformWrapper, dtubePlatformWrapper, odyseePlatformWrapper,
  rumblePlatformWrapper, bittubePlatformWrapper,
} from './video-platform-wrapper/providers';
