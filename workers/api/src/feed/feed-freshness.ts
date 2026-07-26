/**
 * feed-freshness — Feed freshness tracking, stale content deprioritization,
 * and WebSocket notifications.
 *
 * Tracks when feeds were last updated, sends WS events on new content,
 * and provides "Updated Xs ago" and "X new posts" indicators.
 * Posts older than 7 days are deprioritized unless they have high engagement.
 */

import type { UnifiedPost } from '@degenfeed/types';
import type { Env } from '../types';
import { broadcastToAll, broadcastToUser } from '../ws-broadcast';
import { CHANNELS } from '../ws-channels';
import type { FeedType } from './feed-cache-layer';

const FRESHNESS_KEY_PREFIX = 'feed:freshness:';
const FEED_UPDATE_KEY_PREFIX = 'feed:updates:';
const FRESHNESS_TTL = 300; // 5 min

// Per-protocol high-engagement thresholds (likes + reposts*2 + replies*3)
// Scaled: 25 on Nostr is viral, 30 on Farcaster is moderate engagement
export const HIGH_ENGAGEMENT_BY_PROTOCOL: Record<string, number> = {
export const DEFAULT_HIGH_ENGAGEMENT = 20;

export function getHighEngagementThreshold(protocol?: string): number {

/**
 * Continuous staleness decay: 1 / (1 + log2(hours/24 + 1))
 * At 0h → 1.0, 24h → 0.5, 7d → 0.25, 30d → 0.17
 * No cliff — posts fade out gradually instead of dying at 7 days.
 */
export function computeDecayMultiplier(ageMs: number, now: number = Date.now()): number {

export interface StalePostResult {

export interface FeedFreshnessEntry {

export function freshnessKey(feedType: FeedType): string {

export function userUpdatesKey(userId: string): string {

export async function updateFeedFreshness(
  env: Env,
  feedType: FeedType,
  posts: Array<{ createdAt: number }>,
): Promise<FeedFreshnessEntry> {

export async function getFeedFreshness(
  env: Env,
  feedType: FeedType,
): Promise<FeedFreshnessEntry | null> {

export function computeFreshnessMeta(
  entry: FeedFreshnessEntry | null,
  now: number,
): {

export function computeNewPostsSince(
  lastVisit: number,
  posts: Array<{ createdAt: number }>,
): number {

export async function broadcastFeedUpdate(
  feedType: FeedType,
  data: { newPostCount: number; timestamp: number },
): Promise<void> {

export async function broadcastFreshContent(
  userId: string | null,
  post: { id: string; title?: string; protocol: string },
): Promise<void> {

// ─── Stale content deprioritization ──────────────────────────────

/**
 * Applies continuous decay to posts. Posts are sorted by a combined
 * score: engagement * decayMultiplier. High-engagement posts resist
 * decay (engagement measured per-protocol). No hard 7-day cutoff.
 */
export function deprioritizeStaleContent(
  posts: UnifiedPost[],
  now: number = Date.now(),
): UnifiedPost[] {

export function classifyStalePosts(
  posts: UnifiedPost[],
  now: number = Date.now(),
): StalePostResult[] {

