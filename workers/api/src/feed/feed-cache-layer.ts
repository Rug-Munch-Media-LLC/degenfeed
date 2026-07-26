/**
 * feed-cache-layer — Advanced feed caching with stale-while-revalidate.
 *
 * Cache key scheme: feed:cache:{userId}:{feedType}
 *   - Anonymous users: feed:cache:anon:{feedType}
 *   - TTL: 60s for trending, 120s for home/for-you/everything
 *   - SWR: always return cache (even stale), refresh in background
 */

import type { Env } from '../types';
import { readJsonCache, writeJsonCache } from './feed-cache';

export type FeedType = 'home' | 'for-you' | 'trending' | 'everything' | 'curated';

const FEED_CACHE_TTLS: Record<FeedType, number> = {

const FEED_CACHE_FRESH_MS: Record<FeedType, number> = {

export function buildFeedCacheKey(userId: string | null, feedType: FeedType): string {

export interface CachedFeedEntry {

export interface CacheResult {

export async function getFeedCache(
  env: Env,
  userId: string | null,
  feedType: FeedType,
): Promise<CacheResult> {

export async function setFeedCache(
  env: Env,
  userId: string | null,
  feedType: FeedType,
  data: unknown,
  meta: Record<string, unknown>,
): Promise<void> {

export async function invalidateFeedCache(
  env: Env,
  userId: string | null,
  feedType?: FeedType,
): Promise<void> {

export function getCacheTTL(feedType: FeedType): number {

export function getCacheFreshMs(feedType: FeedType): number {

