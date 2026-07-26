/**
 * feed-category routes — Category-based feed delivery, mix blending,
 * per-protocol category, and the "Everything" blend.
 *
 * Routes:
 *   GET /api/feed/category/[slug]
 *   GET /api/feed/mix
 *   GET /api/feed/per-protocol/[protocol]/[category]
 *   GET /api/feed/everything
 */

import type { Protocol } from '@degenfeed/types';
import { parseProtocols } from '@degenfeed/utils';
import {
