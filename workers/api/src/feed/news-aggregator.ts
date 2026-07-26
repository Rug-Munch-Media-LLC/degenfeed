/**
 * news-aggregator — Smart news aggregation engine.
 *
 * Thin orchestrator: fetches from all sources, enriches, deduplicates,
 * clusters, scores, and ranks news stories.
 *
 * Layer in the feed stack: fetch → enrich → dedup → cluster → score → rank
 */

import { detectNiches } from '@degenfeed/feed-core';
import { log } from '../logger';
import type { Env } from '../types';
import type {

// Re-export types for consumers still importing from this file
export type { AggregatedStory, AggregationOptions, AggregationResult } from './news-types';
import {
import { fetchRssFeed, parseFeedXml } from './news-rss-parser';

import { NEWS_SOURCES, NEWSLETTER_FEEDS } from './news-source-tiers';

/**
 * Total number of unique news sources.
 */
export function computeTotalSourceCount(): number {

/**
 * Fetch stories from protocol-based sources (Nostr, Farcaster, Bluesky).
 */
async function fetchProtocolSources(
  env: Env,
): Promise<Array<{ item: ParsedRssItem; source: NewsSourceMeta }>> {

/**
 * Lightweight fetch to extract og:image, meta description, and author
 * from an article page.
 */
async function enrichArticle(url: string, timeoutMs = 3000): Promise<ArticleEnrichment> {

/**
 * Cluster related stories by similarity.
 */
function clusterStories(stories: AggregatedStory[]): StoryCluster[] {

/**
 * Main entry point: fetch news from all available sources, deduplicate,
 * enrich with entities/sentiment/credibility, cluster stories, and return
 * ranked results.
 */
export async function aggregateNews(
  env: Env,
  opts: AggregationOptions = {},
): Promise<AggregationResult> {

