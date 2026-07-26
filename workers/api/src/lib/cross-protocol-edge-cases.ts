/**
 * @degenfeed/api-worker — Cross-Protocol Edge Case Handler
 *
 * Handles protocol-specific edge cases:
 *  - Character limits per protocol
 *  - Media compatibility checks
 *  - Encryption wrapping for non-E2E protocols
 *  - Protocol-specific formatting conversion
 *  - Long message auto-splitting
 *  - Fallback routing when primary protocol fails
 */

import type { Env } from '../types';

// ─── Protocol Configurations ──────────────────────────────────────────────

export const PROTOCOL_CONFIGS: Record<
  string,
  {
