/**
 * unified-feed — Orchestrator that blends social posts (Nostr, Farcaster, etc.)
 * with content-platform posts (Lemmy, PeerTube, YouTube, Mastodon) into a
 * single interleaved timeline.
 */

import { deduplicatePosts } from '@degenfeed/feed-core';
import type { Protocol, UnifiedPost } from '@degenfeed/types';
import type { Env } from '../types';
import { applyCurationPipeline } from './feed-curation-rules';
import type { ExecutionContext } from './feed-fetcher';
import {
import {
import { fetchLemmyPosts, fetchPeerTubeVideos, fetchYouTubeVideos } from './unified-fetchers';

const SOCIAL_PROTOCOLS: Protocol[] = ['nostr', 'farcaster', 'lens', 'bluesky', 'mastodon'];

export type SourceCategory =
  | 'social'
  | 'lemmy'
  | 'peertube'
  | 'youtube'
  | 'mastodon'
  | 'rss'
  | 'reddit';

export interface UnifiedFeedOptions {

export interface UnifiedFeedPost extends UnifiedPost {

const BADGES: Record<string, { emoji: string; color: string; label: string }> = {

/**
 * Resolve badge for a post. Mastodon posts check the raw _fediverseSoftware
 * field to render Pleroma/Akkoma/Misskey/Firefish badges instead.
 */
function badgeFor(
  protocol: string,
  post?: { raw?: Record<string, unknown> },
): { emoji: string; color: string; label: string } {

// ─── Freshness config per tab ─────────────────────────────────────

function freshnessConfigForTab(tab: string): FreshnessScoringConfig {

// ─── Mix weights by blend mode ─────────────────────────────────────

interface MixWeights {

function getMixWeights(mix: string): MixWeights {

/**
 * Adjust mix weights based on showMore/showLess options.
 */
function adjustMixForPreference(
  mix: MixWeights,
  showMore?: string,
  showLess?: string,
  excludeProtocols?: string[],
): MixWeights {

// ─── Source resolution ─────────────────────────────────────────────

function resolveSources(rawSources?: string): Set<SourceCategory> {

// ─── Main orchestrator ─────────────────────────────────────────────

export async function buildUnifiedFeed(
  env: Env,
  opts: UnifiedFeedOptions = {},
  execCtx?: ExecutionContext,
): Promise<{

