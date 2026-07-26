/**
 * feed-feedback — "Not interested" / "Show more like this" feedback.
 *
 * TikTok-style: when a user says "Show less like this", immediately
 * demote that topic/creator with a strong negative weight. When they
 * say "Show more like this", boost.
 *
 * Feedback is persisted to the user's behavior profile in KV.
 * Weights decay over time (14-day half-life) so stale feedback fades.
 */

import type { UnifiedPost } from '@degenfeed/types';
import type { Env } from '../types';

export type FeedbackAction = 'show-more' | 'show-less';

export interface FeedbackEntry {

export interface FeedbackProfile {

const FEEDBACK_KEY_PREFIX = 'user:feedback:';
const FEEDBACK_TTL = 60 * 60 * 24 * 30; // 30 days
const TOPIC_BOOST_DELTA = 0.3;
const TOPIC_DEMOTE_DELTA = -0.5;
const CREATOR_BOOST_DELTA = 0.2;
const CREATOR_DEMOTE_DELTA = -0.4;
const CONTENT_TYPE_BOOST_DELTA = 0.15;
const CONTENT_TYPE_DEMOTE_DELTA = -0.3;
const DECAY_HALF_LIFE_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

function feedbackKey(userId: string): string {

export function emptyFeedbackProfile(): FeedbackProfile {

export async function loadFeedbackProfile(env: Env, userId: string): Promise<FeedbackProfile> {

function applyDecay(profile: FeedbackProfile): FeedbackProfile {

export async function recordFeedback(
  env: Env,
  userId: string,
  post: UnifiedPost,
  action: FeedbackAction,
): Promise<FeedbackProfile> {

export interface FeedbackBoostResult {

export function computeFeedbackBoost(
  post: UnifiedPost,
  profile: FeedbackProfile,
): FeedbackBoostResult {

/**
 * Filters posts that should be completely suppressed based on strong
 * negative feedback (topic weight < -2.0 or creator weight < -2.0).
 */
export function filterSuppressedPosts(
  posts: UnifiedPost[],
  profile: FeedbackProfile,
): UnifiedPost[] {

