/**
 * Seed / Demo Content — REMOVED
 *
 * Demo/seed content generation has been killed. We NEVER serve fake
 * content under any circumstances. This module exists only to preserve
 * the import surface for legacy callers; it always returns an empty
 * result and logs a warning.
 */

import type { UnifiedPost } from './types';

/**
 * Deprecated — always returns an empty post list and logs a warning.
 * Demo/seed content was removed 2026-08-06; providers must return real
 * content or nothing.
 */
export function getSeedContent(_limit: number, _protocol?: string): UnifiedPost[] {
  console.warn(
    '[seed-content] getSeedContent is deprecated — demo/seed content is banned. Returning empty.',
  );
  return [];
}
