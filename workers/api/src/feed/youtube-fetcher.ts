/**
 * @degenfeed/api-worker — YouTubeFetcher
 *
 * Fetches YouTube content algorithmically based on user interests,
 * channel subscriptions, and trending signals. Enriches videos with
 * DegenFeed metadata for cross-platform actions (tip, share, save).
 *
 * Sources (in priority order):
 *   1. Invidious / Piped API (open-source, no API key, auto failover)
 *   2. YouTube RSS feeds (curated crypto channels via @degenfeed/youtube-provider)
 *   3. YouTube Data API v3 (when API key configured)
 *   4. YouTube oEmbed for single-video metadata
 *
 * KV cache prefix: youtube:feed:*
 * Cache TTL: 15 minutes (900s)
 */

import type { YouTubeVideoItem } from '@degenfeed/youtube-provider';
import { fetchYouTubeFeed } from '@degenfeed/youtube-provider';
import type { Env } from '../types';

// ─── Invidious / Piped instances (open-source, no API key) ────────────────

const INVIDIOUS_INSTANCES = [
  'https://inv.nadeko.net',
  'https://invidious.fdn.fr',
  'https://invidious.privacydev.net',
  'https://yewtu.be',
];

// ─── Types ───────────────────────────────────────────────────────────────

export type YouTubeCategory =
  | 'gaming'
  | 'music'
  | 'crypto'
  | 'tech'
  | 'education'
  | 'entertainment'
  | 'sports'
  | 'news'
  | 'science'
  | 'comedy'
  | 'all';

export type ShortsCategory = 'trending' | 'crypto' | 'gaming' | 'music' | 'comedy' | 'education';

/**
 * Normalized YouTube video for our feed.
 * All videos from this fetcher produce items conforming to this shape.
 */
export interface YouTubeVideo {

/**
 * After enrichment with DegenFeed metadata — creator coin, tip address,
 * cross-platform profile link, and explicit source labeling.
 */
export interface EnrichedYouTubeVideo extends YouTubeVideo {

export interface UserVideoPreferences {

// ─── Cache helpers ───────────────────────────────────────────────────────

const CACHE_PREFIX = 'youtube:feed:';
const CACHE_TTL = 900; // 15 minutes

function cacheKey(suffix: string): string {

async function getCachedJson<T>(env: Env, key: string): Promise<T | null> {

async function setCachedJson(env: Env, key: string, data: unknown): Promise<void> {

// ─── YouTube Data API (optional, for enhanced metadata) ──────────────────

/**
 * Fetch video details from YouTube Data API v3.
 * Falls back gracefully if no API key is configured.
 */
async function fetchVideoDetails(
  videoIds: string[],
  apiKey?: string,
): Promise<Map<string, { viewCount: number; likeCount: number }>> {

// ─── Category mapping ────────────────────────────────────────────────────

const CATEGORY_MAP: Record<string, YouTubeCategory> = {

const TAGS_FROM_NICHES: Record<string, string[]> = {

function inferCategory(item: YouTubeVideoItem): YouTubeCategory {

function inferTags(item: YouTubeVideoItem): string[] {

function inferShortness(title: string, duration?: string): boolean {

function durationToLabel(duration?: string): string {

// ─── YouTubeFetcher ──────────────────────────────────────────────────────

export class YouTubeFetcher {

/**
 * Short-form video type for the YouTube Shorts feed.
 */
export interface YouTubeShort {

// ─── Default user profile for unauthenticated recommendations ────────────

export const DEFAULT_USER_PREFERENCES: UserVideoPreferences = {

