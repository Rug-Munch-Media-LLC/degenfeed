/**
 * @degenfeed/api-worker — Loops Live Source Fetcher
 *
 * Fetches active live streams from the Loops API and normalizes them
 * into UnifiedLiveStream format for the DegenFeed live aggregator.
 *
 * Every Loops live stream is vertical (9:16) TikTok-style.
 * Includes: HLS playback URL, viewer count, chat status, gift count, etc.
 *
 * Error handling: transient errors logged, never blocks aggregation,
 * source health tracked independently.
 */

import type { Env } from '../../types';
import type { LiveSource, UnifiedLiveStream } from '../live-aggregator';
import { trackSourceHealth } from '../live-aggregator';

interface LoopsLiveStreamData {

interface LoopsLiveApiResponse {

/**
 * DEFAULT_LOOPS_INSTANCE — our self-hosted Loops instance.
 * Override via env.LOOPS_INSTANCE_URL for staging/dev.
 */
const DEFAULT_LOOPS_INSTANCE = 'https://loops.video';

/**
 * Cache TTL for Loops live list (5 seconds — lives change fast).
 */
const CACHE_TTL = 5;

/**
 * KV key for cached Loops live streams.
 */
function loopsLiveCacheKey(): string {

/**
 * Fetch currently active Loops live streams from the Loops API.
 *
 * The Loops API returns TikTok-style vertical live streams.
 * We normalize them into the DegenFeed UnifiedLiveStream format.
 */
export async function fetchLoopsLiveStreams(env: Env): Promise<UnifiedLiveStream[]> {

/**
 * Get Loops live system health status.
 */
export async function getLoopsLiveHealth(env: Env): Promise<{

