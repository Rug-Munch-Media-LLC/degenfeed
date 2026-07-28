// Re-export from the actual implementation in accounts-profile-sync
// Fixes: unified-profile routes were importing from empty barrel export
export {
  aggregateProfile,
  syncProfile,
  pushProfile,
  getSyncStatus,
  setPrimaryOverride,
  SUPPORTED_SYNC_PROTOCOLS,
} from '../../routes/accounts-profile-sync';
