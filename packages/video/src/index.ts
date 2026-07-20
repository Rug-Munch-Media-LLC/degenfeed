/**
 * @degenfeed/video — Consolidated video provider package
 *
 * Merges youtube-provider, peertube-provider, and shorts-provider
 * into a single package for video content discovery and ranking.
 */

// ─── YouTube ───────────────────────────────────────────────────────
export type {
  ChannelCategory,
  VideoItem,
  YouTubeVideoItem,
} from '@degenfeed/youtube-provider';
export { fetchYouTubeFeed } from '@degenfeed/youtube-provider';

// ─── PeerTube ──────────────────────────────────────────────────────
export type {
  PeerTubeChannelInfo,
  PeerTubeVideo,
  VideoSource,
} from '@degenfeed/peertube-provider';
export {
  createPeerTubeAdapter,
  fetchPeerTubeVideos,
  searchPeerTube,
} from '@degenfeed/peertube-provider';
export type {
  PeerTubeSearchResult,
} from '@degenfeed/peertube-provider/federated';
export {
  FEDERATED_PEERTUBE_INSTANCES,
  searchSepiasearch,
} from '@degenfeed/peertube-provider/federated';
export {
  fetchLiveStreams,
  type LiveStreamInfo,
} from '@degenfeed/peertube-provider/livestream';

// ─── Shorts (short-form video) ─────────────────────────────────────
export type {
  ShortVideoItem,
  ShortVideoSource,
  UserInterestProfile,
} from '@degenfeed/shorts-provider';
export {
  computeShortScore,
  fetchShortsFeed,
  rankShorts,
} from '@degenfeed/shorts-provider';
