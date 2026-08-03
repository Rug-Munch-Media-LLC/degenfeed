/**
 * @degenfeed/web — registrationPrompt logic tests
 *
 * Pure-function coverage for the anonymous-browsing registration nudge:
 * page-view counting, banner/modal thresholds, and dismiss persistence.
 * No JSX — runs in any vitest environment.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  BANNER_DISMISSED_KEY,
  BANNER_THRESHOLD,
  MODAL_SEEN_KEY,
  MODAL_THRESHOLD,
  PAGE_VIEW_KEY,
  decidePromptSurface,
  dismissBanner,
  incrementPageView,
  markModalSeen,
  readFlags,
  readPageViewCount,
} from './registrationPrompt';

const emptyFlags = { bannerDismissed: false, modalSeen: false };

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
});

describe('registrationPrompt page-view counter', () => {
  it('starts at zero', () => {
    expect(readPageViewCount()).toBe(0);
  });

  it('increments and persists across calls', () => {
    expect(incrementPageView()).toBe(1);
    expect(incrementPageView()).toBe(2);
    expect(readPageViewCount()).toBe(2);
    expect(window.localStorage.getItem(PAGE_VIEW_KEY)).toBe('2');
  });

  it('recovers a stored count', () => {
    window.localStorage.setItem(PAGE_VIEW_KEY, '7');
    expect(readPageViewCount()).toBe(7);
  });

  it('ignores invalid stored counts', () => {
    window.localStorage.setItem(PAGE_VIEW_KEY, 'nope');
    expect(readPageViewCount()).toBe(0);
  });
});

describe('decidePromptSurface thresholds', () => {
  it('shows nothing before the banner threshold', () => {
    expect(decidePromptSurface(1, emptyFlags)).toBe('none');
    expect(decidePromptSurface(BANNER_THRESHOLD - 1, emptyFlags)).toBe('none');
  });

  it('shows the banner at the banner threshold', () => {
    expect(decidePromptSurface(BANNER_THRESHOLD, emptyFlags)).toBe('banner');
  });

  it('still shows the banner between thresholds', () => {
    expect(decidePromptSurface(7, emptyFlags)).toBe('banner');
  });

  it('shows the modal at the modal threshold', () => {
    expect(decidePromptSurface(MODAL_THRESHOLD, emptyFlags)).toBe('modal');
    expect(decidePromptSurface(MODAL_THRESHOLD + 3, emptyFlags)).toBe('modal');
  });

  it('prefers the modal over the banner once both are due', () => {
    expect(decidePromptSurface(12, { ...emptyFlags, bannerDismissed: false })).toBe('modal');
  });
});

describe('registrationPrompt persistence', () => {
  it('dismissing the banner is remembered', () => {
    dismissBanner();
    expect(readFlags().bannerDismissed).toBe(true);
    expect(window.localStorage.getItem(BANNER_DISMISSED_KEY)).toBe('1');
    expect(decidePromptSurface(BANNER_THRESHOLD, readFlags())).toBe('none');
  });

  it('marking the modal seen suppresses future surfaces', () => {
    markModalSeen();
    expect(readFlags().modalSeen).toBe(true);
    expect(window.localStorage.getItem(MODAL_SEEN_KEY)).toBe('1');
    expect(decidePromptSurface(50, readFlags())).toBe('none');
  });
});
