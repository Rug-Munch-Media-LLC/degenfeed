/**
 * smart-refresh — Catching you up after returning from inactivity.
 *
 * When a user returns after >30min:
 * 1. Shows "Catching you up..." with summary of top posts
 * 2. Prioritizes posts from followed creators
 * 3. Mixes in trending since their last visit
 */

import type { UnifiedPost } from '@degenfeed/types';
import type { Env } from '../types';

const SMART_REFRESH_THRESHOLD_MS = 30 * 60_000; // 30 minutes
const CATCHUP_MAX_POSTS = 5;
const SYNC_KEY_PREFIX = 'user:sync:';

export interface CatchUpSummary {

export interface LastSync {

function syncKey(address: string): string {

export async function getLastSync(env: Env, address: string): Promise<number> {

export async function updateLastSync(env: Env, address: string): Promise<void> {

export function shouldTriggerSmartRefresh(lastSync: number, now: number): boolean {

export function buildCatchUpSummary(
  posts: UnifiedPost[],
  followed: Set<string>,
  lastSync: number,
  now: number,
): CatchUpSummary {

