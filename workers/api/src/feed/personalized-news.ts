/**
 * personalized-news — Personalized news feed engine.
 *
 * Scores and ranks news stories per user based on:
 * - Topic preferences (weighted from reading history)
 * - Source preferences (boost sources the user engages with)
 * - Novelty vs familiarity (70% preferred topics, 30% discovery)
 * - Depth preferences (deep analysis vs headlines)
 * - Time-of-day optimization (morning/midday/evening)
 *
 * newsScore = (
 *   topicalRelevance × 0.35 +
 *   sourceCredibility × 0.20 +
 *   freshness × 0.20 +
 *   engagementVelocity × 0.15 +
 *   depthMatch × 0.10
 * ) × storyImportance × sentimentBias
 */

import type { AggregatedStory } from './news-aggregator';
import { classifyStory } from './topic-modeler';

// ─── User Preferences ──────────────────────────────────────────────────

export interface NewsPreferences {

export const DEFAULT_PREFERENCES: NewsPreferences = {

// ─── Reading History (KV-backed) ───────────────────────────────────────

export interface ReadHistoryEntry {

export interface UserProfile {

// ─── Score Computation ─────────────────────────────────────────────────

export interface NewsScoreComponents {

/**
 * Compute the personalized news score for a story given user preferences.
 */
export function computePersonalizedScore(
  story: AggregatedStory,
  prefs: NewsPreferences,
  profile: UserProfile | null,
  now: number,
): NewsScoreComponents {

// ─── Personalize / Score Stories ───────────────────────────────────────

export interface PersonalizedStory extends AggregatedStory {

/**
 * Take a list of aggregated stories, apply user preferences, return
 * personalized ranking with 70/30 familiarity/discovery mix.
 */
export function personalizeNewsFeed(
  stories: AggregatedStory[],
  prefs: NewsPreferences = DEFAULT_PREFERENCES,
  profile: UserProfile | null = null,
  now: number = Date.now(),
): PersonalizedStory[] {

// ─── User Profile Inference ────────────────────────────────────────────

/**
 * Infer/update a user profile from reading history.
 */
export function inferUserProfile(history: ReadHistoryEntry[]): UserProfile {

