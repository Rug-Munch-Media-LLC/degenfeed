/**
 * feed-dwell-time — TikTok-style dwell time / watch time tracking.
 *
 * Tracks how long users view each post via KV persistence. Posts with
 * high dwell time get boosted for similar content. Quick-scrolled posts
 * get demoted. Signals used:
 *   - dwell_ms: raw milliseconds viewed
 *   - completion_rate: for video/text posts, how much was consumed (0-1)
 *   - shares: whether the user shared it
 *   - profile_visits: whether the user visited the author's profile after
 *
 * Dwell buckets: skipped (<800ms), glanced (800ms-3s), read (3s-15s),
 * engaged (15s-60s), deep (60s+).
 */

import type { UnifiedPost } from '@degenfeed/types';
import type { Env } from '../types';

export const DWELL_KEY_PREFIX = 'user:dwell:';
export const DWELL_TTL = 60 * 60 * 24 * 14; // 14 days

export type DwellBucket = 'skipped' | 'glanced' | 'read' | 'engaged' | 'deep';

export interface DwellEntry {

export interface DwellProfile {

export interface DwellSignals {

export interface DwellBoostResult {

export function classifyDwell(dwellMs: number): DwellBucket {

export function dwellBoostMultiplier(bucket: DwellBucket, completionRate: number): number {

export function emptyDwellProfile(): DwellProfile {

function dwellKey(userId: string): string {

export async function loadDwellProfile(env: Env, userId: string): Promise<DwellProfile> {

export async function recordDwellEvent(
  env: Env,
  userId: string,
  post: UnifiedPost,
  dwellMs: number,
  completionRate: number,
  shared: boolean,
  profileVisit: boolean,
): Promise<DwellProfile> {

/**
 * Computes how much a candidate post should be boosted based on the user's
 * past dwell behavior. If the user spent significant time on similar content
 * (same niches, same creator, same content type), the new post gets boosted.
 *
 * Normalization: dwell scores are normalized per-user so a power user who
 * spends 30s on every post doesn't get 10x the dwell signal of a casual user.
 */
export function computeDwellBoost(post: UnifiedPost, dwellProfile: DwellProfile): DwellBoostResult {

/**
 * Returns a map of creator IDs that the user has engaged with deeply,
 * weighted by dwell time and recency. Used to boost posts from creators
 * the user spends real time on (not just quick-like scrollers).
 */
export function getDwellWeightedCreators(dwellProfile: DwellProfile): Map<string, number> {

/**
 * Returns niches sorted by aggregate dwell engagement (not just view count).
 * High dwell + high completion = user genuinely interested in this topic.
 */
export function getDwellWeightedNiches(dwellProfile: DwellProfile): Map<string, number> {

