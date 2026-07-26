/**
 * content-pipeline — Universal content pipeline that fills DegenFeed
 * timelines with quality content from EVERY connected network.
 *
 * New users get a full, engaging feed from day one — no empty timelines.
 * As users engage, the "For You" feed personalises, but "Trending" and
 * "Category" feeds are great from the start.
 *
 * Architecture:
 *   ContentPipeline.buildFeed()
 *     ├── resolveSources() — map requested sources → fetchers
 *     ├── parallel fetch from ALL selected sources
 *     ├── deduplicateCrossProtocol() — same content on multiple networks
 *     ├── scoreContent() — quality, engagement, freshness, relevance, diversity
 *     ├── diversifyFeed() — ensure no single source dominates
 *     └── assemble UnifiedFeed with sourceBreakdown
 */

import type { Protocol, UnifiedPost } from '@degenfeed/types';
import type { Env } from '../types';
import { deduplicateCrossProtocol } from './content-dedup';
import {
import {
import { applyQualityPipeline } from './feed-quality-gates';
import { getSeedContent } from './seed-content';
import type { UnifiedFeedPost } from './unified-feed';
import { fetchLemmyPosts, fetchPeerTubeVideos, fetchYouTubeVideos } from './unified-fetchers';

// ─── Types ──────────────────────────────────────────────────────────────

export type FeedSourceKey =
  | 'activitypub'
  | 'atproto'
  | 'nostr'
  | 'farcaster'
  | 'lens'
  | 'lemmy'
  | 'mirror'
  | 'paragraph'
  | 'ghost'
  | 'youtube'
  | 'peertube'
  | 'odysee'
  | 'rumble'
  | 'twitch'
  | 'funkwhale'
  | 'castopod'
  | 'mobilizon'
  | 'degenfeed'
  | 'zora'
  | 'pump'
  | 'mastodon'
  | 'bluesky'
  | 'rss'
  | 'reddit';

export type NetworkCategory =
  | 'decentralized-social'
  | 'discussion'
  | 'publishing'
  | 'video'
  | 'music-audio'
  | 'events'
  | 'native'
  | 'creator-coins';

export interface FeedSourceDef {

export interface ContentScore {

export interface UnifiedFeed {

export interface TrendingOptions {

export interface CuratedOptions {

export interface BuildFeedOptions {

// ─── Feed Sources registry ──────────────────────────────────────────────

export const FEED_SOURCES: Record<FeedSourceKey, FeedSourceDef> = {

// ─── Default Categories (for new users with no preferences) ──────────────

export interface DefaultCategory {

export const DEFAULT_FEED_CATEGORIES: DefaultCategory[] = [id: 'trending', label: 'Trending', source: 'all', sort: 'trending' ,id: 'crypto', label: 'Crypto & Web3', tags: ['crypto', 'web3', 'defi', 'nft'] ,id: 'tech', label: 'Tech & Dev', tags: ['tech', 'development', 'ai', 'coding'] ,id: 'art', label: 'Art & Creative', tags: ['art', 'nft', 'creative', 'design'] ,id: 'gaming', label: 'Gaming', tags: ['gaming', 'esports', 'streaming'] ,id: 'music', label: 'Music & Audio', tags: ['music', 'audio', 'podcast'] ,id: 'news', label: 'News', tags: ['news', 'politics', 'world'] ,
];

// ─── ContentPipeline ────────────────────────────────────────────────────

export class ContentPipeline {

// ─── Standalone default feed builder (convenience) ──────────────────────

/**
 * Build a default feed for brand new users. Simple entry point that
 * creates a ContentPipeline internally and calls buildDefaultFeed().
 */
export async function buildDefaultFeed(env: Env): Promise<UnifiedFeed> {

