/**
 * @degenfeed/api-worker — Podcast Episode Aggregation Cron
 *
 * Runs daily to:
 *   1. Fetch latest episodes from all 100 curated podcast RSS feeds
 *   2. Deduplicate (same episode from multiple sources via GUID)
 *   3. Store new episodes in KV
 *   4. Refresh trending based on play count
 *   5. Update the latest episodes index
 *
 * Called from the main cron dispatcher at 14:00 UTC daily.
 * Can also be triggered via POST /api/podcast/curated/refresh (admin).
 */

import { ALL_CURATED_PODCASTS } from '../feed/podcast-curation';
import type { Env } from '../types';
import {
