/**
 * @degenfeed/api-worker — Video Platform Wrapper Barrel
 */

export { getAllSources, getAllWrappers, getWrapper, registerWrapper } from './constants';
export { aggregateAllLiveStreams, aggregateAllShorts, aggregateAllVideos } from './core';
export type {
  AggregatedShort,
  PlatformHealth,
  ShortsQueryOptions,
  UnifiedCreatorBrief,
  UnifiedVideo,
  VideoPlatformWrapper,
  VideoQueryOptions,
  VideoSource,
} from './types';
