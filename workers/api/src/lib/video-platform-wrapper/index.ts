/**
 * @degenfeed/api-worker — Video Platform Wrapper Barrel
 */

export type { VideoSource, VideoQueryOptions, ShortsQueryOptions, PlatformHealth, UnifiedVideo, UnifiedCreatorBrief, AggregatedShort, VideoPlatformWrapper } from './types';
export { registerWrapper, getWrapper, getAllWrappers, getAllSources } from './constants';
export { aggregateAllVideos, aggregateAllShorts, aggregateAllLiveStreams } from './core';
