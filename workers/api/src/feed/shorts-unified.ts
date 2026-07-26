/**
 * @degenfeed/api-worker — Unified Multi-Protocol Shorts Feed
 *
 * Aggregates short-form videos from ALL supported protocols into a
 * single, ranked, deduplicated feed. Sources include:
 *
 *   ActivityPub (Loops/Pixelfed/PeerTube via AP)
 *   AT Protocol (Bluesky/Flashes via app.bsky.embed.video)
 *   Nostr (Kind 1 with video attachments)
 *   Farcaster (Casts with video embeds)
 *   Lens (Publications with video)
 *   Zora (Video NFTs)
 *   PeerTube (Federated short videos)
 *   YouTube/TikTok/Instagram (existing ShortVideoItem sources)
 *   DegenFeed native shorts
 *
 * Each source is fetched in parallel, normalized to a common ShortVideo
 * type, deduplicated by content hash, and ranked by engagement + freshness.
 *
 * @see ShortsAggregator for the original single-source aggregator
 * @see UnifiedShortsPipeline for the publishing side
 */

import {
import type { Env } from '../types';

import { PROTOCOL_META, type ShortProtocol, type ShortVideo } from '../lib/unified-shorts';

// ─── Types ────────────────────────────────────────────────────────────────

export type FeedSource =
  | 'loops'
  | 'activitypub'
  | 'atproto'
  | 'nostr'
  | 'farcaster'
  | 'lens'
  | 'zora'
  | 'bluesky'
  | 'peertube'
  | 'youtube'
  | 'tiktok'
  | 'instagram'
  | 'pixelfed'
  | 'degenfeed';

export interface UnifiedFeedOptions {

export interface UnifiedShortFeed {

export interface UserPreferences {

// ─── Source Protocol Color Map (for frontend badges) ─────────────────────

export const FEED_SOURCE_COLORS: Record<string, string> = {

export const FEED_SOURCE_LABELS: Record<string, string> = {

// ─── Unified Feed Aggregator ─────────────────────────────────────────────

export class UnifiedShortsFeed {

