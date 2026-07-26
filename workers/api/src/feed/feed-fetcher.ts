/**
 * feed-fetcher — Provider dispatch + circuit breakers.
 *
 * Owns the provider registry (getProvider), the RSS/RMI fallback
 * wrapper, the KV-backed per-provider circuit breaker, and the
 * fan-out that fetches all requested protocols in parallel with
 * per-provider caching (stale-while-revalidate background refresh).
 *
 * 2026-07-18: Added per-provider timeouts, timeout-specific circuit
 * breaker (5-min break after 3 consecutive timeouts), per-provider
 * fetch timing, slow-provider KV logging, and overall fetch timeout.
 */

import {
import type { Protocol, UnifiedPost } from '@degenfeed/types';

import { rmiUrl } from '@degenfeed/utils';
import { log } from '../logger';
import type { Env } from '../types';
import { readProviderCache, writeProviderCache } from './feed-cache';
import { sanitizePosts } from './feed-enricher';

// ─── Feed quality monitoring (dynamic import to avoid circular deps) ───
const _qualityModule: typeof import('./feed-quality-monitor') | null = null;
async function recordFetchQuality(env: Env, protocol: string, count: number): Promise<void> {

/**
 * All 68+ supported protocols — the full canonical list used when
 * no explicit protocol filter is specified.
 */
export const ALL_PROTOCOLS: Protocol[] = [
  // ── Tier 1: Core Social ────────────────────────────────────
  'nostr',
  'farcaster',
  'lens',
  'bluesky',
  'mastodon',
  // ── Tier 2: Established ────────────────────────────────────
  'lemmy',
  'pixelfed',
  'peertube',
  'threads',
  'zora',
  'reddit',
  'rss',
  'mirror',
  'hive',
  'dtube',
  'lbry',
  'pleroma',
  'misskey',
  'writefreely',
  'funkwhale',
  'castopod',
  'subsocial',
  'steem',
  // ── Tier 3: Niche / ActivityPub ────────────────────────────
  'diaspora',
  'friendica',
  'mediagoblin',
  'bookwyrm',
  'mobilizon',
  'bonfire',
  'mitra',
  'takahe',
  'forgejo',
  'owncast',
  'minds',
  'scuttlebutt',
  'deso',
  'session',
  'cyberconnect',
  'arena',
  'microblog',
  // ── Tier 4: Experimental ──────────────────────────────────
  'gab',
  'aether',
  'faircamp',
  'orbis',
  'ceramic',
  'audius',
  'rarible',
  // ── Tier 5: Infrastructure ────────────────────────────────
  'xmtp',
  'push',
  'huddle01',
  'tableland',
  // ── Fediverse Forks (NEW 2026-07-27) ────────────────────
  'mbin',
  'immich',
  'discourse',
  'ghost',
  'kbin',
];

/** Default protocols used when no explicit filter is provided */
export const DEFAULT_PROTOCOLS: Protocol[] = ALL_PROTOCOLS;

export const DEFAULT_TIMEOUT_MS = 6000;
export const FEED_GENERATION_TIMEOUT_MS = 12000;

// ─── Per-provider timeouts ───────────────────────────────────────
// Aggressive timeouts for slow providers. RSS and ponder are the
// worst offenders — they get 3s. Social protocols get more slack.
export const PROVIDER_TIMEOUTS: Record<Protocol, number> = {

// ─── Per-provider fetch timer ────────────────────────────────────
// Tracks how long each provider fetch takes so we can surface slow
// providers in the debug header and log to KV for tuning.

export interface ProviderTiming {

export class ProviderTimer {

// ─── Timeout wrapper ─────────────────────────────────────────────
// Races a provider fetch against a per-provider timeout. When the
// timeout fires, the promise rejects with a distinct "timeout" error
// so the caller can distinguish timeouts from other failures.

export class ProviderTimeoutError extends Error {

export async function withProviderTimeout<T>(
  promise: Promise<T>,
  protocol: Protocol,
  timeoutMs: number,
): Promise<T> {

// ─── KV log for slow providers ───────────────────────────────────
// Logs any provider fetch taking >3s to KV for analysis and tuning.

async function logSlowProviderToKv(env: Env, protocol: string, durationMs: number): Promise<void> {

// ─── Provider factory ────────────────────────────────────────────
// Supports 10 core protocols directly via FeedProvider implementations.
// ALL OTHER protocols fall back to the bridge HTTP API, which has
// a comprehensive PROVIDERS registry with 50+ bridge fetchers.

export function getProvider(protocol: Protocol, env: Env): FeedProvider {

/**
 * BridgeFeedProvider — generic fallback for any protocol that has
 * a bridge provider registered in bridge/src/server/feeds.ts.
 *
 * Fetches from the bridge HTTP API (which runs alongside the worker
 * on Talos). This allows ALL 68+ protocols to be fetched through
 * the same unified feed pipeline.
 */
export class BridgeFeedProvider implements FeedProvider {

// Wrapper that tries RMI first, falls back to public RSS.
// This is needed because RMI is only reachable from Talos internal
// network, not from the Cloudflare edge.
class RssWithFallbackProvider implements FeedProvider {

// ─── Circuit breaker ─────────────────────────────────────────────
// Per-provider KV-backed failure counter. After 3 consecutive
// failures in a 60s window, the provider is skipped on subsequent
// feed requests until a successful probe clears the breaker.

const CB_TTL = 60;
const CB_THRESHOLD = 3;

async function cbKey(protocol: string): Promise<string> {

export async function isCircuitOpen(env: Env, protocol: string): Promise<boolean> {

export async function incrCircuit(env: Env, protocol: string): Promise<void> {

export async function resetCircuit(env: Env, protocol: string): Promise<void> {

// ─── Timeout-specific circuit breaker ────────────────────────────
// Separate from the generic error circuit breaker. After 3
// consecutive timeouts in a 5-minute window, the provider is
// skipped entirely until a successful fetch clears it.
// This prevents repeated slow provider calls from delaying the feed.

const CB_TIMEOUT_TTL = 1800; // 30 minutes (threads timeout circuit stops hammering Meta)
const CB_TIMEOUT_THRESHOLD = 3;

async function cbTimeoutKey(protocol: string): Promise<string> {

export async function isTimeoutCircuitOpen(env: Env, protocol: string): Promise<boolean> {

export async function incrTimeoutCircuit(env: Env, protocol: string): Promise<void> {

export async function resetTimeoutCircuit(env: Env, protocol: string): Promise<void> {

/**
 * Returns a map of which protocols are circuit-broken (and why),
 * for inclusion in the X-DegenFeed-Debug header.
 * Example: { rss: "timeout-circuit", ponder: "error-circuit" }
 */
export async function getCircuitStatus(
  env: Env,
  protocols: Protocol[],
): Promise<Record<string, string>> {

// ─── Provider fan-out ────────────────────────────────────────────

export interface ProviderResult {

export interface ExecutionContext {

/**
 * Fetches all requested protocols in parallel. Respects open circuit
 * breakers (both error-based and timeout-based), serves per-provider
 * KV cache hits immediately (with a background refresh via waitUntil),
 * and trips breakers on failure.
 *
 * Each provider fetch uses its own per-protocol timeout. After 3
 * consecutive timeouts, a 5-minute timeout-specific circuit breaker
 * trips. Slow providers (>3s) are logged to KV for analysis.
 *
 * Provider notices are appended to the `notices` sink. When provided,
 * `timer` collects per-provider timing data for the debug header.
 */
export async function fetchFromProviders(
  env: Env,
  protocols: Protocol[],
  limit: number,
  notices: string[],
  execCtx?: ExecutionContext,
  timer?: ProviderTimer,
): Promise<ProviderResult[]> {

/**
 * Wraps fetchFromProviders with a top-level timeout.
 * If the fetch takes longer than `timeoutMs`, returns whatever
 * results have been collected so far (partial results).
 * Used by route handlers to enforce the feed generation limit.
 *
 * Individual provider fetches have their OWN per-provider timeouts
 * (PROVIDER_TIMEOUTS), so by the time the overall timeout fires,
 * most providers should have already resolved or timed out individually.
 * This outer timeout is a safety net that ensures we NEVER hang.
 */
export async function fetchFromProvidersWithTimeout(
  env: Env,
  protocols: Protocol[],
  limit: number,
  notices: string[],
  timeoutMs: number,
  execCtx?: ExecutionContext,
  timer?: ProviderTimer,
): Promise<{ results: ProviderResult[]; timedOut: boolean }> {

// ─── Result aggregation ──────────────────────────────────────────

export interface ProviderFetchSummary {

/**
 * Aggregates fan-out results into the flat post list plus the
 * `errors`/`perProtocol` meta fields. Matches the legacy semantics:
 * a fulfilled-but-errored provider contributes 0 posts silently,
 * only breaker skips and outright rejections surface in `errors`.
 *
 * Updated 2026-07-18: `skipped` errors now distinguish between
 * error-circuit and timeout-circuit breaks in the error message.
 */
export function collectProviderResults(results: ProviderResult[]): ProviderFetchSummary {

// ─── Single-provider helpers for auxiliary routes ────────────────

export async function fetchRedditPosts(env: Env, subreddit: string | null): Promise<FeedResult> {

export interface ProviderHealth {

export async function checkProvidersHealth(env: Env): Promise<Record<string, ProviderHealth>> {

