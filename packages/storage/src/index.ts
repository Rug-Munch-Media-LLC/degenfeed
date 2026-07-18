// ─── @degenfeed/storage — barrel exports ──────────────────────────

// StoredIdentity moved to @degenfeed/types to break circular dep between auth and storage
export type { StoredIdentity } from '@degenfeed/types';
export {
  addBlockedUser,
  getBlockedUsers,
  isBlocked,
  removeBlockedUser,
  syncBlockedFromServer,
} from './blocked';
export type { StoredBookmark } from './bookmarks';
export {
  addBookmark,
  checkServerBookmark,
  fetchServerBookmarks,
  getBookmarks,
  isBookmarked,
  removeBookmark,
  removeBookmarkFromServer,
  syncAllBookmarks,
  syncBookmarkToServer,
  updateBookmarkTags,
} from './bookmarks';
export { cachePost, clearCache, getCachedPost } from './cache';
export { getDb } from './db';
export { deleteDraft, getDrafts, saveDraft } from './drafts';
export { deleteFollow, getFollows, isFollowing, saveFollow } from './follows';
export {
  deleteIdentity,
  getAllIdentities,
  getIdentity,
  getPrimaryIdentity,
  saveIdentity,
  saveWalletIdentity,
  setPrimaryIdentity,
} from './identities';
export {
  addMutedWord,
  blockCommunity,
  getBlockedCommunities,
  getMuteConfig,
  getMutedCommunities,
  isCommunityBlocked,
  isCommunityMuted,
  muteCommunity,
  muteUser,
  removeMutedWord,
  unblockCommunity,
  unmuteCommunity,
  unmuteUser,
} from './moderation';
export {
  getDefaultMonetizationPreferences,
  getMonetizationPreferences,
  saveMonetizationPreferences,
} from './monetization';
export {
  getMutedIdentities,
  getMutedWords,
  muteIdentity,
  unmuteIdentity,
} from './muting';
export { getDefaultPreferences, getPreferences, savePreferences } from './preferences';
export type { ActiveSession } from './session';
export {
  clearActiveSession,
  clearAllSessions,
  getActiveSession,
  setActiveSession,
} from './session';
export {
  getSubscription,
  isCreator,
} from './subscription';
export type {
  FeedLayout,
  LayoutDensity,
  MonetizationPreferences,
  StoredBlockedCommunity,
  StoredBlockedUser,
  StoredCachedPost,
  StoredDraft,
  StoredFollow,
  StoredMutedCommunity,
  StoredMutedIdentity,
  StoredMutedWord,
  SubscriptionRecord,
  SubscriptionTier,
  UserPreferences,
} from './types';
