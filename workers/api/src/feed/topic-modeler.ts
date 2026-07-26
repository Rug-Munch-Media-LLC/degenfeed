/**
 * topic-modeler — Intelligent topic categorization and classification engine.
 *
 * Assigns hierarchical categories to news stories using keyword matching,
 * source-based categorization, content-based TF-IDF-like scoring, and
 * cross-reference boosting.
 *
 * Category hierarchy:
 *   Crypto → Bitcoin / Ethereum (DeFi / NFTs / Layer 2) / Solana / Regulation / Mining
 *   Tech   → AI / Web3 / Privacy / Infrastructure
 *   Finance → Markets / Macro / Venture Capital / Trading
 *   Culture → NFTs & Art / Gaming / Music / Memes
 */

import { NICHE_KEYWORDS } from '@degenfeed/feed-core';
import type { AggregatedStory } from './news-aggregator';

// ─── Category Hierarchy ──────────────────────────────────────────────────

export interface CategoryNode {

export const CATEGORY_TREE: CategoryNode[] = [
  {
  {
];

// ─── Flattened category lookup ─────────────────────────────────────────

function flattenCategories(nodes: CategoryNode[]): Map<string, CategoryNode> {

const CATEGORY_MAP = flattenCategories(CATEGORY_TREE);

// ─── Category Score Result ─────────────────────────────────────────────

export interface CategoryScore {

export interface ClassificationResult {

// ─── TF-IDF-like Term Frequency Scoring ───────────────────────────────

const _TERM_FREQUENCY_CACHE = new Map<string, Map<string, number>>();

function buildTermFrequency(text: string): Map<string, number> {

function computeTfIdfScore(text: string, keywords: string[]): number {

// ─── Main Classification Engine ────────────────────────────────────────

export interface ClassificationOptions {

/**
 * Classify a news story into categories. Returns a primary category and
 * all scored categories.
 */
export function classifyStory(
  story: AggregatedStory,
  opts: ClassificationOptions = {},
): ClassificationResult {

/**
 * Classify all stories in an aggregation result. Also builds cross-reference
 * counts for accuracy boosting.
 */
export function classifyStories(stories: AggregatedStory[]): Map<string, ClassificationResult> {

/**
 * Get the top N categories for a set of stories, by aggregate confidence.
 */
export function getTopCategories(
  classifications: Map<string, ClassificationResult>,
  topN = 10,
): Array<{

/**
 * Get all available categories with optional parent filter.
 */
export function getCategories(parentId?: string): CategoryNode[] {

export { CATEGORY_MAP };

