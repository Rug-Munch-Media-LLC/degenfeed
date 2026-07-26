/**
 * @degenfeed/api-worker — Unified Profile Types
 */

import type { AggregatedProfile } from '../../lib/profile-sync';

export interface ProfileSearchResult {
  wallet?: string;
  protocol: string;
  id: string;
  handle: string;
  displayName: string;
  avatar?: string;
  bio?: string;
  followerCount?: number;
  followingCount?: number;
  verified: boolean;
  verificationLevel?: string;
}

export type { AggregatedProfile };
