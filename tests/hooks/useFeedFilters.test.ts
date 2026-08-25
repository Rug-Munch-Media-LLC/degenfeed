/**
 * @degenfeed/web — useFeedFilters Hook Tests
 *
 * Covers:
 * - Default filter state initialization
 * - updateFilter updates a single filter key
 * - resetFilters returns to defaults
 * - saveFilterState calls savePreferences
 * - Tab switching via setActiveTab
 * - prefsLoaded transitions after preference load
 */

// @vitest-environment happy-dom

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the feed service
vi.mock('../../apps/web/src/services/feed', () => ({
  loadPreferences: vi.fn(),
  savePreferences: vi.fn(),
}));

describe('useFeedFilters', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize with default filter values', async () => {
    const loadPreferences = vi.mocked(
      (await import('../../apps/web/src/services/feed')).loadPreferences,
    );
    loadPreferences.mockResolvedValue({ success: true, data: undefined });

    const { useFeedFilters } = await import('../../apps/web/src/hooks/feed/useFeedFilters');
    const { result } = renderHook(() => useFeedFilters());

    await waitFor(() => {
      expect(result.current.prefsLoaded).toBe(true);
    });

    expect(result.current.filters.hideLowQuality).toBe(false);
    expect(result.current.filters.hideThreshold).toBe(1.0);
    expect(result.current.filters.allowNonCrypto).toBe(false);
    expect(result.current.filters.showOriginalContent).toBe(false);
    expect(result.current.filters.minEngagement).toBe(0);
    expect(result.current.filters.maxPerNiche).toBe(5);
    expect(result.current.filters.protocolFilter).toBeNull();
    expect(result.current.filters.freshnessPreference).toBe(50);
    expect(result.current.filters.creatorDiversity).toBe(5);
    expect(result.current.filters.exploreRatio).toBe(30);
    expect(result.current.filters.loadedLimit).toBe(50);
  });

  it('should load preferences from API on mount', async () => {
    const loadPreferences = vi.mocked(
      (await import('../../apps/web/src/services/feed')).loadPreferences,
    );
    loadPreferences.mockResolvedValue({
      success: true,
      data: {
        hideLowQuality: true,
        hideThreshold: 2.0,
        allowNonCrypto: true,
        recencyWeight: 2.0,
        engagementWeight: 1.5,
        showOriginalContent: true,
        minEngagement: 5,
        maxPerNiche: 10,
        protocolFilter: 'nostr',
        freshnessPreference: 70,
        creatorDiversity: 3,
        exploreRatio: 50,
      },
    });

    const { useFeedFilters } = await import('../../apps/web/src/hooks/feed/useFeedFilters');
    const { result } = renderHook(() => useFeedFilters());

    await waitFor(() => {
      expect(result.current.prefsLoaded).toBe(true);
    });

    expect(result.current.filters.hideLowQuality).toBe(true);
    expect(result.current.filters.hideThreshold).toBe(2.0);
    expect(result.current.filters.minEngagement).toBe(5);
    expect(result.current.filters.protocolFilter).toBe('nostr');
  });

  it('should use defaults when loadPreferences fails', async () => {
    const loadPreferences = vi.mocked(
      (await import('../../apps/web/src/services/feed')).loadPreferences,
    );
    loadPreferences.mockRejectedValue(new Error('API error'));

    const { useFeedFilters } = await import('../../apps/web/src/hooks/feed/useFeedFilters');
    const { result } = renderHook(() => useFeedFilters());

    await waitFor(() => {
      expect(result.current.prefsLoaded).toBe(true);
    });

    // Should still have defaults
    expect(result.current.filters.hideLowQuality).toBe(false);
    expect(result.current.filters.recencyWeight).toBe(1.0);
  });

  it('should update a single filter key with updateFilter', async () => {
    const loadPreferences = vi.mocked(
      (await import('../../apps/web/src/services/feed')).loadPreferences,
    );
    loadPreferences.mockResolvedValue({ success: true, data: undefined });

    const { useFeedFilters } = await import('../../apps/web/src/hooks/feed/useFeedFilters');
    const { result } = renderHook(() => useFeedFilters());

    await waitFor(() => {
      expect(result.current.prefsLoaded).toBe(true);
    });

    act(() => {
      result.current.updateFilter('hideLowQuality', true);
    });

    expect(result.current.filters.hideLowQuality).toBe(true);
    // Other filters unchanged
    expect(result.current.filters.allowNonCrypto).toBe(false);
  });

  it('should reset all filters to defaults', async () => {
    const loadPreferences = vi.mocked(
      (await import('../../apps/web/src/services/feed')).loadPreferences,
    );
    loadPreferences.mockResolvedValue({
      success: true,
      data: { hideLowQuality: true, allowNonCrypto: true } as never,
    });

    const { useFeedFilters } = await import('../../apps/web/src/hooks/feed/useFeedFilters');
    const { result } = renderHook(() => useFeedFilters());

    await waitFor(() => {
      expect(result.current.prefsLoaded).toBe(true);
    });

    // Change some filters
    act(() => {
      result.current.updateFilter('hideLowQuality', true);
      result.current.updateFilter('loadedLimit', 100);
    });

    // Reset
    act(() => {
      result.current.resetFilters();
    });

    expect(result.current.filters.hideLowQuality).toBe(false);
    expect(result.current.filters.loadedLimit).toBe(50);
  });

  it('should save filter state via saveFilterState', async () => {
    const loadPreferences = vi.mocked(
      (await import('../../apps/web/src/services/feed')).loadPreferences,
    );
    loadPreferences.mockResolvedValue({ success: true, data: undefined });
    const savePreferences = vi.mocked(
      (await import('../../apps/web/src/services/feed')).savePreferences,
    );

    const { useFeedFilters } = await import('../../apps/web/src/hooks/feed/useFeedFilters');
    const { result } = renderHook(() => useFeedFilters());

    await waitFor(() => {
      expect(result.current.prefsLoaded).toBe(true);
    });

    await act(async () => {
      await result.current.saveFilterState();
    });

    expect(savePreferences).toHaveBeenCalledTimes(1);
    expect(savePreferences).toHaveBeenCalledWith(result.current.filters);
  });

  it('should switch active tab via setActiveTab', async () => {
    const loadPreferences = vi.mocked(
      (await import('../../apps/web/src/services/feed')).loadPreferences,
    );
    loadPreferences.mockResolvedValue({ success: true, data: undefined });

    const { useFeedFilters } = await import('../../apps/web/src/hooks/feed/useFeedFilters');
    const { result } = renderHook(() => useFeedFilters());

    expect(result.current.activeTab).toBe('for-you');

    act(() => {
      result.current.setActiveTab('following');
    });

    expect(result.current.activeTab).toBe('following');

    act(() => {
      result.current.setActiveTab('trending');
    });

    expect(result.current.activeTab).toBe('trending');
  });
});
