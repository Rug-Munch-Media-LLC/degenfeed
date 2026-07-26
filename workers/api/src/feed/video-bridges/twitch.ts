/**
 * @degenfeed/api-worker — Twitch Video Bridge
 *
 * Fetches video content from Twitch.
 * Sources:
 *   - ivr.fi API (public Twitch data, no OAuth needed)
 *   - Twitch embed endpoints for live status
 *
 * "Follow creators, not platforms" — every video gets a platform badge.
 */

import type { VideoPlatform } from '../../lib/creator-resolver';
import type { UnifiedVideo } from '../video-aggregator';

const PLATFORM: VideoPlatform = 'twitch';
const PLATFORM_LABEL = 'Twitch';
const PLATFORM_COLOR = '#9146FF';

const IVR_API = 'https://api.ivr.fi';

// ─── Fetch channel live status ─────────────────────────────────────────────

export async function fetchTwitchChannelVideos(
  channelName: string,
  _limit: number = 10,
): Promise<UnifiedVideo[]> {

// ─── Fetch trending (Twitch directory) ─────────────────────────────────────

export async function fetchTwitchTrending(
  _category: string = '',
  _limit: number = 20,
): Promise<UnifiedVideo[]> {

// ─── Search Twitch channels ────────────────────────────────────────────────

export async function searchTwitch(query: string, limit: number = 10): Promise<UnifiedVideo[]> {

// ─── Helpers ───────────────────────────────────────────────────────────────

function inferCategory(title: string, description: string): string {

