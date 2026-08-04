'use client';

/**
 * @degenfeed/web — useAlgorithmProfile
 *
 * React binding for the client-side engagement profile that powers
 * personalization + serendipity in the top-tier feed algorithm.
 * Persists to localStorage via algoProfile.ts (a server API can replace
 * the storage layer later without changing this hook's contract).
 */

import { useCallback, useRef, useState } from 'react';
import type { UnifiedPost } from '@degenfeed/types';
import {
  decayAlgoProfile,
  type AlgoEngagementAction,
  type AlgoProfile,
  EMPTY_ALGO_PROFILE,
  loadAlgoProfile,
  recordAlgoEngagement,
  saveAlgoProfile,
} from '../lib/algoProfile';

export interface UseAlgorithmProfileResult {
  /** Current engagement profile (empty until the user engages). */
  profile: AlgoProfile;
  /** Record an engagement with a post and persist the updated profile. */
  recordEngagement: (post: UnifiedPost, action: AlgoEngagementAction) => void;
  /** Replace the whole profile (e.g. "clear my algorithm memory"). */
  setProfile: (profile: AlgoProfile) => void;
  /** Reset the profile to empty. */
  clearProfile: () => void;
}

export function useAlgorithmProfile(): UseAlgorithmProfileResult {
  const [profile, setProfileState] = useState<AlgoProfile>(() => {
    if (typeof window === 'undefined') return EMPTY_ALGO_PROFILE;
    return decayAlgoProfile(loadAlgoProfile());
  });
  // Latest profile for the record callback without re-creating it constantly.
  const profileRef = useRef(profile);
  profileRef.current = profile;

  const persist = useCallback((next: AlgoProfile) => {
    profileRef.current = next;
    saveAlgoProfile(next);
    setProfileState(next);
  }, []);

  const recordEngagement = useCallback(
    (post: UnifiedPost, action: AlgoEngagementAction) => {
      const next = recordAlgoEngagement(profileRef.current, post, action);
      persist(decayAlgoProfile(next));
    },
    [persist],
  );

  const setProfile = useCallback(
    (next: AlgoProfile) => {
      persist(decayAlgoProfile(next));
    },
    [persist],
  );

  const clearProfile = useCallback(() => {
    persist(EMPTY_ALGO_PROFILE);
  }, [persist]);

  return { profile, recordEngagement, setProfile, clearProfile };
}
