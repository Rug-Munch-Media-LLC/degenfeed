/**
 * @degenfeed/web — Feed filter state management hook
 *
 * Extracted from feed/page.tsx to manage the 30+ filter state variables.
 * Handles loading/saving preferences to the API.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { loadPreferences, savePreferences } from '../../services/feed';
import type { FeedTab } from '../../types/api';

export interface FeedFilterState {
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
  loadedLimit: number;
}

const DEFAULT_FILTERS: FeedFilterState = {
  hideLowQuality: false,
  hideThreshold: 1.0,
  allowNonCrypto: false,
  recencyWeight: 1.0,
  engagementWeight: 1.0,
  showOriginalContent: false,
  minEngagement: 0,
  maxPerNiche: 5,
  protocolFilter: null,
  freshnessPreference: 50,
  creatorDiversity: 5,
  exploreRatio: 30,
  algorithmTransparent: false,
  loadedLimit: 50,
};

export interface UseFeedFiltersResult {
  filters: FeedFilterState;
  activeTab: FeedTab;
  prefsLoaded: boolean;
  setActiveTab: (tab: FeedTab) => void;
  updateFilter: <K extends keyof FeedFilterState>(key: K, value: FeedFilterState[K]) => void;
  resetFilters: () => void;
  saveFilterState: () => Promise<void>;
}

/**
 * Manages feed filter state with remote preference persistence.
 * Consolidates ~30 useState calls into a single state object.
 */
export function useFeedFilters(): UseFeedFiltersResult {
  const [filters, setFilters] = useState<FeedFilterState>(DEFAULT_FILTERS);
  const [activeTab, setActiveTab] = useState<FeedTab>('for-you');
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  // Load preferences on mount
  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const prefs = await loadPreferences();
        if (!mounted) return;
        if (prefs.success && prefs.data) {
          setFilters((prev) => ({
            ...prev,
            ...prefs.data,
          }));
        }
      } catch {
        // Silently use defaults
      } finally {
        if (mounted) setPrefsLoaded(true);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const updateFilter = useCallback(
    <K extends keyof FeedFilterState>(key: K, value: FeedFilterState[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const saveFilterState = useCallback(async () => {
    await savePreferences(filters);
  }, [filters]);

  return {
    filters,
    activeTab,
    prefsLoaded,
    setActiveTab,
    updateFilter,
    resetFilters,
    saveFilterState,
  };
}
