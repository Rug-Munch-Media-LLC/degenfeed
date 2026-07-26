/**
 * @degenfeed/api-worker — Shorts Aggregation Engine v3 (Unified)
 *
 * Multi-source short-form video aggregator supporting ALL sources:
 *   Loops (primary, self-hosted), PeerTube, YouTube Shorts,
 *   TikTok (via RSS-Bridge), Instagram Reels (via RSS-Bridge),
 *   Owncast clips, Lemmy video posts, Pixelfed short videos,
 *   AT Protocol firehose (Bluesky/Skylight/WhiteWind),
 *   Zora video NFTs (with marketplace bids/buy data),
 *   Farcaster video Frames,
 *   Nostr NIP-71 video events,
 *   Lens video publications,
 *   Bluesky native video posts
 *
 * All sources normalized to ShortVideo format, deduplicated across sources,
 * quality scored, Loops content gets priority, ranked for algorithm.
 *
 * Each short carries cross-platform availability info: "Also available on"
 * shows which other platforms host the same content.
 *
 * @see ShortsAlgorithm for the recommendation engine consuming this
 */

import { detectNiches } from '@degenfeed/feed-core';
import {
import type { Env } from '../types';

// ─── Types ───────────────────────────────────────────────────────────────

export interface SourceHealth {

export type ExtendedSource =
  | 'loops' // Primary self-hosted
  | 'peertube' // Self-hosted federated
  | 'youtube' // YouTube Shorts
  | 'tiktok_rss' // TikTok via RSS-Bridge
  | 'instagram' // Instagram Reels
  | 'owncast' // Owncast clips
  | 'rss_bridge' // Generic RSS-Bridge
  | 'lemmy' // Lemmy video posts
  | 'pixelfed' // Self-hosted Pixelfed
  | 'atprotocol' // AT Protocol firehose
  | 'zora' // Zora video NFTs
  | 'farcaster' // Farcaster video Frames
  | 'nostr' // Nostr NIP-71 video events
  | 'lens' // Lens video publications
  | 'bluesky' // Bluesky native video posts
  | 'direct'; // DegenFeed native

export const ALL_SOURCES: ExtendedSource[] = [
  'loops',
  'peertube',
  'youtube',
  'tiktok_rss',
  'instagram',
  'owncast',
  'rss_bridge',
  'lemmy',
  'pixelfed',
  'atprotocol',
  'zora',
  'farcaster',
  'nostr',
  'lens',
  'bluesky',
];

export const SOURCE_META: Record<ExtendedSource, { label: string; color: string; icon: string }> = {

export interface AggregatedShort {

export interface AggregationResult {

export interface AggregationOpts {

// ─── Constants ───────────────────────────────────────────────────────────

/** Max video duration (seconds) to qualify as a "short" */
const SHORTS_MAX_DURATION = 120;

// ─── Aggregation Engine ─────────────────────────────────────────────────

export class ShortsAggregatorV2 {

