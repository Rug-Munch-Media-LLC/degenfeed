/**
 * News Routes Handler
 *
 * Provides handler functions for all /api/news/* and /api/feed/news endpoints.
 * Delegates to the news aggregation pipeline (feed/news-aggregator.ts)
 * for RSS feed fetching, deduplication, scoring, and clustering.
 */

import type { Env } from '../../types';
import type {
