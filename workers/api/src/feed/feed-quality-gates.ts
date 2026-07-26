/**
 * feed-quality-gates — Content quality pipeline.
 *
 * Order: quality gate → engagement floor → language filter →
 *        cross-protocol dedup → freshness scoring → source diversity → ranking.
 *
 * Each gate is independently configurable and emits metadata for observability.
 */

import { isEnglishPost } from '@degenfeed/feed-core';
import type { UnifiedPost } from '@degenfeed/types';
import { hasNsfwContent, hasSpamSignals } from '../ranking/ranking-weights';
import { deduplicateCrossProtocol } from './content-dedup';

type SourceCategory = 'social' | 'lemmy' | 'peertube' | 'youtube' | 'mastodon' | 'rss' | 'reddit';

// ─── 1. Content quality gate ─────────────────────────────────────

export interface QualityGateResult {

/**
 * Filters out posts with quality score below threshold.
 * Quality score is the normalized 0-1 value from the composite quality system
 * (stored as feedDebug.qualityScore or score.qualityScore/100).
 * Default threshold of 0.3 lets through reasonably good content.
 */
export function applyQualityGate(
  posts: UnifiedPost[],
  threshold: number = 0.3,
): { posts: UnifiedPost[]; meta: QualityGateResult } {

function getQualityScore(post: UnifiedPost): number {

// ─── 2. Engagement floor ──────────────────────────────────────────

export interface EngagementFloorResult {

/**
 * Posts with 0 engagement AND older than 24h are deprioritized
 * (moved after newer content) while still being kept in the feed.
 * Posts with low non-zero but very old engagement are also nudged down.
 */
export function applyEngagementFloor(
  posts: UnifiedPost[],
  now: number = Date.now(),
  ageHours: number = 24,
): { posts: UnifiedPost[]; meta: EngagementFloorResult } {

// ─── 3. Language detection filter ─────────────────────────────────

export interface LanguageFilterResult {

const _LATIN_SCRIPT_RE = /^[\x00-\x7F\u00C0-\u024F\s\p{P}\p{S}\p{N}\p{Emoji}]+$/u;

function fastNonLatinScriptCheck(text: string): boolean {

/**
 * Language filter: primarily shows English content.
 * Uses the existing isEnglishPost from feed-core + fast non-Latin script check.
 * Configurable via `preferEnglish` flag.
 */
export function applyLanguageFilter(
  posts: UnifiedPost[],
  preferEnglish: boolean = true,
): { posts: UnifiedPost[]; meta: LanguageFilterResult } {

// ─── 3b. NSFW / Spam content filter ──────────────────────────────

export interface NsfwFilterResult {

/**
 * Filters out posts containing NSFW or spam content.
 * Uses keyword-based detection from ranking-weights.
 */
export function applyNsfwSpamFilter(posts: UnifiedPost[]): {

// ─── 3c. Global dedup registry (15-layer dedup) ───────────────────

export interface GlobalDedupResult {

/**
 * Runs all posts through the GlobalDedupRegistry BEFORE scoring.
 * Removes content that was already seen across ANY protocol.
 * This is the UNIVERSAL dedup gate — catches everything the
 * cross-protocol dedup below might miss.
 *
 * Integrates with the 15-layer dedup engine:
 * SHA-256, URL norm, Levenshtein title, image pHash,
 * canonical URL, OG meta, cross-protocol ID, quote-post,
 * thread merges, timestamp proximity, RSS GUID.
 */
export function applyGlobalDedupRegistry(
  posts: UnifiedPost[],
  env: { DEDUP?: KVNamespace },
): { posts: UnifiedPost[]; meta: GlobalDedupResult } {

// ─── 4. Cross-protocol dedup ──────────────────────────────────────

export interface CrossProtocolDedupResult {

/**
 * Same content posted on multiple protocols (e.g. Nostr AND Farcaster)
 * appears only once, keeping the version with higher engagement.
 * Wraps the existing deduplicateCrossProtocol from content-dedup.ts.
 */
export function applyCrossProtocolDedup(posts: UnifiedPost[]): {

// ─── 5. Content freshness scoring ─────────────────────────────────

export interface FreshnessScoringConfig {

export const DEFAULT_FRESHNESS_CONFIG: FreshnessScoringConfig = {

export const HOT_FRESHNESS_CONFIG: FreshnessScoringConfig = {

export const TRENDING_FRESHNESS_CONFIG: FreshnessScoringConfig = {

export const TOP_FRESHNESS_CONFIG: FreshnessScoringConfig = {

export interface FreshnessScores {

export function computeFreshnessScore(
  post: UnifiedPost,
  now: number = Date.now(),
  config: FreshnessScoringConfig = DEFAULT_FRESHNESS_CONFIG,
): FreshnessScores {

export interface FreshnessScoringResult {

/**
 * Applies configurable freshness scoring to posts.
 * Attaches a `freshnessScore` field to each post and sorts by
 * freshness-multiplied score. Posts get reordered so fresher
 * content surfaces higher, weighted by the per-tab config.
 */
export function applyFreshnessScoring(
  posts: UnifiedPost[],
  now: number = Date.now(),
  config: FreshnessScoringConfig = DEFAULT_FRESHNESS_CONFIG,
): { posts: UnifiedPost[]; meta: FreshnessScoringResult } {

// ─── 6. Source diversity ──────────────────────────────────────────

export interface SourceDiversityResult {

const SOURCE_CATEGORY_ORDER: SourceCategory[] = [
  'social',
  'lemmy',
  'rss',
  'reddit',
  'peertube',
  'youtube',
  'mastodon',
];

function resolveSourceCategory(post: UnifiedPost): SourceCategory {

/**
 * Ensures no more than `maxPctPerSource`% of the feed comes from any
 * single source category. Rearranges posts to enforce diversity:
 * when a source hits its cap, its remaining posts move to the bottom.
 *
 * Also ensures protocol diversity by interleaving sources.
 */
export function applySourceDiversity(
  posts: UnifiedPost[],
  maxPctPerSource: number = 30,
): { posts: UnifiedPost[]; meta: SourceDiversityResult } {

// ─── 7. Full quality pipeline orchestrator ────────────────────────

export interface QualityPipelineOptions {

export interface QualityPipelineResult {

/**
 * Full quality pipeline. Order:
 * quality gate → engagement floor → language filter → NSFW/spam filter
 * → dedup → freshness → diversity → output.
 *
 * Each gate reports its metrics in the meta object for observability.
 */
export function applyQualityPipeline(
  posts: UnifiedPost[],
  opts: QualityPipelineOptions = {},
): QualityPipelineResult {

