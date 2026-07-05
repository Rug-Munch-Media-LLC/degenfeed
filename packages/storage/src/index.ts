// ─── @degenfeed/storage — barrel exports ──────────────────────────
export type { StoredIdentity, StoredFollow, StoredDraft, StoredCachedPost, StoredMutedIdentity, StoredMutedWord, UserPreferences } from './types';
export type { ActiveSession } from './session';
export { setActiveSession, getActiveSession, clearActiveSession, clearAllSessions } from './session';
export { getDb } from './db';
export { saveIdentity, getIdentity, getAllIdentities, getIdentitiesByProtocol, getPrimaryIdentity, setPrimaryIdentity, deleteIdentity } from './identities';
export { saveFollow, deleteFollow, getFollows, isFollowing } from './follows';
export { saveDraft, deleteDraft, getDrafts } from './drafts';
export { cachePost, getCachedPost, clearCache } from './cache';
export { muteIdentity, unmuteIdentity, getMutedIdentities, muteWord, unmuteWord, getMutedWords } from './muting';
export { getPreferences, savePreferences, getDefaultPreferences } from './preferences';
