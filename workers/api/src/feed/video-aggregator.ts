/**
 * @degenfeed/api-worker — VideoAggregator
 *
 * Intelligent cross-platform video aggregator.
 * "Follow creators, not platforms" — pull video content from ALL sources
 * based on creator subscriptions and category preferences.
 *
 * Merges, deduplicates, ranks, and paginates videos from:
 *   - YouTube (via Invidious/Piped/RSS)
 *   - Twitch (via ivr.fi API)
 *   - Rumble (via RSS/channel scraping)
 *   - PeerTube (via video.degenfeed.xyz + federated instances)
 *   - TikTok (via oEmbed/RSS)
 *   - Instagram (via oEmbed)
 *   - Odysee (via lbry.tv API)
 *   - Zora (via Zora API)
 *
 * KV cache prefix: video:agg:* (5min TTL)
 */

import type { VideoPlatform } from '../lib/creator-resolver';
import { VIDEO_PLATFORM_COLORS, VIDEO_PLATFORM_LABELS } from '../lib/creator-resolver';
import type { Env } from '../types';

// ─── Video bridge imports ─────────────────────────────────────────────────

import { fetchZoraTrendingVideos } from '../lib/zora-deep';
import {
import { fetchBlueskyVideoFeed } from './video-bridges/bluesky-video';
import {
import { fetchDTubeChannelVideos, fetchDTubeTrending, searchDTube } from './video-bridges/dtube';

import { fetchArweaveTrending, fetchIPFSTrending } from './video-bridges/ipfs-arweave-video';
import { fetchLensTrendingVideos } from './video-bridges/lens-video';
import { fetchNip71Videos } from './video-bridges/nip71-video';
import {
import {
import { fetchTwitchTrending, searchTwitch } from './video-bridges/twitch';
import { fetchVimeoChannelVideos, fetchVimeoTrending, searchVimeo } from './video-bridges/vimeo';

// ─── Invidious/Piped instances for YouTube (no API key needed) ──────────────

const INVIDIOUS_INSTANCES = [
  'https://inv.nadeko.net',
  'https://invidious.fdn.fr',
  'https://invidious.privacydev.net',
  'https://yewtu.be',
];

const PEERTUBE_INSTANCE = 'https://video.degenfeed.xyz';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface UnifiedVideo {

export interface VideoAggregatorOptions {

export interface AggregatedFeed {

// ─── Cache helpers ─────────────────────────────────────────────────────────

const CACHE_PREFIX = 'video:agg:';
const CACHE_TTL = 300; // 5 minutes

function cacheKey(suffix: string): string {

async function getCachedJson<T>(env: Env, key: string): Promise<T | null> {

async function setCachedJson(env: Env, key: string, data: unknown): Promise<void> {

// ─── VideoAggregator ───────────────────────────────────────────────────────

export class VideoAggregator {

