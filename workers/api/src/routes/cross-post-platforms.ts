/**
 * @degenfeed/api-worker — Cross-Post Platform Handlers
 *
 * Platform-specific publishing functions for centralized platforms:
 * Medium, Substack, YouTube, TikTok, Instagram, LinkedIn, Reddit, Pinterest.
 */

import type { Env } from '../types';
import type { CrossPostInput, CrossPostResult } from './cross-post-types';

// ═══════════════════════════════════════════════════════════════════════════
// MEDIUM
// ═══════════════════════════════════════════════════════════════════════════

export async function publishToMedium(
  input: CrossPostInput,
  account: { accessToken: string; platformUserId: string; label: string },
): Promise<CrossPostResult> {
