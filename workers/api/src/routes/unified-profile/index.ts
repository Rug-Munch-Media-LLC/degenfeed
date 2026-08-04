/**
 * @degenfeed/api-worker — Unified Profile barrel
 */

export { handleProfileBadges } from './badges';
export {
  handleActivityFeed,
  handleAggregateProfile,
  handleContentPerformance,
  handleRevenueSummary,
  handleSearchProfiles,
  handleSuggestedProfiles,
  handleTrendingProfiles,
} from './data';
export {
  handleSetPrimary,
  handleSyncProfile,
  handleSyncStatus,
  handleUpdateProfile,
} from './sync';
export * from './types';
