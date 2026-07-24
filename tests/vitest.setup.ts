/**
 * @degenfeed/web — Global Vitest Setup
 *
 * Provides global mocks, polyfills, and cleanup for all tests.
 * Imported via vitest.config.ts setupFiles.
 */

import { afterEach, vi } from 'vitest';

// Polyfill localStorage for node environment (used by some providers)
if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as Record<string, unknown>).localStorage = {
    _data: {} as Record<string, string>,
    getItem(key: string) { return this._data[key] ?? null; },
    setItem(key: string, value: string) { this._data[key] = String(value); },
    removeItem(key: string) { delete this._data[key]; },
    clear() { this._data = {}; },
    get length() { return Object.keys(this._data).length; },
    key(index: number) { return Object.keys(this._data)[index] ?? null; },
  };
}

// Clean up between tests
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  if (typeof localStorage !== 'undefined') {
    localStorage.clear();
  }
});
