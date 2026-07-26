/**
 * @degenfeed/api-worker — Odysee Video Bridge
 *
 * Fetches video content from Odysee (LBRY protocol).
 * Sources:
 *   - LBRY claim_search API: https://api.lbry.com/claim_search
 *   - Odysee trending API: https://odysee.com/$/api/trending
 *
 * "Follow creators, not platforms" — every video gets a platform badge.
 */

import type { VideoPlatform } from '../../lib/creator-resolver';
import type { UnifiedVideo } from '../video-aggregator';

const ODYSEE_API = 'https://api.lbry.com';
const ODYSEE_WEB = 'https://odysee.com';

const PLATFORM: VideoPlatform = 'odysee';
const PLATFORM_LABEL = 'Odysee';
const PLATFORM_COLOR = '#FF6A00';

// ─── Fetch channel videos ──────────────────────────────────────────────────

export async function fetchOdyseeChannelVideos(
  channelName: string,
  limit: number = 10,
): Promise<UnifiedVideo[]> {

// ─── Fetch trending ────────────────────────────────────────────────────────

export async function fetchOdyseeTrending(
  _category: string = '',
  limit: number = 20,
): Promise<UnifiedVideo[]> {

// ─── Search ────────────────────────────────────────────────────────────────

export async function searchOdysee(query: string, limit: number = 10): Promise<UnifiedVideo[]> {

// ─── Category inference (shared utility) ──────────────────────────────────

function inferCategory(title: string, description: string): string {

