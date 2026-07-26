/**
 * @degenfeed/api-worker — Postiz API Bridge
 *
 * Bridges DegenFeed's premium publishing system to Postiz (self-hosted
 * social media scheduler). Routes premium-tier schedules through Postiz
 * for unlimited cross-posting across all supported protocols.
 *
 * NOW WITH EXTERNAL PLATFORM SUPPORT:
 * YouTube, Twitch, Kick, TikTok, Instagram, LinkedIn.
 * Postiz handles OAuth, API complexity, and rate limiting for all external
 * platforms. DegenFeed provides the unified interface.
 *
 * Fallback: If Postiz is unreachable, gracefully falls back to DegenFeed's
 * native scheduler (executeCrossPublish in cross-publish-orchestrator.ts).
 *
 * Postiz runs at http://127.0.0.1:3105 (internal) /
 * https://schedule.degenfeed.xyz (external).
 *
 * @see /srv/degenfeed/postiz/README.md
 * @see /srv/degenfeed/postiz/platforms.json
 */

import type { MasterPost } from '@degenfeed/cross-protocol-bridge';
import type { Env } from '../types';

// ─── Constants ──────────────────────────────────────────────────────────────

const POSTIZ_BASE_URL = 'http://127.0.0.1:3105';
const POSTIZ_API_TIMEOUT = 10_000; // 10s
const POSTIZ_HEALTH_PATH = '/';

/** External platforms that DegenFeed Connect routes through Postiz */
export const EXTERNAL_PLATFORM_CATEGORIES = {
