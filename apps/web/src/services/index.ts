/**
 * @degenfeed/web — API Services barrel
 */

export { api, parseJson } from './api';
export type { ApiResponse, AsyncState, LoadingState } from '../types/api';

export {
  fetchFeedPosts, fetchPostById, fetchThread, fetchReplies,
  likePost, bookmarkPost, reportPost, publishContent,
  loadPreferences, savePreferences, crossReply,
} from './feed';
export type { FeedParams, FeedResponse, PostEngagementResult, PublishResult } from './feed';

export {
  fetchLiveSpaces, fetchUpcomingSpaces, fetchPastSpaces, joinSpace, createSpace,
} from './spaces';
export type { Space, JoinResult } from './spaces';

export { fetchDiscoverSection, fetchDiscoverNew } from './discover';
export type { DiscoverSection } from './discover';

export { getUserPreferences, updateUserPreferences } from './preferences';
export type { UserPreferences } from './preferences';
