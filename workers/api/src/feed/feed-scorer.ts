/**
 * feed-scorer — Ranking v2 scoring, velocity tracking, and trending.
 *
 * Owns algorithm-preference parsing/merging, ranking context
 * construction, engagement velocity snapshots (KV-backed), score
 * breakdown computation, sort modes (scored/hot/new/top), diversity
 * ranking, cursor pagination, and trending topic aggregation.
 */

import {
import type { ScoringWeights, UnifiedMode } from '@degenfeed/ranking';

import { scorePost as unifiedScorePost } from '@degenfeed/ranking';
import type { UnifiedPost } from '@degenfeed/types';
import { log } from '../logger';
import type { Env } from '../types';
import type { StoredUserPreferences } from './feed-cache';

// ─── Preference parsing & merging ──────────────────────────────────

export function parsePrefsFromQuery(
  params: URLSearchParams,
): Partial<UserAlgorithmPreferences> | null {

/** Anonymous cookie preferences: personalized feed without sign-in. */
export function parseCookiePrefs(cookieHeader: string): UserAlgorithmPreferences | null {

/** New posts since last visit: reads the df_last_visit cookie, counts newer posts. */
export function countNewSinceLastVisit(cookieHeader: string, posts: UnifiedPost[]): number {

/**
 * Merges per-user stored niches/platforms and anonymous cookie
 * preferences into the query-param preferences. Query params win,
 * then authenticated preferences, then cookie preferences.
 */
export function mergePreferences(
  queryPrefs: Partial<UserAlgorithmPreferences> | null,
  storedPrefs: StoredUserPreferences | null,
  cookiePrefs: Partial<UserAlgorithmPreferences> | null,
): Partial<UserAlgorithmPreferences> {

// ─── Ranking context ───────────────────────────────────────────────

export function buildRankingContext(
  now: number,
  prefs?: Partial<UserAlgorithmPreferences> | null,
  recentAuthors?: Map<string, number>,
  followed?: Set<string>,
  sourceQuality?: Map<string, number>,
): RankingContext {

/**
 * Populates recentAuthors for the diversity bonus: counts how many
 * times each author appears (repeat authors get penalized so one
 * noisy account doesn't dominate the feed) and derives a follower
 * based source quality signal.
 */
export function buildAuthorSignals(posts: UnifiedPost[]): {

// ─── Engagement velocity tracking ──────────────────────────────────

export type EngagementSnapshot = {

/**
 * Loads previous engagement snapshots from KV for velocity tracking.
 * Each key is eng:<postId> with TTL 300s, storing {likes, reposts, replies, at}.
 */
export async function loadPreviousEngagement(
  env: Env,
  posts: UnifiedPost[],
): Promise<Map<string, EngagementSnapshot>> {

/**
 * Stores current engagement snapshots for the next velocity
 * calculation. Fire-and-forget — non-critical.
 */
export async function storeEngagementSnapshots(env: Env, posts: UnifiedPost[]): Promise<void> {

// ─── Scoring, sorting, ranking ─────────────────────────────────────

export interface PostScore {

export type RankedPost = UnifiedPost & {

export interface ScoredPost {

export interface ScoreAndRankOptions {

export interface ScoreAndRankResult {

/**
 * Computes score breakdowns (with velocity from KV snapshots),
 * applies cursor pagination and the low-quality filter, sorts by the
 * requested mode ('scored' uses the diversity ranker; 'hot'/'top'/
 * 'new' are simple sorts that bypass it), and attaches score
 * transparency fields to each returned post.
 */
export async function scoreAndRank(
  env: Env,
  posts: UnifiedPost[],
  opts: ScoreAndRankOptions,
): Promise<ScoreAndRankResult> {

// ─── Trending topics ───────────────────────────────────────────────

/**
 * Computes trending topics from the post window and merges trending
 * hashtags from our Mastodon instance. Non-critical — Mastodon
 * failures are logged and swallowed.
 */
export async function computeTrending(
  posts: UnifiedPost[],
  windowHours: number,
): Promise<TrendingTopic[]> {

