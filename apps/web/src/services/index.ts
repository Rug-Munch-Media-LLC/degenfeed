/**
 * @degenfeed/web — API Services barrel
 */

export type { ApiResponse, AsyncState, LoadingState } from '../types/api';
export { api, parseJson } from './api';
export type { DiscoverSection } from './discover';
export { fetchDiscoverNew, fetchDiscoverSection } from './discover';
export type { FeedParams, FeedResponse, PostEngagementResult, PublishResult } from './feed';
export {
  bookmarkPost,
  crossReply,
  fetchFeedPosts,
  fetchPostById,
  fetchReplies,
  fetchThread,
  likePost,
  loadPreferences,
  publishContent,
  reportPost,
  savePreferences,
} from './feed';
export type { UserPreferences } from './preferences';
export { getUserPreferences, updateUserPreferences } from './preferences';
export type { JoinResult, Space } from './spaces';
export {
  createSpace,
  fetchLiveSpaces,
  fetchPastSpaces,
  fetchUpcomingSpaces,
  joinSpace,
} from './spaces';
