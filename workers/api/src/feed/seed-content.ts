/**
 * Seed / Demo Content — REMOVED
 *
 * Demo/seed content generation has been killed. We NEVER serve fake
 * content under any circumstances. This module exists only to log a
 * warning in the (now impossible) case something still requests
 * seed content, and always returns an empty result.
 */

import type { UnifiedPost } from '@degenfeed/types';

/**
 * Deprecated — always returns an empty post list and logs a warning.
 * Demo/seed content was removed 2026-08-06; providers must return real
 * content or nothing.
 */
export function getSeedContent(_limit: number, _protocol?: string): UnifiedPost[] {
  console.warn('[seed-content] getSeedContent is deprecated — demo/seed content is banned. Returning empty.');
  return [];
}

/**
 * Check if the given posts list is effectively empty.
 */
export function isEffectivelyEmpty(posts: UnifiedPost[]): boolean {
  return posts.length === 0;
}
