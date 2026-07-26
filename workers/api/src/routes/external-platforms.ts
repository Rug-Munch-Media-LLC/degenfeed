/**
 * @degenfeed/api-worker — External Platform Connectivity
 *
 * REST API for DegenFeed Connect: schedule and post to ALL social platforms
 * from one dashboard. Powered by Postiz for OAuth and API integration.
 *
 * Supports: YouTube, Twitch, Kick, TikTok, Instagram, LinkedIn
 * Gated to: Enterprise tier ($20/mo) or standalone add-on ($15/mo)
 *
 * Postiz handles:
 * - OAuth flows for all platforms
 * - Rate limiting per platform
 * - API differences between platforms
 * - Media upload optimization
 *
 * @see /srv/degenfeed/postiz/README.md
 * @see /srv/work/repos/degenfeed-web/workers/api/src/lib/postiz-bridge.ts
 */

import { checkFeatureAccess, getUserTier } from '../lib/membership-tiers';
import { jsonResponse } from '../response-helpers';
import type { Env } from '../types';
import {
