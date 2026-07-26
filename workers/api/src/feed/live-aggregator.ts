/**
 * @degenfeed/api-worker — Unified Live Stream Aggregator
 *
 * Aggregates live streams from all sources into a normalized format:
 *   self-hosted Owncast, PeerTube, YouTube Live, Twitch, DegenFeed Spaces.
 *
 * Every source gets: error handling, rate limit tracking, response validation, fallback.
 * No silent failures. No unhandled API changes.
 */

import { readStringArray, writeStringArray } from '../routes/live-shorts-engine';
import type { Env } from '../types';
import { broadcastToAll } from '../ws-broadcast';
import { CHANNELS } from '../ws-channels';
import { fetchKickLiveStreams } from './live-sources/kick';
import { fetchLoopsLiveStreams } from './live-sources/loops';
import { processLiveNotifications } from './live-sources/notifications';
import { fetchCuratedTwitchStreams } from './live-sources/twitch';

// ─── Normalized Unified Stream Type ─────────────────────────────────────

export interface UnifiedIdentity {

export type LiveSource =
  | 'owncast'
  | 'peertube'
  | 'youtube'
  | 'twitch'
  | 'kick'
  | 'spaces'
  | 'degenfeed'
  | 'farcaster'
  | 'nostr'
  | 'lens'
  | 'zora';

export interface UnifiedLiveStream {

export interface UpcomingStream {

// ─── Source Health ──────────────────────────────────────────────────────

export interface SourceHealth {

// ─── KV Key Helpers ─────────────────────────────────────────────────────

function liveCacheKey(): string {

function upcomingCacheKey(): string {

function sourceHealthKey(): string {

function viewerKey(streamId: string): string {

// ─── Cached Aggregation ─────────────────────────────────────────────────

async function getAggregatedCache(env: Env): Promise<UnifiedLiveStream[] | null> {

async function setAggregatedCache(env: Env, streams: UnifiedLiveStream[], ttl = 15): Promise<void> {

// ═══════════════════════════════════════════════════════════════════════
// 1. Owncast Aggregator
// ═══════════════════════════════════════════════════════════════════════

interface OwncastStream {

interface OwncastStatusResponse {

/**
 * Fetch active Owncast stream from self-hosted instance.
 * Docs: https://owncast.online/thirdparty/api/
 */
async function fetchOwncastStreams(env: Env): Promise<UnifiedLiveStream[]> {

// ═══════════════════════════════════════════════════════════════════════
// 2. PeerTube Live Aggregator
// ═══════════════════════════════════════════════════════════════════════

interface PeerTubeLiveVideo {

interface PeerTubeLiveResponse {

/**
 * Fetch active PeerTube live streams from self-hosted instance.
 * Uses PeerTube's search/filter API for live content.
 */
async function fetchPeerTubeStreams(env: Env): Promise<UnifiedLiveStream[]> {

// ═══════════════════════════════════════════════════════════════════════
// 3. YouTube Live Aggregator (via RSS / Public API)
// ═══════════════════════════════════════════════════════════════════════

interface YouTubeVideoEntry {

/**
 * Fetch YouTube Live streams via YouTube Data API v3.
 * Falls back to RSS feed parsing if API key is not configured.
 */
async function fetchYouTubeLiveStreams(env: Env): Promise<UnifiedLiveStream[]> {

/** Fallback: fetch YouTube via RSS for known curated channels */
async function fetchYouTubeViaRSS(env: Env, startTime: number): Promise<UnifiedLiveStream[]> {

/** Fallback: fetch YouTube from curated channel list */
async function fetchYouTubeCuratedChannels(
  env: Env,
  apiKey: string,
  startTime: number,
): Promise<UnifiedLiveStream[]> {

// ═══════════════════════════════════════════════════════════════════════
// 4. Twitch Aggregator (via RSS-Bridge or public API)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Fetch Twitch streams via RSS-Bridge or public endpoints.
 * Uses RSS-Bridge's Twitch bridge if available, otherwise falls back.
 */
async function fetchTwitchStreams(env: Env): Promise<UnifiedLiveStream[]> {

// ═══════════════════════════════════════════════════════════════════════
// 5. DegenFeed Spaces (Existing)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Convert DegenFeed Spaces records to UnifiedLiveStream format.
 * Reads from the existing spaces KV index.
 */
async function fetchDegenFeedSpaces(env: Env): Promise<UnifiedLiveStream[]> {

// ═══════════════════════════════════════════════════════════════════════
// 6. Farcaster Live Aggregator (via Farcaster Live Wrapper)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Fetch Farcaster live streams via the Farcaster Live Wrapper.
 * Monitors for FIP #268/FIP #269 live activity on Farcaster.
 */
async function fetchFarcasterLiveStreams(env: Env): Promise<UnifiedLiveStream[]> {

// ═══════════════════════════════════════════════════════════════════════
// 7. Nostr Live Aggregator (via video-platform-wrapper)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Fetch Nostr live streams via NIP-53 live event support.
 */
async function fetchNostrLiveStreams(env: Env): Promise<UnifiedLiveStream[]> {

// ═══════════════════════════════════════════════════════════════════════
// Source Health Tracking
// ═══════════════════════════════════════════════════════════════════════

export async function trackSourceHealth(
  env: Env,
  source: LiveSource,
  streamCount: number,
  latencyMs: number,
  error?: string,
): Promise<void> {

export async function getSourceHealth(env: Env): Promise<Record<string, SourceHealth>> {

// ═══════════════════════════════════════════════════════════════════════
// 6. Master Aggregator — Combine All Sources
// ═══════════════════════════════════════════════════════════════════════

/**
 * Fetch all live streams from every source in parallel.
 * Results are cached in KV for 15 seconds to prevent thundering.
 * Each source fetcher has independent error handling — one failing source
 * never blocks the others.
 */
export async function aggregateAllStreams(
  env: Env,
  forceRefresh = false,
): Promise<UnifiedLiveStream[]> {

/**
 * Fetch upcoming/scheduled streams from all sources.
 */
export async function aggregateUpcomingStreams(env: Env): Promise<UpcomingStream[]> {

// ═══════════════════════════════════════════════════════════════════════
// Real-Time Viewer Count (SSE-compatible)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Get a real-time viewer count for a specific stream.
 * Uses a 30-second cached counter to avoid hammering APIs.
 */
export async function getStreamViewerCount(env: Env, streamId: string): Promise<number> {

// ═══════════════════════════════════════════════════════════════════════
// Stream Schedule Management
// ═══════════════════════════════════════════════════════════════════════

export interface StreamSchedule {

function scheduleKey(id: string): string {

function creatorScheduleIndexKey(creatorId: string): string {

/**
 * Create a scheduled stream.
 */
export async function createSchedule(env: Env, schedule: StreamSchedule): Promise<StreamSchedule> {

/**
 * Get all scheduled streams for a creator.
 */
export async function getCreatorSchedules(env: Env, creatorId: string): Promise<StreamSchedule[]> {

// ═══════════════════════════════════════════════════════════════════════
// Go-Live / Stop-Live Operations (Owncast + PeerTube)
// ═══════════════════════════════════════════════════════════════════════

export interface GoLiveConfig {

export interface GoLiveResult {

/**
 * Start a live stream on the selected platform(s).
 * Generates stream keys and configures the backend.
 */
export async function startLiveStream(env: Env, config: GoLiveConfig): Promise<GoLiveResult> {

/**
 * Stop a live stream on the selected platform(s).
 */
export async function stopLiveStream(
  env: Env,
  streamId: string,
  platform: 'owncast' | 'peertube' | 'spaces',
): Promise<void> {

// ═══════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════

function resolvePeerTubeCategory(category: string): number {

/**
 * SSE-formatted viewer count stream data.
 */
export function formatViewerSSE(streamId: string, viewerCount: number): string {

/**
 * Generate a unique stream/schedule ID.
 */
export function generateLiveId(): string {

