/**
 * @degenfeed/api-worker — Video Content Discovery Engine
 *
 * Unified video recommendation engine with 5 recommendation strategies:
 * 1. "Because you watched..." — Similar videos based on content affinity
 * 2. "Trending in your interests" — Category-specific trending videos
 * 3. "Hidden gems" — High-quality videos with low view counts
 * 4. "Continue watching" — Videos in progress
 * 5. "Up next" autoplay queue
 *
 * Integrates with:
 *   - @degenfeed/ranking (video-scorer.ts) for scoring
 *   - watch-history.ts for progress tracking and interest profiling
 *   - video-hub.ts for data sources
 */

import { type VideoForScoring, VideoScoreEngine } from '@degenfeed/ranking';
import type { ContinueWatchingItem } from '../lib/watch-history';
import type { UnifiedVideo } from '../routes/video-hub';

// ─── Types ──────────────────────────────────────────────────────────────

export interface DiscoveryStrategy {

export interface DiscoveryOptions {

export interface DiscoveryRow {

export interface DiscoveryPage {

// ─── Video adapter ──────────────────────────────────────────────────────

/**
 * Convert a UnifiedVideo to the VideoForScoring format.
 * Handles missing fields with sensible defaults.
 */
function toVideoForScoring(video: UnifiedVideo): VideoForScoring {

// ─── Similarity Scoring ────────────────────────────────────────────────

interface SimilarityWeights {

const DEFAULT_SIMILARITY_WEIGHTS: SimilarityWeights = {

const VIDEO_ENGINE = new VideoScoreEngine();

/**
 * Compute similarity score between two videos (0-1).
 */
function computeSimilarity(
  source: UnifiedVideo,
  candidate: UnifiedVideo,
  weights: SimilarityWeights = DEFAULT_SIMILARITY_WEIGHTS,
): number {

// ─── Velocity Score ────────────────────────────────────────────────────

/**
 * Compute a trending velocity score for a video.
 * Higher = faster engagement growth.
 */
function computeVelocity(video: UnifiedVideo, now: number): number {

// ─── Discovery Strategies ──────────────────────────────────────────────

/**
 * Strategy 1: "Because you watched..." — Find videos similar to recent watches.
 */
export class BecauseYouWatchedStrategy implements DiscoveryStrategy {

/**
 * Strategy 2: "Trending in your interests" — Videos trending in user's preferred categories.
 */
export class TrendingInInterestsStrategy implements DiscoveryStrategy {

/**
 * Strategy 3: "Hidden gems" — High-quality videos with low view counts.
 */
export class HiddenGemsStrategy implements DiscoveryStrategy {

/**
 * Strategy 4: "Continue watching" — Videos the user started but didn't finish.
 */
export class ContinueWatchingStrategy implements DiscoveryStrategy {

/**
 * Strategy 5: "Up next" autoplay queue — After current video ends.
 */
export class UpNextStrategy implements DiscoveryStrategy {

// ─── Diversity Rotation ────────────────────────────────────────────────

/**
 * Ensure at least 2 different categories per 10 recommendations.
 * Rotates categories to maintain diversity across discovery rows.
 */
function ensureCategoryDiversity(rows: DiscoveryRow[], minCategories = 2): DiscoveryRow[] {

// ─── Discovery Engine ──────────────────────────────────────────────────

export interface VideoDiscoveryConfig {

const DEFAULT_STRATEGIES: DiscoveryStrategy[] = [
  new ContinueWatchingStrategy(),
  new BecauseYouWatchedStrategy(),
  new TrendingInInterestsStrategy(),
  new HiddenGemsStrategy(),
];

export class VideoDiscoveryEngine {

// ─── Singleton ─────────────────────────────────────────────────────────

export const discoveryEngine = new VideoDiscoveryEngine();

// ─── Helpers ───────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {

function timeAgo(ms: number): string {

