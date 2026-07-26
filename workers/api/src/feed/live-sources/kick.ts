/**
 * @degenfeed/api-worker — Kick Live Source
 *
 * Fetches live streams from Kick.com and converts to UnifiedLiveStream format.
 * Uses Kick's public API to discover live channels and check curated streamers.
 *
 * Features:
 *   - Curated Kick streamers (crypto, gambling-adjacent, IRL niches)
 *   - Live status detection via discover/live endpoint
 *   - Viewer count from livestream metadata
 *   - Fallback to channel-by-channel check for curated list
 *
 * Rules:
 *   - No silent failures
 *   - Rate limit graceful handling
 *   - Response validation before conversion
 */

import type { Env } from '../../types';
import type { LiveSource, UnifiedLiveStream } from '../live-aggregator';

// ─── Curated Kick Channels ──────────────────────────────────────────────

export const CURATED_KICK_CHANNELS: KickCuratedChannel[] = [
  // ═══ Crypto / Trading ═══
  { slug: 'trainwreckstv', category: 'trading', tags: ['crypto', 'gambling', 'talk'] },
  { slug: 'xposed', category: 'trading', tags: ['crypto', 'gambling', 'casino'] },
  { slug: 'roshtein', category: 'trading', tags: ['crypto', 'casino', 'slots'] },
  { slug: 'classybeef', category: 'talk', tags: ['talk', 'gambling', 'community'] },
  { slug: 'itsbrian', category: 'talk', tags: ['talk', 'gambling', 'streamer'] },
  { slug: 'nickmullen', category: 'talk', tags: ['talk', 'comedy', 'commentary'] },
  { slug: 'adinross', category: 'irl', tags: ['irl', 'streamer', 'entertainment'] },
  { slug: 'iceposeidon', category: 'irl', tags: ['irl', 'streamer', 'community'] },

  // ═══ Gaming ═══
  { slug: 'forsen', category: 'gaming', tags: ['gaming', 'variety', 'reactions'] },
  { slug: 'cyr', category: 'gaming', tags: ['gaming', 'fps', 'valorant'] },
  { slug: 'summit1g', category: 'gaming', tags: ['gaming', 'variety', 'fps'] },
  { slug: 'lacari', category: 'gaming', tags: ['gaming', 'variety', 'irl'] },
  { slug: 'dansgaming', category: 'gaming', tags: ['gaming', 'variety', 'rpg'] },

  // ═══ IRL / Music ═══
  { slug: 'jakenbake', category: 'irl', tags: ['irl', 'lifestyle', 'travel'] },
  { slug: 'itskaypearl', category: 'irl', tags: ['irl', 'lifestyle', 'art'] },
  { slug: 'nmp', category: 'talk', tags: ['talk', 'news', 'commentary'] },
  { slug: 'j1mmy', category: 'talk', tags: ['talk', 'gaming', 'commentary'] },

  // ═══ Crypto / Degen ═══
  { slug: 'daisythedog', category: 'crypto', tags: ['crypto', 'defi', 'trading'] },
  { slug: 'ajcatchemall', category: 'crypto', tags: ['crypto', 'trading', 'analysis'] },
];

interface KickCuratedChannel {

// ─── Kick API Types ─────────────────────────────────────────────────────

interface KickLivestream {

interface KickChannelResponse {

interface KickDiscoverResponse {

const KICK_API_BASE = 'https://kick.com/api/v2';
const _KICK_SOURCES: LiveSource = 'kick';

// ─── Source Health Tracking ─────────────────────────────────────────────

async function trackKickHealth(
  env: Env,
  streamCount: number,
  latencyMs: number,
  error?: string,
): Promise<void> {

// ─── Category Map ───────────────────────────────────────────────────────

const KICK_CATEGORY_MAP: Record<string, string> = {

function mapKickCategory(categoryName: string | undefined, fallback: string): string {

// ─── Discover Live Streams ──────────────────────────────────────────────

/**
 * Fetch currently live streams from Kick's discover/live endpoint.
 * This returns the top live streams on the platform.
 */
async function fetchKickDiscoverLive(
  _env: Env,
  page: number = 1,
  perPage: number = 25,
): Promise<KickDiscoverResponse['data']> {

// ─── Check Single Channel ───────────────────────────────────────────────

/**
 * Fetch a single Kick channel and check if it's live.
 */
async function checkKickChannel(slug: string): Promise<{

// ─── Convert to UnifiedLiveStream ───────────────────────────────────────

function convertKickToUnified(
  livestream: KickLivestream,
  user: { id: number; username: string; slug: string; profile_pic?: string },
  curatedInfo?: KickCuratedChannel,
): UnifiedLiveStream {

// ─── Main Fetcher ───────────────────────────────────────────────────────

/**
 * Fetch live Kick streams.
 * Combines curated channel checks + discover/live feed for variety.
 */
export async function fetchKickLiveStreams(env: Env): Promise<UnifiedLiveStream[]> {

/**
 * Check if a specific Kick channel is live.
 * Used for on-demand status checks.
 */
export async function isKickChannelLive(
  slug: string,
): Promise<{ isLive: boolean; stream?: UnifiedLiveStream }> {

