// ─── @degenfeed/storage — barrel exports ──────────────────────────

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
export { closeDb, getDb } from './db';
export { deleteDraft, getDrafts, saveDraft } from './drafts';
export { deleteFollow, getFollows, isFollowing, saveFollow } from './follows';
export {
  deleteIdentity,
  getAllIdentities,
  getIdentitiesByProtocol,
  getIdentity,
  getPrimaryIdentity,
  saveIdentity,
  saveWalletIdentity,
  setPrimaryIdentity,
} from './identities';
export {
  getDefaultMonetizationPreferences,
  getMonetizationPreferences,
  saveMonetizationPreferences,
} from './monetization';
export {
  getMutedIdentities,
  getMutedWords,
  muteIdentity,
  muteWord,
  unmuteIdentity,
  unmuteWord,
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
  buildSubscriptionRecord,
  getSubscription,
  getTier,
  isCreator,
  isPremium,
  isSubscriptionActive,
  saveSubscription,
} from './subscription';
export type {
  MonetizationPreferences,
  StoredBlockedUser,
  StoredCachedPost,
  StoredDraft,
  StoredFollow,
  StoredIdentity,
  StoredMutedIdentity,
  StoredMutedWord,
  SubscriptionRecord,
  SubscriptionTier,
  UserPreferences,
} from './types';
