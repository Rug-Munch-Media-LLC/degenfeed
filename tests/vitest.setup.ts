/**
 * @degenfeed/web — Global Vitest Setup
 *
 * Provides global mocks, polyfills, and cleanup for all tests.
 * Imported via vitest.config.ts setupFiles.
 */

import { afterEach, vi } from 'vitest';

// Clean up between tests
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  localStorage.clear();
});
