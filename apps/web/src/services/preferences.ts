/**
 * @degenfeed/web — User preferences API service
 */

import { api } from './api';
import type { ApiResponse } from '../types/api';

export interface UserPreferences {
  hideLowQuality: boolean;
  hideThreshold: number;
  allowNonCrypto: boolean;
  recencyWeight: number;
  engagementWeight: number;
  showOriginalContent: boolean;
  minEngagement: number;
  maxPerNiche: number;
  protocolFilter: string | null;
  freshnessPreference: number;
  creatorDiversity: number;
  exploreRatio: number;
  algorithmTransparent: boolean;
  theme?: 'dark' | 'light' | 'system';
  fontSize?: 'sm' | 'md' | 'lg';
  layout?: 'compact' | 'comfortable' | 'reader';
}

export async function getUserPreferences(): Promise<ApiResponse<UserPreferences>> {
  return api.get<UserPreferences>('/api/preferences');
}

export async function updateUserPreferences(
  prefs: Partial<UserPreferences>,
): Promise<ApiResponse<void>> {
  return api.put<void>('/api/preferences', prefs);
}
