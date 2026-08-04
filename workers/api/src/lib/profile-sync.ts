/**
 * @degenfeed/api-worker — Profile Sync
 *
 * Split into module at ./profile-sync/ for maintainability.
 * @see ./profile-sync/index.ts
 */

export {
  SUPPORTED_SYNC_PROTOCOLS,
  aggregateProfile,
  getSyncStatus,
  pushProfile,
  setPrimaryOverride,
  syncProfile,
} from './profile-sync/index';
export type { PrimaryFieldOverride, ProtocolProfile } from './profile-sync/types';
