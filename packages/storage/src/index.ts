// ─── @degenfeed/storage — barrel exports ──────────────────────────
export type {
  StoredIdentity,
  StoredFollow,
  StoredDraft,
  StoredCachedPost,
  StoredMutedIdentity,
  StoredMutedWord,
  UserPreferences,
  MonetizationPreferences,
} from './types';
export type { ActiveSession } from './session';
export type { StoredBookmark } from './bookmarks';
export {
  setActiveSession,
  getActiveSession,
  clearActiveSession,
  clearAllSessions,
} from './session';
export { getDb } from './db';
export {
  saveIdentity,
  saveWalletIdentity,
  getIdentity,
  getAllIdentities,
  getIdentitiesByProtocol,
  getPrimaryIdentity,
  setPrimaryIdentity,
  deleteIdentity,
} from './identities';
export { saveFollow, deleteFollow, getFollows, isFollowing } from './follows';
export { saveDraft, deleteDraft, getDrafts } from './drafts';
export { cachePost, getCachedPost, clearCache } from './cache';
export {
  muteIdentity,
  unmuteIdentity,
  getMutedIdentities,
  muteWord,
  unmuteWord,
  getMutedWords,
} from './muting';
export { addBookmark, removeBookmark, isBookmarked, getBookmarks } from './bookmarks';
export { getPreferences, savePreferences, getDefaultPreferences } from './preferences';
export {
  getMonetizationPreferences,
  saveMonetizationPreferences,
  getDefaultMonetizationPreferences,
} from './monetization';
