/**
 * news-types — Shared types for the news aggregation pipeline.
 *
 * Extracted from news-aggregator.ts during de-godding.
 * All interfaces, types, and enums used across the news pipeline.
 */

import type { Protocol } from '@degenfeed/types';

// ─── News Source Meta ────────────────────────────────────────────────

export interface NewsSourceMeta {

// ─── Aggregated Story ────────────────────────────────────────────────

export interface AggregatedStory {

// ─── Story Entities ──────────────────────────────────────────────────

export interface StoryEntities {

// ─── Sentiment Result ────────────────────────────────────────────────

export interface SentimentResult {

// ─── Story Cluster ───────────────────────────────────────────────────

export interface StoryCluster {

// ─── Article Enrichment ─────────────────────────────────────────────

export interface ArticleEnrichment {

// ─── Aggregation Options ────────────────────────────────────────────

export interface AggregationOptions {

// ─── Aggregation Result ─────────────────────────────────────────────

export interface AggregationResult {

// ─── Parsed RSS Item (internal) ─────────────────────────────────────

export interface ParsedRssItem {

