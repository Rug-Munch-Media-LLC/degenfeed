/**
 * @degenfeed/api-worker — Cross-Platform Post Composer (Buffer-Style)
 *
 * Premium feature: one-composer, publish-to-all-protocols.
 * Accepts a single post with text + media + selected protocols.
 * Optionally schedules for later. Supports all 27+ protocols.
 *
 * Integration with the existing premium-publish queue infrastructure.
 *
 * @see ./queue.ts — queue management (schedule, list, update, delete)
 * @see ./optimize.ts — AI time optimization, evergreen, recurring
 * @see ./analytics.ts — per-post cross-protocol analytics
 */

import { jsonResponse } from '../../response-helpers';
import type { Env } from '../../types';
import {
