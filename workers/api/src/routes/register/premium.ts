/**
 * @degenfeed/api-worker — Premium Publishing Route Registration
 *
 * Registers all premium publishing routes on the Hono app:
 * - Cross-platform composer (Buffer-style)
 * - Schedule queue management
 * - Content calendar
 * - AI-optimized scheduling
 * - Comprehensive post analytics dashboard
 * - Content recycling & evergreen
 *
 * @see /srv/work/repos/degenfeed-web/workers/api/src/routes/premium-publish/
 * @see /srv/work/repos/degenfeed-web/workers/api/src/routes/post-analytics.ts
 */

import type { Hono } from 'hono';
import { serverError } from '../../response-helpers';
import type { Env } from '../../types';
// Post-analytics dashboard (comprehensive analytics from all sources)
import {
