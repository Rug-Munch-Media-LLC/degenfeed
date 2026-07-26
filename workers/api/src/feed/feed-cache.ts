/**
 * feed-cache — KV read/write abstraction for the feed pipeline.
 *
 * Owns cache key generation, the feed-level response cache
 * (stale-while-revalidate: fresh hits are served, stale entries are
 * refetched), per-provider result caching, the post KV store for O(1)
 * ID lookups, provider health caching, and per-user ranking context
 * (follows, mutes, preferences) loaded via the session cookie.
 */

import type { Protocol, UnifiedPost } from '@degenfeed/types';
import type { Env } from '../types';

export const CACHE_PROVIDER_TTL = 120;
export const FEED_CACHE_TTL = 45;
export const FEED_CACHE_FRESH_MS = 30_000;

// ─── Generic KV JSON helpers ───────────────────────────────────────

export async function readJsonCache<T>(env: Env, key: string, label: string): Promise<T | null> {

export async function writeJsonCache(
  env: Env,
  key: string,
  value: unknown,
  ttl: number,
  label: string,
): Promise<void> {

// ─── Feed-level response cache ─────────────────────────────────────
// Skips all provider fetches when a fresh result exists. Entries
// older than FEED_CACHE_FRESH_MS are treated as stale and refetched.

export interface CachedFeedResponse {

export function feedCacheKey(protocols: Protocol[], category: string, sort: string): string {

export async function getCachedFeed(env: Env, key: string): Promise<CachedFeedResponse | null> {

export async function setCachedFeed(
  env: Env,
  key: string,
  data: unknown,
  ttl = FEED_CACHE_TTL,
): Promise<void> {

/**
 * JSON response with edge cache headers (s-maxage +
 * stale-while-revalidate) and a weak length-based etag.
 */
export function cachedJsonResponse(data: unknown, status = 200, maxAge = 30): Response {

// ─── Per-provider KV cache (stale-while-revalidate) ────────────────
// Caches provider results in KV with CACHE_PROVIDER_TTL expiry.
// On cache hit the response is returned immediately and a background
// refresh is triggered so subsequent requests see fresh data.

export function providerCacheKey(protocol: string, limit: number): string {

export async function readProviderCache(
  env: Env,
  protocol: string,
  limit: number,
): Promise<UnifiedPost[] | null> {

export async function writeProviderCache(
  env: Env,
  protocol: string,
  limit: number,
  posts: UnifiedPost[],
): Promise<void> {

// ─── Post KV store ─────────────────────────────────────────────────
// After dedup, every post is written to KV for O(1) ID lookups.

export async function writePostsToKV(env: Env, posts: UnifiedPost[]): Promise<void> {

// ─── Provider health cache ─────────────────────────────────────────

export interface CachedHealth {

export async function readCachedHealth(env: Env, key: string): Promise<CachedHealth | null> {

export async function writeCachedHealth(env: Env, key: string, body: CachedHealth): Promise<void> {

// ─── Per-user ranking context ──────────────────────────────────────
// Loads followed authors, mutes, and stored algorithm preferences
// from KV via the session cookie. Unauthenticated users get an
// empty context.

import type { PresetName } from '@degenfeed/feed-core';

export interface StoredUserPreferences {

export interface UserRankingContext {

export async function loadUserRankingContext(
  request: Request,
  env: Env,
): Promise<UserRankingContext> {

